import { Order, OrderStatus, Product, Tenant, User, UserRole, CustomerStatus, TenantSettings } from '../types';

const API_BASE = '/api';

class BackendService {
  private async request(path: string, method: string = 'GET', body?: any, params: any = {}) {
    // Ensure path doesn't start with double slash
    const sanitizedPath = path.startsWith('/') ? path : `/${path}`;
    const url = new URL(`${window.location.origin}${API_BASE}${sanitizedPath}`);
    
    Object.keys(params).forEach(key => {
      if (params[key] !== undefined && params[key] !== null) {
        url.searchParams.append(key, params[key]);
      }
    });

    const response = await fetch(url.toString(), {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    }).catch(err => {
      throw new Error("Network Protocol Failure: Cluster Unreachable.");
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.details || err.error || `Server Node Error: ${response.status}`);
    }
    return await response.json();
  }

  // Auth
  async login(username: string, password?: string): Promise<User | null> {
    return this.request('/login', 'POST', { username, password });
  }

  // Users
  async getAllUsers(): Promise<User[]> {
    return this.request('/team');
  }

  async getTeamMembers(tenantId: string): Promise<User[]> {
    return this.request('/team', 'GET', null, { tenantId });
  }

  async addTeamMember(tenantId: string, username: string, role: UserRole, email?: string, password?: string): Promise<void> {
    await this.request('/team', 'POST', { id: `u-${Date.now()}`, tenantId, username, role, email, password });
  }

  async removeTeamMember(id: string): Promise<void> {
    await this.request('/team', 'DELETE', null, { id });
  }

  // Orders
  async getOrders(tenantId: string): Promise<Order[]> {
    return this.request('/orders', 'GET', null, { tenantId });
  }

  async getAllOrders(): Promise<Order[]> {
    return this.request('/orders/all');
  }

  async getOrder(orderId: string): Promise<Order | null> {
    return this.request(`/orders`, 'GET', null, { id: orderId });
  }

  async createOrders(orders: Order[]): Promise<void> {
    const tenantId = orders[0]?.tenantId;
    await this.request('/orders/bulk', 'POST', { orders }, { tenantId });
  }

  async updateOrder(order: Order): Promise<void> {
    await this.request('/orders', 'POST', { order }, { tenantId: order.tenantId });
  }

  // Products
  async getProducts(tenantId: string): Promise<Product[]> {
    return this.request('/products', 'GET', null, { tenantId });
  }

  async getAllProducts(): Promise<Product[]> {
    return this.request('/products/all');
  }

  async updateProduct(product: Product): Promise<void> {
    await this.request('/products', 'POST', { product }, { tenantId: product.tenantId });
  }

  // Tenants
  async getTenants(): Promise<Tenant[]> {
    return this.request('/tenants');
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
      username: data.adminEmail,
      password: data.adminPass,
      role: UserRole.SUPER_ADMIN,
      tenantId: tenantId,
      email: data.adminEmail
    };

    await this.request('/tenants', 'POST', { tenant, adminUser });
  }

  async updateTenant(tenant: Tenant): Promise<void> {
    await this.request('/tenants', 'POST', { tenant });
  }

  async updateTenantSettings(tenantId: string, settings: TenantSettings): Promise<void> {
    const tenant = await this.getTenant(tenantId);
    if (tenant) {
      await this.updateTenant({ ...tenant, settings });
    }
  }

  async getSecurityLogs(): Promise<any[]> {
    return this.request('/security-logs');
  }

  async getCustomerHistory(phone: string, tenantId: string): Promise<any> {
    if (!phone) return { status: CustomerStatus.NEW, count: 0, returns: 0 };
    const orders = await this.getOrders(tenantId);
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
      const updatedOrder: Order = { ...order, status: OrderStatus.RETURN_COMPLETED };
      await this.updateOrder(updatedOrder);
      return updatedOrder;
    }
    return null;
  }
  
  async shipOrder(order: Order, tenantId: string): Promise<Order> {
    const updated: Order = { ...order, status: OrderStatus.SHIPPED, shippedAt: new Date().toISOString() };
    await this.updateOrder(updated);
    return updated;
  }
}

export const db = new BackendService();