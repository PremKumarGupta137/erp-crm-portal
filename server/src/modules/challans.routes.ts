import { ChallanStatus, Prisma, PrismaClient } from '@prisma/client';
import { Router } from 'express';
import { z } from 'zod';
import { authenticate, requireRole } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { prisma } from '../prisma';
import { ApiError } from '../utils/ApiError';
import { asyncHandler, created, ok, pageMeta, parsePagination } from '../utils/http';

const router = Router();
router.use(authenticate);

type Tx = Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>;

/**
 * Generates the next human-readable challan number (CHL-2026-0001).
 * The counter row is updated inside the caller's transaction, so Postgres holds
 * a row lock for the duration — two concurrent creates cannot get the same number.
 */
async function nextChallanNumber(tx: Tx): Promise<string> {
  const year = new Date().getFullYear();
  const key = `challan:${year}`;
  const counter = await tx.counter.upsert({
    where: { key },
    create: { key, value: 1 },
    update: { value: { increment: 1 } },
  });
  return `CHL-${year}-${String(counter.value).padStart(4, '0')}`;
}

/** The minimum an item needs to expose for the stock helpers below. */
type StockLine = { productId: string; productName: string; quantity: number };

/**
 * Applies stock reduction for every line of a challan.
 *
 * Round trips are kept to a minimum because these run inside an interactive
 * transaction against a remote database: all products are validated in ONE
 * query, and the ledger rows are written with a single createMany. Only the
 * per-product decrements have to be individual statements.
 *
 * If ANY line is short we throw, the transaction rolls back, and neither the
 * balances nor the ledger are touched — no half-shipped documents.
 */
async function reduceStockForChallan(
  tx: Tx,
  challanId: string,
  userId: string,
  items: StockLine[],
) {
  const products = await tx.product.findMany({
    where: { id: { in: items.map((i) => i.productId) } },
    select: { id: true, name: true, sku: true, currentStock: true },
  });
  const productById = new Map(products.map((p) => [p.id, p]));

  for (const item of items) {
    const product = productById.get(item.productId);
    if (!product) {
      throw ApiError.unprocessable(`Product "${item.productName}" no longer exists`);
    }
    if (product.currentStock < item.quantity) {
      throw ApiError.unprocessable(
        `Insufficient stock for ${product.name} (${product.sku}). Available: ${product.currentStock}, required: ${item.quantity}`,
        {
          productId: product.id,
          sku: product.sku,
          available: product.currentStock,
          required: item.quantity,
        },
      );
    }
  }

  for (const item of items) {
    await tx.product.update({
      where: { id: item.productId },
      data: { currentStock: { decrement: item.quantity } },
    });
  }

  await tx.stockMovement.createMany({
    data: items.map((item) => ({
      productId: item.productId,
      quantity: item.quantity,
      type: 'OUT' as const,
      reason: 'Sales challan confirmed',
      referenceType: 'CHALLAN',
      referenceId: challanId,
      createdById: userId,
    })),
  });
}

/** Puts stock back when a confirmed challan is cancelled. */
async function restoreStockForChallan(
  tx: Tx,
  challanId: string,
  userId: string,
  items: StockLine[],
) {
  for (const item of items) {
    await tx.product.update({
      where: { id: item.productId },
      data: { currentStock: { increment: item.quantity } },
    });
  }

  await tx.stockMovement.createMany({
    data: items.map((item) => ({
      productId: item.productId,
      quantity: item.quantity,
      type: 'IN' as const,
      reason: 'Sales challan cancelled — stock returned',
      referenceType: 'CHALLAN_CANCEL',
      referenceId: challanId,
      createdById: userId,
    })),
  });
}

/**
 * Prisma's default interactive-transaction budget is 5s, which is too tight for
 * a multi-statement write against a managed Postgres in another region.
 */
const TX_OPTIONS = { maxWait: 15_000, timeout: 30_000 };

const challanBody = z.object({
  customerId: z.string().uuid('A customer must be selected'),
  status: z.enum(['DRAFT', 'CONFIRMED']).default('DRAFT'),
  notes: z.string().trim().max(500).optional(),
  items: z
    .array(
      z.object({
        productId: z.string().uuid(),
        quantity: z.coerce.number().int().positive('Quantity must be at least 1'),
      }),
    )
    .min(1, 'At least one product line is required'),
});

const listQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  search: z.string().trim().optional(),
  status: z.enum(['DRAFT', 'CONFIRMED', 'CANCELLED']).optional(),
  customerId: z.string().uuid().optional(),
});

/** GET /api/challans */
router.get(
  '/',
  validate(listQuery, 'query'),
  asyncHandler(async (req, res) => {
    const q = req.query as unknown as z.infer<typeof listQuery>;
    const { page, limit, skip, take } = parsePagination(q);

    const where: Prisma.SalesChallanWhereInput = {
      ...(q.status ? { status: q.status } : {}),
      ...(q.customerId ? { customerId: q.customerId } : {}),
      ...(q.search
        ? {
            OR: [
              { challanNumber: { contains: q.search, mode: 'insensitive' } },
              { customer: { name: { contains: q.search, mode: 'insensitive' } } },
              { customer: { mobile: { contains: q.search } } },
            ],
          }
        : {}),
    };

    const [rows, total] = await Promise.all([
      prisma.salesChallan.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: {
          customer: { select: { id: true, name: true, businessName: true, mobile: true } },
          createdBy: { select: { id: true, name: true } },
          _count: { select: { items: true } },
        },
      }),
      prisma.salesChallan.count({ where }),
    ]);

    return ok(res, rows, pageMeta(page, limit, total));
  }),
);

/** GET /api/challans/:id */
router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const challan = await prisma.salesChallan.findUnique({
      where: { id: req.params.id },
      include: {
        customer: true,
        createdBy: { select: { id: true, name: true, role: true } },
        items: { include: { product: { select: { id: true, currentStock: true } } } },
      },
    });
    if (!challan) throw ApiError.notFound('Challan not found');
    return ok(res, challan);
  }),
);

/**
 * POST /api/challans
 * Creates the challan, its snapshot line items, and — when the caller asks for
 * CONFIRMED directly — the stock reduction, all in a single transaction.
 */
router.post(
  '/',
  requireRole('SALES'),
  validate(challanBody),
  asyncHandler(async (req, res) => {
    const body = req.body as z.infer<typeof challanBody>;

    // Reject duplicate product lines up front — merging them silently would
    // hide a data-entry mistake from the user.
    const ids = body.items.map((i) => i.productId);
    if (new Set(ids).size !== ids.length) {
      throw ApiError.badRequest('The same product cannot be added twice — increase the quantity instead');
    }

    const challan = await prisma.$transaction(async (tx) => {
      const customer = await tx.customer.findUnique({ where: { id: body.customerId } });
      if (!customer) throw ApiError.notFound('Customer not found');

      const products = await tx.product.findMany({ where: { id: { in: ids } } });
      if (products.length !== ids.length) {
        const found = new Set(products.map((p) => p.id));
        throw ApiError.badRequest('One or more products do not exist', {
          missing: ids.filter((id) => !found.has(id)),
        });
      }

      const productById = new Map(products.map((p) => [p.id, p]));
      const items = body.items.map((line) => {
        const product = productById.get(line.productId)!;
        const unitPrice = new Prisma.Decimal(product.unitPrice);
        return {
          productId: product.id,
          productName: product.name, // <- snapshot: survives later renames
          productSku: product.sku,
          category: product.category,
          unitPrice,
          quantity: line.quantity,
          lineTotal: unitPrice.mul(line.quantity),
        };
      });

      const totalQuantity = items.reduce((sum, i) => sum + i.quantity, 0);
      const totalAmount = items.reduce(
        (sum, i) => sum.add(i.lineTotal),
        new Prisma.Decimal(0),
      );

      const record = await tx.salesChallan.create({
        data: {
          challanNumber: await nextChallanNumber(tx),
          customerId: customer.id,
          customerSnapshot: {
            name: customer.name,
            mobile: customer.mobile,
            email: customer.email,
            businessName: customer.businessName,
            gstNumber: customer.gstNumber,
            customerType: customer.customerType,
            address: [customer.addressLine, customer.city, customer.state, customer.pincode]
              .filter(Boolean)
              .join(', '),
          },
          status: body.status,
          notes: body.notes,
          totalQuantity,
          totalAmount,
          createdById: req.user!.id,
          items: { create: items },
          ...(body.status === 'CONFIRMED' ? { confirmedAt: new Date() } : {}),
        },
        include: { items: true, customer: true },
      });

      if (body.status === 'CONFIRMED') {
        // The line items are already in memory — no need to read them back.
        await reduceStockForChallan(tx, record.id, req.user!.id, record.items);
      }
      return record;
    }, TX_OPTIONS);

    return created(res, challan);
  }),
);

/** PUT /api/challans/:id — drafts only; a confirmed document is immutable. */
router.put(
  '/:id',
  requireRole('SALES'),
  validate(challanBody.omit({ customerId: true, status: true }).partial()),
  asyncHandler(async (req, res) => {
    const body = req.body as Partial<z.infer<typeof challanBody>>;

    const challan = await prisma.$transaction(async (tx) => {
      const existing = await tx.salesChallan.findUnique({ where: { id: req.params.id } });
      if (!existing) throw ApiError.notFound('Challan not found');
      if (existing.status !== ChallanStatus.DRAFT) {
        throw ApiError.conflict(
          `Only draft challans can be edited. This challan is ${existing.status}.`,
        );
      }

      if (body.items?.length) {
        const ids = body.items.map((i) => i.productId);
        const products = await tx.product.findMany({ where: { id: { in: ids } } });
        const productById = new Map(products.map((p) => [p.id, p]));
        if (products.length !== new Set(ids).size) {
          throw ApiError.badRequest('One or more products do not exist');
        }

        const items = body.items.map((line) => {
          const product = productById.get(line.productId)!;
          const unitPrice = new Prisma.Decimal(product.unitPrice);
          return {
            productId: product.id,
            productName: product.name,
            productSku: product.sku,
            category: product.category,
            unitPrice,
            quantity: line.quantity,
            lineTotal: unitPrice.mul(line.quantity),
          };
        });

        await tx.challanItem.deleteMany({ where: { challanId: existing.id } });
        await tx.salesChallan.update({
          where: { id: existing.id },
          data: {
            totalQuantity: items.reduce((s, i) => s + i.quantity, 0),
            totalAmount: items.reduce((s, i) => s.add(i.lineTotal), new Prisma.Decimal(0)),
            items: { create: items },
          },
        });
      }

      return tx.salesChallan.update({
        where: { id: existing.id },
        data: { ...(body.notes !== undefined ? { notes: body.notes } : {}) },
        include: { items: true, customer: true },
      });
    }, TX_OPTIONS);

    return ok(res, challan);
  }),
);

/** POST /api/challans/:id/confirm — draft -> confirmed, reduces stock */
router.post(
  '/:id/confirm',
  requireRole('SALES', 'WAREHOUSE'),
  asyncHandler(async (req, res) => {
    const challan = await prisma.$transaction(async (tx) => {
      const existing = await tx.salesChallan.findUnique({ where: { id: req.params.id } });
      if (!existing) throw ApiError.notFound('Challan not found');
      if (existing.status === ChallanStatus.CONFIRMED) {
        throw ApiError.conflict('This challan is already confirmed');
      }
      if (existing.status === ChallanStatus.CANCELLED) {
        throw ApiError.conflict('A cancelled challan cannot be confirmed');
      }

      const items = await tx.challanItem.findMany({ where: { challanId: existing.id } });
      await reduceStockForChallan(tx, existing.id, req.user!.id, items);

      return tx.salesChallan.update({
        where: { id: existing.id },
        data: { status: ChallanStatus.CONFIRMED, confirmedAt: new Date() },
        include: { items: true, customer: true },
      });
    }, TX_OPTIONS);

    return ok(res, challan);
  }),
);

/** POST /api/challans/:id/cancel — returns stock if it had been confirmed */
router.post(
  '/:id/cancel',
  requireRole('SALES', 'WAREHOUSE'),
  asyncHandler(async (req, res) => {
    const challan = await prisma.$transaction(async (tx) => {
      const existing = await tx.salesChallan.findUnique({ where: { id: req.params.id } });
      if (!existing) throw ApiError.notFound('Challan not found');
      if (existing.status === ChallanStatus.CANCELLED) {
        throw ApiError.conflict('This challan is already cancelled');
      }

      // Only a confirmed challan consumed stock, so only that case returns it.
      if (existing.status === ChallanStatus.CONFIRMED) {
        const items = await tx.challanItem.findMany({ where: { challanId: existing.id } });
        await restoreStockForChallan(tx, existing.id, req.user!.id, items);
      }

      return tx.salesChallan.update({
        where: { id: existing.id },
        data: { status: ChallanStatus.CANCELLED, cancelledAt: new Date() },
        include: { items: true, customer: true },
      });
    }, TX_OPTIONS);

    return ok(res, challan);
  }),
);

export default router;
