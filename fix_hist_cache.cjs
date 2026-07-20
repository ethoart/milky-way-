const fs = require('fs');
let content = fs.readFileSync('services/mockBackend.ts', 'utf8');

const targetStr = `  async getCustomerDetailedHistory(phone: string, tenantId: string): Promise<Order[]> {
    if (!phone) return [];
    const res = await this.request('/customer-history-detailed', 'GET', null, { phone, tenantId });
    return Array.isArray(res) ? res : [];
  }`;

const replaceStr = `  async getCustomerDetailedHistory(phone: string, tenantId: string): Promise<Order[]> {
    if (!phone) return [];
    const res = await this.cachedRequest('cache_hist_' + phone, 10 * 60 * 1000, () => this.request('/customer-history-detailed', 'GET', null, { phone, tenantId }));
    return Array.isArray(res) ? res : [];
  }`;

content = content.replace(targetStr, replaceStr);
fs.writeFileSync('services/mockBackend.ts', content);
console.log("Cached customer detailed history");
