import { Order, OrderStatus, Product, Tenant, User, UserRole, CustomerStatus, TenantSettings, StockBatch } from '../types';

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
        throw new Error(errorData.error || errorData.details || `HTTP ${response.status}`);
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
    const data = await this.request('/products', 'GET', null, { tenantId });
    return data.map((p: any) => ({
      ...p,
      batches: p.batches || (p.stock ? [{ id: 'legacy-init', quantity: p.stock, buyingPrice: p.buyingPrice || 0, createdAt: new Date().toISOString() }] : [])
    }));
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

  async updateTenantSettings(tenantId: string, settings: TenantSettings): Promise<void> {
    const tenant = await this.getTenant(tenantId);
    if (tenant) await this.updateTenant({ ...tenant, settings });
  }

  async updateTenant(tenant: Tenant, adminEmail?: string, adminPass?: string): Promise<void> {
    const payload: any = { tenant };
    if (adminEmail || adminPass) payload.adminUser = { username: adminEmail || undefined, password: adminPass || undefined };
    await this.request('/tenants', 'PUT', payload);
  }

  async createTenant(formData: any): Promise<void> {
    const tenant = {
      id: formData.name,
      name: formData.name,
      mongoUri: formData.mongoUri,
      isActive: true,
      settings: {
        shopName: formData.shopName,
        logoUrl: formData.logoUrl,
        shopAddress: '',
        shopPhone: '',
        courierApiKey: '',
        courierApiUrl: 'https://www.fdedomestic.com/api/parcel/new_api_v1.php',
        courierClientId: ''
      }
    };
    const adminUser = {
      username: formData.adminEmail,
      password: formData.adminPass
    };
    await this.request('/tenants', 'POST', { tenant, adminUser });
  }

  async shipOrder(order: Order, tenantId: string): Promise<Order> {
    const tenant = await this.getTenant(tenantId);
    if (!tenant) throw new Error("Sync Error: Cluster unavailable.");

    let waybillId = "";
    
    // Fardar Express Domestic API Implementation
    if (tenant.settings.courierApiKey && tenant.settings.courierClientId) {
        const formData = new URLSearchParams();
        
        // Data Normalization for Fardar strict validation
        const numericOrderId = order.id.replace(/\D/g, ''); // Fixes 202 Error
        const numericPhone = order.customerPhone.replace(/\D/g, ''); // Ensures valid contact

        formData.append('api_key', tenant.settings.courierApiKey);
        formData.append('client_id', tenant.settings.courierClientId);
        formData.append('order_id', numericOrderId); 
        formData.append('parcel_weight', order.parcelWeight || '1');
        formData.append('parcel_description', (order.parcelDescription || (order.items[0]?.name || 'Sample Item')).slice(0, 50));
        formData.append('recipient_name', order.customerName);
        formData.append('recipient_contact_1', numericPhone);
        formData.append('recipient_contact_2', ''); 
        formData.append('recipient_address', order.customerAddress);
        formData.append('recipient_city', order.customerCity || 'Colombo');
        formData.append('amount', Math.round(order.totalAmount).toString());
        formData.append('exchange', '0'); // 0 for Normal Parcel

        try {
            const response = await fetch(tenant.settings.courierApiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: formData
            });

            const result = await response.json();
            
            // Fardar API returns status 200 for successful insert
            if (Number(result.status) === 200 && result.waybill_no) {
                waybillId = result.waybill_no;
            } else {
                const statusCodeMessages: {[key: number]: string} = {
                    201: 'Inactive Client', 202: 'Invalid order id', 203: 'Invalid weight',
                    204: 'Invalid parcel description', 205: 'Invalid name', 206: 'Contact number 1 is invalid',
                    207: 'Contact number 2 is invalid', 208: 'Invalid address', 209: 'Invalid City',
                    210: 'Unsuccessful insert', 211: 'Invalid API key', 212: 'Invalid or inactive client',
                    213: 'Invalid exchange value', 214: 'System maintain mode'
                };
                const msg = statusCodeMessages[Number(result.status)] || result.message || "Unknown Logistics Error";
                throw new Error(`[Fardar ${result.status}]: ${msg}`);
            }
        } catch (apiErr: any) {
            throw new Error(`Logistics Bridge Failure: ${apiErr.message}`);
        }
    } else {
        throw new Error("Missing Courier API Credentials in settings.");
    }

    // Deduct Stock via FIFO
    const allProducts = await this.getProducts(tenantId);
    for (const item of order.items) {
        const prod = allProducts.find(p => p.id === item.productId);
        if (prod && prod.batches) {
            let remainingToDeduct = item.quantity;
            const sortedBatches = [...prod.batches].sort((a, b) => 
                new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
            );

            for (const batch of sortedBatches) {
                if (remainingToDeduct <= 0) break;
                if (batch.quantity <= 0) continue;
                const deduction = Math.min(batch.quantity, remainingToDeduct);
                batch.quantity -= deduction;
                remainingToDeduct -= deduction;
            }
            prod.batches = sortedBatches;
            await this.updateProduct(prod);
        }
    }
    
    const updated: Order = {
      ...order, 
      status: OrderStatus.SHIPPED, 
      trackingNumber: waybillId,
      shippedAt: new Date().toISOString(),
      logs: [...(order.logs || []), { 
        id: `l-${Date.now()}`, 
        message: `Dispatched via Fardar Express. Waybill: ${waybillId}`, 
        timestamp: new Date().toISOString(), 
        user: 'System' 
      }]
    };
    
    await this.updateOrder(updated);
    return updated;
  }

  async getAllUsers(): Promise<User[]> {
    return this.request('/users', 'GET');
  }

  async getTeamMembers(tenantId: string): Promise<User[]> {
    const all = await this.request('/users', 'GET', null, { tenantId });
    return all.filter((u: any) => u.tenantId === tenantId);
  }

  async addTeamMember(tenantId: string, username: string, role: UserRole, email: string, password?: string): Promise<void> {
    const user: any = { id: `u-${Date.now()}`, username, email, role, tenantId };
    if (password) user.password = password;
    await this.request('/users', 'POST', user);
  }

  async removeTeamMember(id: string): Promise<void> {
    await this.request('/users', 'DELETE', null, { id });
  }

  async getSecurityLogs(): Promise<any[]> {
    return [
      { event: 'Node Cluster Alpha Sync', timestamp: new Date().toISOString() },
      { event: 'Cross-Cluster Handshake', timestamp: new Date().toISOString() },
      { event: 'Global Ledger Validated', timestamp: new Date().toISOString() }
    ];
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
        logs: [...(order.logs || []), { id: `l-${Date.now()}`, message: 'Restocked via Milky Way Scan', timestamp: new Date().toISOString(), user: 'System' }] 
      };
      
      const allProducts = await this.getProducts(tenantId);
      for (const item of order.items) {
          const prod = allProducts.find(p => p.id === item.productId);
          if (prod) {
              const returnBatch: StockBatch = { id: `rtn-${Date.now()}`, quantity: item.quantity, buyingPrice: 0, createdAt: new Date().toISOString() };
              prod.batches = [returnBatch, ...prod.batches];
              await this.updateProduct(prod);
          }
      }
      
      await this.updateOrder(updatedOrder);
      return updatedOrder;
    }
    return null;
  }
}
export const db = new BackendService();