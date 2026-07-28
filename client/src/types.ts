export type Role = 'ADMIN' | 'SALES' | 'WAREHOUSE' | 'ACCOUNTS';
export type CustomerType = 'RETAIL' | 'WHOLESALE' | 'DISTRIBUTOR';
export type CustomerStatus = 'LEAD' | 'ACTIVE' | 'INACTIVE';
export type MovementType = 'IN' | 'OUT';
export type ChallanStatus = 'DRAFT' | 'CONFIRMED' | 'CANCELLED';

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  isActive?: boolean;
  createdAt?: string;
}

export interface Customer {
  id: string;
  name: string;
  mobile: string;
  email: string | null;
  businessName: string | null;
  gstNumber: string | null;
  customerType: CustomerType;
  addressLine: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  status: CustomerStatus;
  followUpDate: string | null;
  notes: string | null;
  createdAt: string;
  createdBy?: { id: string; name: string } | null;
  _count?: { followUps: number; challans: number };
  followUps?: FollowUp[];
  challans?: ChallanSummary[];
}

export interface FollowUp {
  id: string;
  note: string;
  followUpDate: string | null;
  createdAt: string;
  createdBy?: { id: string; name: string } | null;
}

export interface Product {
  id: string;
  name: string;
  sku: string;
  category: string;
  unitPrice: string;
  currentStock: number;
  minStockAlert: number;
  location: string | null;
  isActive: boolean;
  createdAt: string;
  stockMovements?: StockMovement[];
}

export interface StockMovement {
  id: string;
  quantity: number;
  type: MovementType;
  reason: string;
  referenceType: string | null;
  referenceId: string | null;
  createdAt: string;
  product?: { id: string; name: string; sku: string };
  createdBy?: { id: string; name: string } | null;
}

export interface ChallanItem {
  id: string;
  productId: string;
  productName: string;
  productSku: string;
  category: string | null;
  unitPrice: string;
  quantity: number;
  lineTotal: string;
  product?: { id: string; currentStock: number };
}

export interface ChallanSummary {
  id: string;
  challanNumber: string;
  status: ChallanStatus;
  totalQuantity: number;
  totalAmount: string;
  createdAt: string;
}

export interface Challan extends ChallanSummary {
  customerId: string;
  customerSnapshot: {
    name: string;
    mobile: string;
    email: string | null;
    businessName: string | null;
    gstNumber: string | null;
    customerType: CustomerType;
    address: string;
  };
  notes: string | null;
  confirmedAt: string | null;
  cancelledAt: string | null;
  customer?: Customer & { name: string; businessName: string | null; mobile: string };
  createdBy?: { id: string; name: string; role: Role } | null;
  items: ChallanItem[];
  _count?: { items: number };
}

export interface DashboardSummary {
  customers: { total: number; active: number; leads: number };
  products: { total: number; lowStockCount: number; inventoryUnits: number };
  challans: {
    total: number;
    draft: number;
    confirmed: number;
    confirmedValue: string | number;
    confirmedUnits: number;
  };
  followUpsDue: number;
  lowStockProducts: Pick<Product, 'id' | 'name' | 'sku' | 'currentStock' | 'minStockAlert' | 'location'>[];
  recentChallans: (ChallanSummary & { customer: { name: string; businessName: string | null } })[];
  recentMovements: StockMovement[];
}
