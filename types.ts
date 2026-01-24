
export enum UserRole {
  DEV_ADMIN = 'DEV_ADMIN',
  SUPER_ADMIN = 'SUPER_ADMIN', // Tenant Owner
  ADMIN = 'ADMIN' // Tenant Employee
}

export enum OrderStatus {
  PENDING = 'PENDING',
  OPEN_LEAD = 'OPEN_LEAD',
  NO_ANSWER = 'NO_ANSWER',
  REJECTED = 'REJECTED',
  HOLD = 'HOLD',
  CONFIRMED = 'CONFIRMED',
  SHIPPED = 'SHIPPED',
  DELIVERY = 'DELIVERY',
  RESIDUAL = 'RESIDUAL',
  RETURNED = 'RETURNED', 
  DELIVERED = 'DELIVERED',
  RETURN_COMPLETED = 'RETURN_COMPLETED'
}

export enum CustomerStatus {
  NEW = 'NEW',
  REGULAR = 'REGULAR',
  RISK_ORANGE = 'RISK_ORANGE',
  RISK_RED = 'RISK_RED'
}

export interface DomainRecord {
  host: string;
  type: 'CNAME' | 'A';
  isActive: boolean;
}

export interface Tenant {
  id: string;
  name: string;
  mongoUri: string;
  isActive: boolean;
  domain?: string; 
  domainRecords?: DomainRecord[]; // Advanced domain management
  settings: TenantSettings;
}

export interface TenantSettings {
  shopName: string;
  logoUrl?: string;
  shopAddress: string;
  shopPhone: string;
  courierApiKey: string;
  courierApiUrl: string;
  courierClientId: string;
  showBillQr: boolean;
}

export interface User {
  id: string;
  username: string;
  email?: string;
  role: UserRole;
  tenantId?: string;
  permissions?: string[];
}

export interface StockBatch {
  id: string;
  quantity: number;
  buyingPrice: number;
  createdAt: string;
}

export interface Product {
  id: string;
  tenantId: string;
  sku: string;
  name: string;
  price: number;
  batches: StockBatch[];
  stock?: number;
}

export interface OrderLog {
  id: string;
  message: string;
  timestamp: string;
  user: string;
}

export interface Order {
  id: string;
  tenantId: string;
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  customerCity?: string;
  parcelWeight?: string;
  parcelDescription?: string;
  items: { productId: string; quantity: number; price: number; name: string }[];
  totalAmount: number;
  status: OrderStatus;
  createdAt: string;
  shippedAt?: string; 
  trackingNumber?: string;
  courierStatus?: string;
  isPrinted: boolean;
  openedBy?: string;
  logs?: OrderLog[];
}
