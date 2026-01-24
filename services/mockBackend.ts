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

    let waybillId = "";
    
    // --- ACTUAL COURIER API CALL (Fardar Express) ---
    if (tenant.settings.courierApiKey && tenant.settings.courierClientId) {
        const formData = new FormData();
        formData.append('api_key', tenant.settings.courierApiKey);
        formData.append('client_id', tenant.settings.courierClientId);
        formData.append('consignee_name', order.customerName);
        formData.append('consignee_phone', order.customerPhone);
        formData.append('consignee_address', order.customerAddress);
        formData.append('destination_city', order.customerCity || '');
        formData.append('weight', order.parcelWeight || '1');
        formData.append('cod_amount', order.totalAmount.toString());
        formData.append('description', order.parcelDescription || 'E-commerce Item');
        formData.append('ref_no', order.id);

        try {
            const response = await fetch(tenant.settings.courierApiUrl, {
                method: 'POST',
                body: formData
            });

            const result = await response.json();
            if (result.status === 'success' && result.waybill_id) {
                waybillId = result.waybill_id;
            } else {
                throw new Error(result.error || result.message || "Logistics API returned an error status.");
            }
        } catch (apiErr: any) {
            throw new Error(`Logistics Critical Failure: ${apiErr.message}`);
        }
    } else {
        throw new Error("Courier Credentials Missing. Configure Cluster Settings.");
    }

    // --- MILKY WAY FIFO BATCH REDUCTION ---
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
        message: `FIFO Dispatch Executed. Courier Waybill: ${waybillId}`, 
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
        logs: [...(order.logs || []), { id: `l-${Date.now()}`, message: 'Restocked via Optical Scan', timestamp: new Date().toISOString(), user: 'System' }] 
      };
      
      const allProducts = await this.getProducts(tenantId);
      for (const item of order.items) {
          const prod = allProducts.find(p => p.id === item.productId);
          if (prod) {
              const returnBatch: StockBatch = {
                  id: `rtn-${Date.now()}`,
                  quantity: item.quantity,
                  buyingPrice: 0, 
                  createdAt: new Date().toISOString()
              };
              prod.batches = [returnBatch, ...prod.batches];
              await this.updateProduct(prod);
          }
      }
      
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