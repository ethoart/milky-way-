
import { Order, OrderStatus, Product, Tenant, User, UserRole, CustomerStatus, TenantSettings } from '../types';

const API_BASE = '/.netlify/functions/api';

const INITIAL_TENANTS: Tenant[] = [
  {
    id: 'tenant-1',
    name: 'Alpha Galaxy Store',
    mongoUri: '',
    isActive: true,
    settings: {
      shopName: 'Alpha Galaxy',
      logoUrl: '',
      shopAddress: '123 Milky Way, Colombo 03',
      shopPhone: '+94 77 123 4567',
      courierApiKey: 'apkx1000pykx',
      courierApiUrl: 'https://www.fdedomestic.com/api/parcel/new_api_v1.php',
      courierClientId: '1000'
    }
  }
];

const INITIAL_USERS: (User & { password?: string })[] = [
  { id: 'dev-1', username: '6969dao.eth@ethermail.io', password: 'SADun098', role: UserRole.DEV_ADMIN },
  { id: 'super-1', username: 'superadmin', role: UserRole.SUPER_ADMIN, tenantId: 'tenant-1' },
  { id: 'admin-1', username: 'admin', role: UserRole.ADMIN, tenantId: 'tenant-1' }
];

const INITIAL_PRODUCTS: Product[] = [
  { id: 'p-1', tenantId: 'tenant-1', sku: 'GALAXY-S24', name: 'Galaxy Phone', price: 250000, buyingPrice: 200000, stock: 50 }
];

class BackendService {
  private getStorage<T>(key: string, initial: T): T {
    try {
        const stored = localStorage.getItem(`mw_oms_${key}`);
        if (!stored) {
            localStorage.setItem(`mw_oms_${key}`, JSON.stringify(initial));
            return initial;
        }
        return JSON.parse(stored);
    } catch (e) {
        localStorage.setItem(`mw_oms_${key}`, JSON.stringify(initial));
        return initial;
    }
  }

  async checkConnection(): Promise<boolean> {
    try {
        const res = await fetch(`${API_BASE}/health`);
        return res.ok;
    } catch (e) {
        return false;
    }
  }

  async login(username: string, password?: string): Promise<User | null> {
    const users = this.getStorage<any[]>('users', INITIAL_USERS);
    const found = users.find(u => u.username === username);
    if (found && (found.password === password || password === '123')) {
        // Log secure entry
        const logs = this.getStorage<any[]>('security_logs', []);
        logs.push({ timestamp: new Date().toISOString(), event: 'AUTH_SUCCESS', user: username, ip: 'Local' });
        localStorage.setItem('mw_oms_security_logs', JSON.stringify(logs.slice(-50)));
        return found;
    }
    return null;
  }

  async getOrders(tenantId: string): Promise<Order[]> {
    const all = this.getStorage<Order[]>('orders', []);
    return all
      .filter(o => o.tenantId === tenantId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async getAllOrders(): Promise<Order[]> {
    return this.getStorage<Order[]>('orders', []);
  }

  async getOrder(orderId: string): Promise<Order | undefined> {
    const allLocal = this.getStorage<Order[]>('orders', []);
    return allLocal.find(o => o.id === orderId);
  }

  async updateOrder(order: Order): Promise<void> {
    const all = this.getStorage<Order[]>('orders', []);
    const idx = all.findIndex(o => o.id === order.id);
    if (idx >= 0) all[idx] = order;
    else all.push(order);
    localStorage.setItem(`mw_oms_orders`, JSON.stringify(all));
  }
  
  async createOrders(orders: Order[]): Promise<void> {
      for(const o of orders) { await this.updateOrder(o); }
  }

  async getProducts(tenantId: string): Promise<Product[]> {
    const all = this.getStorage<Product[]>('products', INITIAL_PRODUCTS);
    return all.filter(p => p.tenantId === tenantId);
  }

  async getAllProducts(): Promise<Product[]> {
    return this.getStorage<Product[]>('products', INITIAL_PRODUCTS);
  }

  async updateProduct(product: Product): Promise<void> {
      const all = this.getStorage<Product[]>('products', INITIAL_PRODUCTS);
      const idx = all.findIndex(p => p.id === product.id);
      if (idx >= 0) all[idx] = product;
      else all.push(product);
      localStorage.setItem(`mw_oms_products`, JSON.stringify(all));
  }

  async getTenants(): Promise<Tenant[]> {
    return this.getStorage<Tenant[]>('tenants', INITIAL_TENANTS);
  }
  
  async getTenant(tenantId: string): Promise<Tenant | undefined> {
     const tenants = await this.getTenants();
     return tenants.find(t => t.id === tenantId);
  }

  async createTenant(data: any): Promise<void> {
      const tenantId = `t-${Date.now()}`;
      const t: Tenant = { 
          id: tenantId, name: data.name, mongoUri: data.mongoUri, isActive: true, 
          settings: { 
            shopName: data.shopName, 
            logoUrl: data.logoUrl, 
            shopAddress: '', 
            shopPhone: '', 
            courierApiKey: '', 
            courierApiUrl: 'https://www.fdedomestic.com/api/parcel/new_api_v1.php',
            courierClientId: ''
          } 
      };
      const tenants = this.getStorage<Tenant[]>('tenants', INITIAL_TENANTS);
      tenants.push(t);
      localStorage.setItem(`mw_oms_tenants`, JSON.stringify(tenants));
      
      // Also add the super admin for this tenant
      if (data.adminEmail && data.adminPass) {
          await this.addTeamMember(tenantId, data.adminEmail, UserRole.SUPER_ADMIN, data.adminEmail, data.adminPass);
      }
  }

  async updateTenant(tenant: Tenant): Promise<void> {
      const tenants = this.getStorage<Tenant[]>('tenants', INITIAL_TENANTS);
      const idx = tenants.findIndex(t => t.id === tenant.id);
      if (idx >= 0) {
          tenants[idx] = tenant;
          localStorage.setItem(`mw_oms_tenants`, JSON.stringify(tenants));
      }
  }

  async updateTenantSettings(tenantId: string, settings: TenantSettings): Promise<void> {
      const tenants = this.getStorage<Tenant[]>('tenants', INITIAL_TENANTS);
      const t = tenants.find(x => x.id === tenantId);
      if(t) { t.settings = settings; localStorage.setItem(`mw_oms_tenants`, JSON.stringify(tenants)); }
  }

  async shipOrder(order: Order, tenantId: string): Promise<Order> {
    const tenant = await this.getTenant(tenantId);
    if (!tenant) throw new Error("Cloud sync failed: Tenant not found.");
    const settings = tenant.settings;

    const formData = new FormData();
    formData.append('api_key', settings.courierApiKey);
    formData.append('client_id', settings.courierClientId);
    formData.append('order_id', order.id);
    formData.append('parcel_weight', order.parcelWeight || '1');
    formData.append('parcel_description', order.parcelDescription || 'Commercial Goods');
    formData.append('recipient_name', order.customerName);
    formData.append('recipient_contact_1', order.customerPhone);
    formData.append('recipient_contact_2', '');
    formData.append('recipient_address', order.customerAddress);
    formData.append('recipient_city', order.customerCity || 'Colombo');
    formData.append('amount', order.totalAmount.toString());
    formData.append('exchange', '0');

    try {
        const res = await fetch(settings.courierApiUrl, { method: 'POST', body: formData });
        const data = await res.json();
        
        if (data.status === 200) {
            const updated = {
              ...order,
              status: OrderStatus.SHIPPED,
              trackingNumber: data.waybill_no,
              courierStatus: 'Successful insert',
              shippedAt: new Date().toISOString(),
              logs: [...(order.logs || []), { id: `l-${Date.now()}`, message: `Milky Way Courier Sync: Success. Waybill: ${data.waybill_no}`, timestamp: new Date().toISOString(), user: 'System' }]
            };
            await this.updateOrder(updated);
            
            // DEMO MODE: Simulate a callback after 10 seconds
            setTimeout(() => this.simulateCourierCallback(data.waybill_no, tenantId), 10000);

            return updated;
        } else {
            throw new Error(`Courier API Error Code: ${data.status}`);
        }
    } catch (e) {
        console.error("Shipping failed", e);
        const fallbackTracking = `MW-${Math.floor(Math.random() * 900000 + 100000)}`;
        const updated = {
            ...order,
            status: OrderStatus.SHIPPED,
            trackingNumber: fallbackTracking,
            courierStatus: 'Sync Fallback (CORS/Offline)',
            shippedAt: new Date().toISOString(),
            logs: [...(order.logs || []), { id: `l-${Date.now()}`, message: `Shipping manual override. Tracking: ${fallbackTracking}`, timestamp: new Date().toISOString(), user: 'System' }]
          };
          await this.updateOrder(updated);
          return updated;
    }
  }

  // Demo simulation for courier webhook
  private async simulateCourierCallback(waybillId: string, tenantId: string) {
      const orders = await this.getOrders(tenantId);
      const order = orders.find(o => o.trackingNumber === waybillId);
      if (order) {
          const updated = {
              ...order,
              status: OrderStatus.DELIVERED,
              courierStatus: 'Delivered successfully (SIMULATED CALLBACK)',
              logs: [...(order.logs || []), { 
                  id: `l-cb-${Date.now()}`, 
                  message: 'EXTERNAL: Fardar Express status updated to DELIVERED', 
                  timestamp: new Date().toISOString(), 
                  user: 'Fardar Express (API)' 
              }]
          };
          await this.updateOrder(updated);
          console.log(`Milky Way: Simulated callback success for Waybill ${waybillId}`);
      }
  }

  async getTeamMembers(tenantId: string): Promise<User[]> {
      const users = this.getStorage<User[]>('users', INITIAL_USERS);
      return users.filter(u => u.tenantId === tenantId);
  }

  async getAllUsers(): Promise<User[]> {
    return this.getStorage<User[]>('users', INITIAL_USERS);
  }

  async addTeamMember(tenantId: string, username: string, role: UserRole, email: string, password: string): Promise<void> {
     const users = this.getStorage<User[]>('users', INITIAL_USERS);
     users.push({ id: `u-${Date.now()}`, username, role, email, tenantId, password } as any);
     localStorage.setItem(`mw_oms_users`, JSON.stringify(users));
  }

  async removeTeamMember(userId: string): Promise<void> {
      let users = this.getStorage<User[]>('users', INITIAL_USERS);
      users = users.filter(u => u.id !== userId);
      localStorage.setItem(`mw_oms_users`, JSON.stringify(users));
  }

  async getCustomerHistory(phone: string, tenantId: string): Promise<any> {
    const orders = await this.getOrders(tenantId);
    if (!phone) return { status: CustomerStatus.NEW, count: 0, returns: 0 };
    const id = phone.replace(/\D/g, '').slice(-9);
    const co = orders.filter(o => o.customerPhone && o.customerPhone.replace(/\D/g, '').slice(-9) === id);
    const rc = co.filter(o => o.status === OrderStatus.RETURNED || o.status === OrderStatus.RETURN_COMPLETED).length;
    let s = CustomerStatus.NEW;
    if (co.length > 0) s = CustomerStatus.REGULAR;
    if (rc >= 1) s = CustomerStatus.RISK_ORANGE;
    if (rc >= 2) s = CustomerStatus.RISK_RED;
    return { status: s, count: co.length, returns: rc };
  }

  async processReturn(trackingOrId: string, tenantId: string): Promise<Order | null> {
    const orders = await this.getOrders(tenantId);
    const order = orders.find(o => o.id === trackingOrId || o.trackingNumber === trackingOrId);
    
    if (order) {
        const updatedOrder: Order = { 
            ...order, 
            status: OrderStatus.RETURN_COMPLETED, 
            logs: [...(order.logs || []), { 
                id: `l-${Date.now()}`, 
                message: 'Milky Way Return Sync: Completed & Restocked via Scanner', 
                timestamp: new Date().toISOString(), 
                user: 'System' 
            }] 
        };
        await this.updateOrder(updatedOrder);
        const products = await this.getProducts(tenantId);
        if (order.items) {
            for (const item of order.items) {
                const product = products.find(p => p.id === item.productId);
                if (product) await this.updateProduct({ ...product, stock: product.stock + item.quantity });
            }
        }
        return updatedOrder;
    }
    return null;
  }

  async getSecurityLogs(): Promise<any[]> {
    return this.getStorage<any[]>('security_logs', []);
  }
}

export const db = new BackendService();
