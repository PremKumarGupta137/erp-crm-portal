/**
 * Seeds a demo dataset: one user per role, a spread of customers across
 * lead/active/inactive, a product catalogue with a couple of deliberately
 * low-stock items, and challans in each status so the UI has something to show.
 *
 * Safe to re-run: everything is upserted or keyed off a stable SKU/email.
 */
import { PrismaClient, Prisma } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const USERS = [
  { name: 'Aarav Mehta', email: 'admin@erpcrm.com', role: 'ADMIN' as const, password: 'Admin@123' },
  { name: 'Priya Sharma', email: 'sales@erpcrm.com', role: 'SALES' as const, password: 'Sales@123' },
  { name: 'Rohit Verma', email: 'warehouse@erpcrm.com', role: 'WAREHOUSE' as const, password: 'Warehouse@123' },
  { name: 'Neha Gupta', email: 'accounts@erpcrm.com', role: 'ACCOUNTS' as const, password: 'Accounts@123' },
];

const PRODUCTS = [
  { name: 'Sunflower Oil 1L Pouch', sku: 'OIL-SF-1L', category: 'Edible Oil', unitPrice: 142.5, currentStock: 480, minStockAlert: 100, location: 'Rack A1' },
  { name: 'Basmati Rice 5kg Bag', sku: 'RICE-BAS-5KG', category: 'Staples', unitPrice: 610.0, currentStock: 220, minStockAlert: 60, location: 'Rack B2' },
  { name: 'Wheat Atta 10kg', sku: 'ATTA-WHT-10KG', category: 'Staples', unitPrice: 395.0, currentStock: 45, minStockAlert: 50, location: 'Rack B3' },
  { name: 'Toor Dal 1kg', sku: 'DAL-TOOR-1KG', category: 'Pulses', unitPrice: 168.0, currentStock: 310, minStockAlert: 80, location: 'Rack C1' },
  { name: 'Detergent Powder 2kg', sku: 'CLN-DET-2KG', category: 'Home Care', unitPrice: 232.0, currentStock: 18, minStockAlert: 40, location: 'Rack D4' },
  { name: 'Dish Wash Gel 750ml', sku: 'CLN-DWG-750', category: 'Home Care', unitPrice: 118.0, currentStock: 265, minStockAlert: 60, location: 'Rack D2' },
  { name: 'Tea Leaves 500g', sku: 'BEV-TEA-500', category: 'Beverages', unitPrice: 245.0, currentStock: 190, minStockAlert: 50, location: 'Rack E1' },
  { name: 'Instant Coffee 200g', sku: 'BEV-COF-200', category: 'Beverages', unitPrice: 410.0, currentStock: 72, minStockAlert: 30, location: 'Rack E2' },
  { name: 'Biscuit Family Pack', sku: 'SNK-BIS-FAM', category: 'Snacks', unitPrice: 85.0, currentStock: 540, minStockAlert: 120, location: 'Rack F1' },
  { name: 'Refined Salt 1kg', sku: 'STP-SALT-1KG', category: 'Staples', unitPrice: 24.0, currentStock: 900, minStockAlert: 200, location: 'Rack B1' },
];

const CUSTOMERS = [
  { name: 'Suresh Kumar', mobile: '9876543210', email: 'suresh@shreetraders.in', businessName: 'Shree Traders', gstNumber: '27AABCS1429B1ZQ', customerType: 'DISTRIBUTOR' as const, addressLine: '14 MG Road', city: 'Pune', state: 'Maharashtra', pincode: '411001', status: 'ACTIVE' as const, notes: 'Largest distributor in the west zone. Credit period 30 days.' },
  { name: 'Meena Patel', mobile: '9823001122', email: 'meena@patelstores.com', businessName: 'Patel Super Stores', gstNumber: '24AAACP2233C1Z5', customerType: 'WHOLESALE' as const, addressLine: 'Shop 8, Ring Road', city: 'Surat', state: 'Gujarat', pincode: '395002', status: 'ACTIVE' as const, notes: 'Prefers delivery before 11am.' },
  { name: 'Imran Shaikh', mobile: '9812345566', email: null, businessName: 'Shaikh Kirana', gstNumber: null, customerType: 'RETAIL' as const, addressLine: 'Lane 3, Camp Area', city: 'Nagpur', state: 'Maharashtra', pincode: '440001', status: 'LEAD' as const, notes: 'Walked in at the trade expo. Wants a sample price list.' },
  { name: 'Lakshmi Iyer', mobile: '9445566778', email: 'lakshmi@iyermart.co.in', businessName: 'Iyer Mart', gstNumber: '33AAFCI9988D1ZP', customerType: 'WHOLESALE' as const, addressLine: '22 Anna Salai', city: 'Chennai', state: 'Tamil Nadu', pincode: '600002', status: 'ACTIVE' as const, notes: 'Orders every alternate Monday.' },
  { name: 'Harpreet Singh', mobile: '9988776655', email: 'harpreet@singhdist.in', businessName: 'Singh Distributors', gstNumber: '03AAJCS4455E1ZL', customerType: 'DISTRIBUTOR' as const, addressLine: 'Plot 45, Focal Point', city: 'Ludhiana', state: 'Punjab', pincode: '141010', status: 'LEAD' as const, notes: 'Negotiating slab pricing for bulk oil.' },
  { name: 'Anita Desai', mobile: '9701234567', email: 'anita.desai@gmail.com', businessName: 'Desai Provision', gstNumber: null, customerType: 'RETAIL' as const, addressLine: 'Beside Bus Stand', city: 'Hyderabad', state: 'Telangana', pincode: '500001', status: 'INACTIVE' as const, notes: 'No orders in the last 6 months. Needs a win-back call.' },
  { name: 'Rajesh Nair', mobile: '9847011223', email: 'rajesh@nairagencies.com', businessName: 'Nair Agencies', gstNumber: '32AACCN7788F1ZR', customerType: 'WHOLESALE' as const, addressLine: 'MG Road', city: 'Kochi', state: 'Kerala', pincode: '682011', status: 'ACTIVE' as const, notes: 'Always asks for extra promo stock.' },
  { name: 'Vikram Rathore', mobile: '9314567890', email: null, businessName: 'Rathore Bhandar', gstNumber: null, customerType: 'RETAIL' as const, addressLine: 'Johari Bazaar', city: 'Jaipur', state: 'Rajasthan', pincode: '302003', status: 'LEAD' as const, notes: 'Referred by Shree Traders.' },
];

function daysFromNow(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(10, 0, 0, 0);
  return d;
}

async function main() {
  console.log('Seeding database…');

  // ---------- users ----------
  const users: Record<string, string> = {};
  for (const u of USERS) {
    const passwordHash = await bcrypt.hash(u.password, 10);
    const user = await prisma.user.upsert({
      where: { email: u.email },
      update: { name: u.name, role: u.role, passwordHash },
      create: { name: u.name, email: u.email, role: u.role, passwordHash },
    });
    users[u.role] = user.id;
  }
  console.log(`  users: ${USERS.length}`);

  // ---------- products ----------
  const productIds: Record<string, string> = {};
  for (const p of PRODUCTS) {
    const product = await prisma.product.upsert({
      where: { sku: p.sku },
      update: { ...p, unitPrice: new Prisma.Decimal(p.unitPrice) },
      create: { ...p, unitPrice: new Prisma.Decimal(p.unitPrice) },
    });
    productIds[p.sku] = product.id;

    const hasOpening = await prisma.stockMovement.findFirst({
      where: { productId: product.id, referenceType: 'PRODUCT_CREATE' },
    });
    if (!hasOpening) {
      await prisma.stockMovement.create({
        data: {
          productId: product.id,
          quantity: p.currentStock,
          type: 'IN',
          reason: 'Opening stock',
          referenceType: 'PRODUCT_CREATE',
          referenceId: product.id,
          createdById: users.WAREHOUSE,
        },
      });
    }
  }
  console.log(`  products: ${PRODUCTS.length}`);

  // ---------- customers ----------
  const customerIds: string[] = [];
  for (const [index, c] of CUSTOMERS.entries()) {
    const existing = await prisma.customer.findFirst({ where: { mobile: c.mobile } });
    const data = {
      ...c,
      followUpDate: index % 2 === 0 ? daysFromNow(index - 2) : null,
      createdById: users.SALES,
    };
    const customer = existing
      ? await prisma.customer.update({ where: { id: existing.id }, data })
      : await prisma.customer.create({ data });
    customerIds.push(customer.id);

    const noteCount = await prisma.followUp.count({ where: { customerId: customer.id } });
    if (noteCount === 0 && index < 4) {
      await prisma.followUp.createMany({
        data: [
          {
            customerId: customer.id,
            note: 'Introductory call done. Shared the current rate list over WhatsApp.',
            followUpDate: daysFromNow(index + 3),
            createdById: users.SALES,
          },
          {
            customerId: customer.id,
            note: 'Asked for a revised quote on staples. Awaiting confirmation.',
            followUpDate: daysFromNow(index + 7),
            createdById: users.SALES,
          },
        ],
      });
    }
  }
  console.log(`  customers: ${CUSTOMERS.length}`);

  // ---------- challans ----------
  const existingChallans = await prisma.salesChallan.count();
  if (existingChallans === 0) {
    const year = new Date().getFullYear();
    const plans = [
      {
        customerIndex: 0,
        status: 'CONFIRMED' as const,
        lines: [
          { sku: 'OIL-SF-1L', qty: 40 },
          { sku: 'RICE-BAS-5KG', qty: 12 },
        ],
      },
      {
        customerIndex: 1,
        status: 'CONFIRMED' as const,
        lines: [
          { sku: 'DAL-TOOR-1KG', qty: 25 },
          { sku: 'STP-SALT-1KG', qty: 60 },
          { sku: 'SNK-BIS-FAM', qty: 30 },
        ],
      },
      {
        customerIndex: 3,
        status: 'DRAFT' as const,
        lines: [
          { sku: 'BEV-TEA-500', qty: 20 },
          { sku: 'BEV-COF-200', qty: 10 },
        ],
      },
      {
        customerIndex: 6,
        status: 'CANCELLED' as const,
        lines: [{ sku: 'CLN-DWG-750', qty: 15 }],
      },
    ];

    for (const [i, plan] of plans.entries()) {
      const customer = await prisma.customer.findUnique({ where: { id: customerIds[plan.customerIndex] } });
      if (!customer) continue;

      const items = [] as Prisma.ChallanItemCreateWithoutChallanInput[];
      for (const line of plan.lines) {
        const product = await prisma.product.findUnique({ where: { sku: line.sku } });
        if (!product) continue;
        const unitPrice = new Prisma.Decimal(product.unitPrice);
        items.push({
          product: { connect: { id: product.id } },
          productName: product.name,
          productSku: product.sku,
          category: product.category,
          unitPrice,
          quantity: line.qty,
          lineTotal: unitPrice.mul(line.qty),
        });
      }

      const challan = await prisma.salesChallan.create({
        data: {
          challanNumber: `CHL-${year}-${String(i + 1).padStart(4, '0')}`,
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
          status: plan.status,
          totalQuantity: items.reduce((s, it) => s + it.quantity, 0),
          totalAmount: items.reduce((s, it) => s.add(it.lineTotal as Prisma.Decimal), new Prisma.Decimal(0)),
          notes: plan.status === 'CANCELLED' ? 'Customer cancelled before dispatch.' : undefined,
          confirmedAt: plan.status === 'CONFIRMED' ? new Date() : undefined,
          cancelledAt: plan.status === 'CANCELLED' ? new Date() : undefined,
          createdById: users.SALES,
          items: { create: items },
        },
        include: { items: true },
      });

      // Only confirmed challans actually moved stock.
      if (plan.status === 'CONFIRMED') {
        for (const item of challan.items) {
          await prisma.product.update({
            where: { id: item.productId },
            data: { currentStock: { decrement: item.quantity } },
          });
          await prisma.stockMovement.create({
            data: {
              productId: item.productId,
              quantity: item.quantity,
              type: 'OUT',
              reason: 'Sales challan confirmed',
              referenceType: 'CHALLAN',
              referenceId: challan.id,
              createdById: users.SALES,
            },
          });
        }
      }
    }

    // Keep the number generator in sync with what we just inserted.
    await prisma.counter.upsert({
      where: { key: `challan:${year}` },
      create: { key: `challan:${year}`, value: plans.length },
      update: { value: plans.length },
    });
    console.log(`  challans: ${plans.length}`);
  } else {
    console.log(`  challans: skipped (${existingChallans} already present)`);
  }

  console.log('\nSeed complete. Login credentials:');
  for (const u of USERS) console.log(`  ${u.role.padEnd(10)} ${u.email.padEnd(26)} ${u.password}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
