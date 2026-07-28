import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { prisma } from '../prisma';
import { asyncHandler, ok } from '../utils/http';

const router = Router();
router.use(authenticate);

/** GET /api/dashboard/summary — headline counters for the landing page */
router.get(
  '/summary',
  asyncHandler(async (_req, res) => {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const endOfToday = new Date(startOfToday);
    endOfToday.setDate(endOfToday.getDate() + 1);

    const [
      customerCount,
      activeCustomers,
      leadCount,
      productCount,
      challanCount,
      draftChallans,
      confirmedAgg,
      followUpsDue,
      products,
      recentChallans,
      recentMovements,
    ] = await Promise.all([
      prisma.customer.count(),
      prisma.customer.count({ where: { status: 'ACTIVE' } }),
      prisma.customer.count({ where: { status: 'LEAD' } }),
      prisma.product.count(),
      prisma.salesChallan.count(),
      prisma.salesChallan.count({ where: { status: 'DRAFT' } }),
      prisma.salesChallan.aggregate({
        where: { status: 'CONFIRMED' },
        _sum: { totalAmount: true, totalQuantity: true },
        _count: true,
      }),
      prisma.customer.count({ where: { followUpDate: { lt: endOfToday } , status: { not: 'INACTIVE' } } }),
      prisma.product.findMany({ select: { id: true, name: true, sku: true, currentStock: true, minStockAlert: true, location: true } }),
      prisma.salesChallan.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: { customer: { select: { name: true, businessName: true } } },
      }),
      prisma.stockMovement.findMany({
        take: 8,
        orderBy: { createdAt: 'desc' },
        include: {
          product: { select: { name: true, sku: true } },
          createdBy: { select: { name: true } },
        },
      }),
    ]);

    const lowStock = products.filter((p) => p.currentStock <= p.minStockAlert);
    const inventoryUnits = products.reduce((sum, p) => sum + p.currentStock, 0);

    return ok(res, {
      customers: { total: customerCount, active: activeCustomers, leads: leadCount },
      products: { total: productCount, lowStockCount: lowStock.length, inventoryUnits },
      challans: {
        total: challanCount,
        draft: draftChallans,
        confirmed: confirmedAgg._count,
        confirmedValue: confirmedAgg._sum.totalAmount ?? 0,
        confirmedUnits: confirmedAgg._sum.totalQuantity ?? 0,
      },
      followUpsDue,
      lowStockProducts: lowStock.slice(0, 8),
      recentChallans,
      recentMovements,
    });
  }),
);

export default router;
