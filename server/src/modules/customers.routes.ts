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

const optionalString = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v === '' ? undefined : v));

const customerBody = z.object({
  name: z.string().trim().min(2, 'Customer name must be at least 2 characters').max(120),
  mobile: z
    .string()
    .trim()
    .regex(/^[0-9+\-\s]{7,15}$/, 'Mobile number must be 7-15 digits'),
  email: z.string().trim().email('Invalid email').optional().or(z.literal('')),
  businessName: optionalString,
  gstNumber: optionalString,
  customerType: z.enum(['RETAIL', 'WHOLESALE', 'DISTRIBUTOR']).default('RETAIL'),
  addressLine: optionalString,
  city: optionalString,
  state: optionalString,
  pincode: optionalString,
  status: z.enum(['LEAD', 'ACTIVE', 'INACTIVE']).default('LEAD'),
  followUpDate: z.coerce.date().optional().nullable(),
  notes: optionalString,
});

const listQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  search: z.string().trim().optional(),
  status: z.enum(['LEAD', 'ACTIVE', 'INACTIVE']).optional(),
  customerType: z.enum(['RETAIL', 'WHOLESALE', 'DISTRIBUTOR']).optional(),
  sort: z.enum(['createdAt', 'name', 'followUpDate']).default('createdAt'),
  order: z.enum(['asc', 'desc']).default('desc'),
});

/** GET /api/customers — paginated, searchable, filterable */
router.get(
  '/',
  validate(listQuery, 'query'),
  asyncHandler(async (req, res) => {
    const q = req.query as unknown as z.infer<typeof listQuery>;
    const { page, limit, skip, take } = parsePagination(q);

    const where: Prisma.CustomerWhereInput = {
      ...(q.status ? { status: q.status } : {}),
      ...(q.customerType ? { customerType: q.customerType } : {}),
      ...(q.search
        ? {
            OR: [
              { name: { contains: q.search, mode: 'insensitive' } },
              { mobile: { contains: q.search } },
              { businessName: { contains: q.search, mode: 'insensitive' } },
              { email: { contains: q.search, mode: 'insensitive' } },
              { gstNumber: { contains: q.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [rows, total] = await Promise.all([
      prisma.customer.findMany({
        where,
        skip,
        take,
        orderBy: { [q.sort]: q.order },
        include: {
          createdBy: { select: { id: true, name: true } },
          _count: { select: { followUps: true, challans: true } },
        },
      }),
      prisma.customer.count({ where }),
    ]);

    return ok(res, rows, pageMeta(page, limit, total));
  }),
);

/** GET /api/customers/:id — detail with follow-up history and recent challans */
router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const customer = await prisma.customer.findUnique({
      where: { id: req.params.id },
      include: {
        createdBy: { select: { id: true, name: true } },
        followUps: {
          orderBy: { createdAt: 'desc' },
          include: { createdBy: { select: { id: true, name: true } } },
        },
        challans: {
          orderBy: { createdAt: 'desc' },
          take: 10,
          select: {
            id: true,
            challanNumber: true,
            status: true,
            totalQuantity: true,
            totalAmount: true,
            createdAt: true,
          },
        },
      },
    });
    if (!customer) throw ApiError.notFound('Customer not found');
    return ok(res, customer);
  }),
);

/** POST /api/customers */
router.post(
  '/',
  requireRole('SALES'),
  validate(customerBody),
  asyncHandler(async (req, res) => {
    const body = req.body as z.infer<typeof customerBody>;
    const customer = await prisma.customer.create({
      data: {
        ...body,
        email: body.email || null,
        createdById: req.user!.id,
      },
    });
    return created(res, customer);
  }),
);

/** PUT /api/customers/:id */
router.put(
  '/:id',
  requireRole('SALES'),
  validate(customerBody.partial()),
  asyncHandler(async (req, res) => {
    const exists = await prisma.customer.findUnique({ where: { id: req.params.id } });
    if (!exists) throw ApiError.notFound('Customer not found');

    const body = req.body as Partial<z.infer<typeof customerBody>>;
    const customer = await prisma.customer.update({
      where: { id: req.params.id },
      data: { ...body, ...(body.email !== undefined ? { email: body.email || null } : {}) },
    });
    return ok(res, customer);
  }),
);

/** POST /api/customers/:id/follow-ups — append a CRM note */
router.post(
  '/:id/follow-ups',
  requireRole('SALES'),
  validate(
    z.object({
      note: z.string().trim().min(2, 'Note cannot be empty').max(1000),
      followUpDate: z.coerce.date().optional().nullable(),
      status: z.enum(['LEAD', 'ACTIVE', 'INACTIVE']).optional(),
    }),
  ),
  asyncHandler(async (req, res) => {
    const { note, followUpDate, status } = req.body as {
      note: string;
      followUpDate?: Date | null;
      status?: 'LEAD' | 'ACTIVE' | 'INACTIVE';
    };

    const customer = await prisma.customer.findUnique({ where: { id: req.params.id } });
    if (!customer) throw ApiError.notFound('Customer not found');

    // Writing the note and rolling the customer's next follow-up date forward
    // has to be one unit of work, otherwise the timeline and the card disagree.
    const followUp = await prisma.$transaction(async (tx) => {
      const record = await tx.followUp.create({
        data: { customerId: customer.id, note, followUpDate, createdById: req.user!.id },
        include: { createdBy: { select: { id: true, name: true } } },
      });
      if (followUpDate !== undefined || status) {
        await tx.customer.update({
          where: { id: customer.id },
          data: {
            ...(followUpDate !== undefined ? { followUpDate } : {}),
            ...(status ? { status } : {}),
          },
        });
      }
      return record;
    });

    return created(res, followUp);
  }),
);

export default router;
