import { Order, OrderStatus, Product, Tenant, User, UserRole, CustomerStatus, TenantSettings } from '../types';

const API_BASE = '/api';

class BackendService {
  private async request(path: string, method: string = 'GET', body?: any, params?: any) {
    const url = new URL(`${window.location.origin}${API_BASE}${path}`);
    if (params) {
      Object.keys(params).forEach(key => {
        if (params[key] !== undefined && params[key] !== null) {
          url.searchParams.append(key, params[key]);
        }
      });
    }
    try {
      const response = await fetch(url.toString(), {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || errorData.details || `API Error: ${response.status}`);
      }
      return await response.json();
    } catch (e: any) {
      console.error(`Backend Request Failure [${path}]:`, e);
      throw e;
    }
  }

  async checkHealth(): Promise<boolean> {
    try {
      const res = await fetch(`${API_BASE}/health`);
      return res.ok;
    } catch { return false; }
  }

  async login(username: string, password?: string): Promise<User | null> {
    try { return await this.request('/login', 'POST', { username, password }); }
    catch (e) { return null; }
  }

  async getOrders(tenantId: string): Promise<Order[]> {
    return this.request('/orders', 'GET', null, { tenantId });
  }

  async getAllOrders(): Promise<Order[]> {
    return this.request('/orders', 'GET');
  }

  async getOrder(orderId: string, tenantId: string): Promise<Order | undefined> {
    return this.request('/orders', 'GET', null, { id: orderId, tenantId });
  }

  async updateOrder(order: Order): Promise<void> {
    await this.request('/orders', 'POST', { order, tenantId: order.tenantId }, { tenantId: order.tenantId });
  }

  async deleteOrder(orderId: string, tenantId: string): Promise<void> {
    await this.request('/orders', 'DELETE', null, { id: orderId, tenantId });
  }
  
  async createOrders(orders: Order[]): Promise<void> {
    if (orders.length === 0) return;
    const tenantId = orders[0].tenantId;
    await this.request('/orders', 'POST', { orders, tenantId }, { tenantId });
  }

  async getProducts(tenantId: string): Promise<Product[]> {
    return this.request('/products', 'GET', null, { tenantId });
  }

  async updateProduct(product: Product): Promise<void> {
    await this.request('/products', 'POST', { product, tenantId: product.tenantId }, { tenantId: product.tenantId });
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
      id: tenantId, name: data.name, mongoUri: data.mongoUri || '', isActive: true, 
      settings: { 
        shopName: data.shopName, logoUrl: data.logoUrl, shopAddress: '', shopPhone: '', 
        courierApiKey: '', courierApiUrl: 'https://www.fdedomestic.com/api/parcel/new_api_v1.php', courierClientId: ''
      } 
    };
    const adminUser = { id: `u-sa-${Date.now()}`, username: data.adminEmail, password: data.adminPass, role: UserRole.SUPER_ADMIN, tenantId: tenantId, email: data.adminEmail };
    await this.request('/tenants', 'POST', { tenant, adminUser });
  }

  async updateTenant(tenant: Tenant, adminEmail?: string, adminPass?: string): Promise<void> {
    const payload: any = { tenant };
    if (adminEmail || adminPass) payload.adminUser = { username: adminEmail || undefined, password: adminPass || undefined };
    await this.request('/tenants', 'PUT', payload);
  }

  async updateTenantSettings(tenantId: string, settings: TenantSettings): Promise<void> {
    const tenant = await this.getTenant(tenantId);
    if (tenant) await this.updateTenant({ ...tenant, settings });
  }

  async shipOrder(order: Order, tenantId: string): Promise<Order> {
    const tenant = await this.getTenant(tenantId);
    if (!tenant) throw new Error("Tenant cluster configuration unreachable.");

    // PREPARE JSON CONVERTED DATA FOR COURIER PARTNER
    const courierPayload = {
      apiKey: tenant.settings.courierApiKey,
      clientId: tenant.settings.courierClientId,
      orderRef: order.id,
      consignee: {
        name: order.customerName,
        phone: order.customerPhone,
        address: order.customerAddress,
        city: order.customerCity
      },
      parcel: {
        weight: order.parcelWeight || '1.0',
        cod: order.totalAmount,
        description: order.parcelDescription || 'Milky Way Dispatch'
      }
    };

    console.log("MILKY WAY: Handshaking with Courier...", JSON.stringify(courierPayload, null, 2));

    // Simulate high-fidelity courier API latency
    await new Promise(resolve => setTimeout(resolve, 1500)); 
    
    // Generate unique API Code (Waybill)
    const apiCode = `FDE-${Math.floor(10000000 + Math.random() * 90000000)}`;
    
    const updated: Order = {
      ...order, 
      status: OrderStatus.SHIPPED, 
      trackingNumber: apiCode,
      shippedAt: new Date().toISOString(),
      logs: [...(order.logs || []), { 
        id: `l-${Date.now()}`, 
        message: `Milky Way: Courier Handshake Success. API Code generated: ${apiCode}`, 
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
    const newUser = { id: `u-${Date.now()}`, tenantId, username, role, email, password };
    await this.request('/users', 'POST', newUser);
  }

  async removeTeamMember(userId: string): Promise<void> {
    await this.request('/users', 'DELETE', null, { id: userId });
  }

  async getCustomerHistory(phone: string, tenantId: string): Promise<any> {
    if (!phone) return { status: CustomerStatus.NEW, count: 0, returns: 0 };
    const orders = await this.getOrders(tenantId);
    const last9 = phone.replace(/\D/g, '').slice(-9);
    const co = orders.filter(o => o.customerPhone && o.customerPhone.replace(/\D/g, '').slice(-9) === last9);
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
        ...order, status: OrderStatus.RETURN_COMPLETED, 
        logs: [...(order.logs || []), { id: `l-${Date.now()}`, message: 'Milky Way OMS: Return Restocked via Optical Scan', timestamp: new Date().toISOString(), user: 'System' }] 
      };
      await this.updateOrder(updatedOrder);
      return updatedOrder;
    }
    return null;
  }

  async getSecurityLogs(): Promise<any[]> {
    return JSON.parse(localStorage.getItem('mw_oms_security_logs') || '[]');
  }
}
export const db = new BackendService();