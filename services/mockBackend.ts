
import { Order, OrderStatus, Product, Tenant, User, UserRole, CustomerStatus, TenantSettings } from '../types';

const API_BASE = '/.netlify/functions/api';

class BackendService {
  private async request(path: string, method: string = 'GET', body?: any, params?: any) {
    const url = new URL(`${window.location.origin}${API_BASE}${path}`);
    if (params) {
      Object.keys(params).forEach(key => url.searchParams.append(key, params[key]));
    }

    try {
      const response = await fetch(url.toString(), {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `API Error: ${response.status}`);
      }

      return response.json();
    } catch (e: any) {
      console.error(`Milky Way API Request Failed [${path}]:`, e);
      throw e;
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
    try {
      const user = await this.request('/login', 'POST', { username, password });
      if (user) {
        const logs = JSON.parse(localStorage.getItem('mw_oms_security_logs') || '[]');
        logs.push({ timestamp: new Date().toISOString(), event: 'AUTH_SUCCESS', user: username, ip: 'Cloud' });
        localStorage.setItem('mw_oms_security_logs', JSON.stringify(logs.slice(-50)));
        return user;
      }
      return null;
    } catch (e) {
      return null;
    }
  }

  async getOrders(tenantId: string): Promise<Order[]> {
    return this.request('/orders', 'GET', null, { tenantId });
  }

  async getAllOrders(): Promise<Order[]> {
    return this.request('/orders', 'GET');
  }

  async updateOrder(order: Order): Promise<void> {
    await this.request('/orders', 'POST', { order, tenantId: order.tenantId });
  }
  
  async createOrders(orders: Order[]): Promise<void> {
    for (const o of orders) {
      await this.updateOrder(o);
    }
  }

  async getProducts(tenantId: string): Promise<Product[]> {
    return this.request('/products', 'GET', null, { tenantId });
  }

  async getAllProducts(): Promise<Product[]> {
    return this.request('/products', 'GET');
  }

  async updateProduct(product: Product): Promise<void> {
    await this.request('/products', 'POST', { product, tenantId: product.tenantId });
  }

  async getTenants(): Promise<Tenant[]> {
    return this.request('/tenants', 'GET');
  }
  
  async getTenant(tenantId: string): Promise<Tenant | undefined> {
    const tenants = await this.getTenants();
    return tenants.find(t => t.id === tenantId);
  }

  async createTenant(data: any): Promise<void> {
    const tenantId = `t-${Date.now()}`;
    const tenant: Tenant = { 
      id: tenantId, 
      name: data.name, 
      mongoUri: data.mongoUri, 
      isActive: true, 
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

    const adminUser = {
      id: `u-sa-${Date.now()}`,
      username: data.adminEmail, // Workforce ID for login
      password: data.adminPass,
      role: 'SUPER_ADMIN',
      tenantId: tenantId,
      email: data.adminEmail
    };

    await this.request('/tenants', 'POST', { tenant, adminUser });
  }

  async updateTenant(tenant: Tenant): Promise<void> {
    await this.request('/tenants', 'PUT', { tenant });
  }

  async updateTenantSettings(tenantId: string, settings: TenantSettings): Promise<void> {
    const tenant = await this.getTenant(tenantId);
    if (tenant) {
      tenant.settings = settings;
      await this.updateTenant(tenant);
    }
  }

  async shipOrder(order: Order, tenantId: string): Promise<Order> {
    const tenant = await this.getTenant(tenantId);
    if (!tenant) throw new Error("Cloud sync failed: Tenant not found.");
    
    const updated: Order = {
      ...order,
      status: OrderStatus.SHIPPED,
      shippedAt: new Date().toISOString(),
      logs: [...(order.logs || []), { 
        id: `l-${Date.now()}`, 
        message: `Milky Way: Dispatched to Logistics`, 
        timestamp: new Date().toISOString(), 
        user: 'System' 
      }]
    };
    
    await this.updateOrder(updated);
    return updated;
  }

  async getTeamMembers(tenantId: string): Promise<User[]> {
    const all = await this.getAllUsers();
    return all.filter(u => u.tenantId === tenantId);
  }

  async getAllUsers(): Promise<User[]> {
    return this.request('/users', 'GET');
  }

  async addTeamMember(tenantId: string, username: string, role: UserRole, email: string, password?: string): Promise<void> {
    await this.request('/users', 'POST', { tenantId, username, role, email, password });
  }

  async removeTeamMember(userId: string): Promise<void> {
    await this.request('/users', 'DELETE', null, { id: userId });
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
          message: 'Returns: Restocked via Cloud Scanner', 
          timestamp: new Date().toISOString(), 
          user: 'System' 
        }] 
      };
      await this.updateOrder(updatedOrder);
      return updatedOrder;
    }
    return null;
  }

  async getSecurityLogs(): Promise<any[]> {
    return JSON.parse(localStorage.getItem('mw_oms_security_logs') || '[]');
  }

  async getOrder(orderId: string): Promise<Order | undefined> {
    const all = await this.getAllOrders();
    return all.find((o: Order) => o.id === orderId);
  }
}

export const db = new BackendService();
