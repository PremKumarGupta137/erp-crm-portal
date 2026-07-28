import { Prisma } from '@prisma/client';
import { Router } from 'express';
import { z } from 'zod';
import { authenticate, requireRole } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { prisma } from '../prisma';
import { ApiError } from '../utils/ApiError';
import { asyncHandler, created, ok, pageMeta, parsePagination } from '../utils/http';

const router = Router();
router.use(authenticate);

/** Prisma's 5s default is too tight for multi-statement writes to a remote DB. */
const TX_OPTIONS = { maxWait: 15_000, timeout: 30_000 };

const productBody = z.object({
  name: z.string().trim().min(2, 'Product name must be at least 2 characters').max(140),
  sku: z
    .string()
    .trim()
    .min(2)
    .max(40)
    .regex(/^[A-Za-z0-9\-_]+$/, 'SKU may only contain letters, numbers, - and _')
    .transform((v) => v.toUpperCase()),
  category: z.string().trim().min(1, 'Category is required').max(60),
  unitPrice: z.coerce.number().nonnegative('Unit price cannot be negative'),
  currentStock: z.coerce.number().int().min(0, 'Stock cannot be negative').default(0),
  minStockAlert: z.coerce.number().int().min(0).default(0),
  location: z.string().trim().max(80).optional(),
  isActive: z.boolean().default(true),
});

const listQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  search: z.string().trim().optional(),
  category: z.string().trim().optional(),
  lowStock: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => v === 'true'),
  sort: z.enum(['createdAt', 'name', 'currentStock', 'unitPrice']).default('createdAt'),
  order: z.enum(['asc', 'desc']).default('desc'),
});

/** GET /api/products */
router.get(
  '/',
  validate(listQuery, 'query'),
  asyncHandler(async (req, res) => {
    const q = req.query as unknown as z.infer<typeof listQuery>;
    const { page, limit, skip, take } = parsePagination(q);

    const where: Prisma.ProductWhereInput = {
      ...(q.category ? { category: q.category } : {}),
      ...(q.search
        ? {
            OR: [
              { name: { contains: q.search, mode: 'insensitive' } },
              { sku: { contains: q.search, mode: 'insensitive' } },
              { category: { contains: q.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [rows, total] = await Promise.all([
      prisma.product.findMany({ where, skip, take, orderBy: { [q.sort]: q.order } }),
      prisma.product.count({ where }),
    ]);

    // Prisma cannot compare two columns in a `where`, so the low-stock filter is
    // applied after fetching. Documented as a known limitation in the README.
    const data = q.lowStock ? rows.filter((p) => p.currentStock <= p.minStockAlert) : rows;

    return ok(res, data, pageMeta(page, limit, total));
  }),
);

/** GET /api/products/categories — used to populate filter dropdowns */
router.get(
  '/categories',
  asyncHandler(async (_req, res) => {
    const rows = await prisma.product.findMany({
      distinct: ['category'],
      select: { category: true },
      orderBy: { category: 'asc' },
    });
    return ok(res, rows.map((r) => r.category));
  }),
);

/** GET /api/products/:id — product with its stock movement ledger */
router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const product = await prisma.product.findUnique({
      where: { id: req.params.id },
      include: {
        stockMovements: {
          orderBy: { createdAt: 'desc' },
          take: 50,
          include: { createdBy: { select: { id: true, name: true } } },
        },
      },
    });
    if (!product) throw ApiError.notFound('Product not found');
    return ok(res, product);
  }),
);

/** POST /api/products */
router.post(
  '/',
  requireRole('WAREHOUSE'),
  validate(productBody),
  asyncHandler(async (req, res) => {
    const body = req.body as z.infer<typeof productBody>;

    // Opening stock is a real stock event, so it gets a ledger entry too.
    const product = await prisma.$transaction(async (tx) => {
      const p = await tx.product.create({ data: body });
      if (body.currentStock > 0) {
        await tx.stockMovement.create({
          data: {
            productId: p.id,
            quantity: body.currentStock,
            type: 'IN',
            reason: 'Opening stock',
            referenceType: 'PRODUCT_CREATE',
            referenceId: p.id,
            createdById: req.user!.id,
          },
        });
      }
      return p;
    }, TX_OPTIONS);

    return created(res, product);
  }),
);

/** PUT /api/products/:id — note: stock is deliberately NOT editable here */
router.put(
  '/:id',
  requireRole('WAREHOUSE'),
  validate(productBody.omit({ currentStock: true }).partial()),
  asyncHandler(async (req, res) => {
    const exists = await prisma.product.findUnique({ where: { id: req.params.id } });
    if (!exists) throw ApiError.notFound('Product not found');

    const product = await prisma.product.update({
      where: { id: req.params.id },
      data: req.body as Prisma.ProductUpdateInput,
    });
    return ok(res, product);
  }),
);

/**
 * POST /api/products/:id/stock — the only way to change stock by hand.
 * Both the balance and the ledger entry are written in one transaction.
 */
router.post(
  '/:id/stock',
  requireRole('WAREHOUSE'),
  validate(
    z.object({
      type: z.enum(['IN', 'OUT']),
      quantity: z.coerce.number().int().positive('Quantity must be greater than zero'),
      reason: z.string().trim().min(2, 'A reason is required').max(200),
    }),
  ),
  asyncHandler(async (req, res) => {
    const { type, quantity, reason } = req.body as {
      type: 'IN' | 'OUT';
      quantity: number;
      reason: string;
    };

    const result = await prisma.$transaction(async (tx) => {
      const product = await tx.product.findUnique({ where: { id: req.params.id } });
      if (!product) throw ApiError.notFound('Product not found');

      const delta = type === 'IN' ? quantity : -quantity;
      if (product.currentStock + delta < 0) {
        throw ApiError.unprocessable(
          `Insufficient stock for ${product.name}. Available: ${product.currentStock}, requested: ${quantity}`,
          { productId: product.id, available: product.currentStock, requested: quantity },
        );
      }

      const updated = await tx.product.update({
        where: { id: product.id },
        data: { currentStock: { increment: delta } },
      });
      const movement = await tx.stockMovement.create({
        data: {
          productId: product.id,
          quantity,
          type,
          reason,
          referenceType: 'MANUAL_ADJUSTMENT',
          createdById: req.user!.id,
        },
      });
      return { product: updated, movement };
    }, TX_OPTIONS);

    return created(res, result);
  }),
);

/** GET /api/products/movements/all — global stock movement ledger */
router.get(
  '/movements/all',
  validate(
    z.object({
      page: z.coerce.number().int().min(1).default(1),
      limit: z.coerce.number().int().min(1).max(100).default(20),
      type: z.enum(['IN', 'OUT']).optional(),
      productId: z.string().optional(),
    }),
    'query',
  ),
  asyncHandler(async (req, res) => {
    const q = req.query as unknown as { page: number; limit: number; type?: 'IN' | 'OUT'; productId?: string };
    const { page, limit, skip, take } = parsePagination(q);

    const where: Prisma.StockMovementWhereInput = {
      ...(q.type ? { type: q.type } : {}),
      ...(q.productId ? { productId: q.productId } : {}),
    };

    const [rows, total] = await Promise.all([
      prisma.stockMovement.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: {
          product: { select: { id: true, name: true, sku: true } },
          createdBy: { select: { id: true, name: true } },
        },
      }),
      prisma.stockMovement.count({ where }),
    ]);

    return ok(res, rows, pageMeta(page, limit, total));
  }),
);

export default router;
