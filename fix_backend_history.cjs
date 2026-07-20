const fs = require('fs');
let content = fs.readFileSync('services/mockBackend.ts', 'utf8');

const targetStr = `  async getCustomerHistory(phone: string, tenantId: string): Promise<any> {
    if (!phone) return { status: CustomerStatus.NEW, count: 0, returns: 0 };
    return this.request('/customer-history', 'GET', null, { phone, tenantId });
  }`;

const replaceStr = `  async getCustomerHistory(phone: string, tenantId: string): Promise<any> {
    if (!phone) return { count: 0, returns: 0 };
    const res = await this.request('/customer-history', 'GET', null, { phone, tenantId });
    if (Array.isArray(res)) {
        let count = res.length;
        let returns = res.filter(x => ['RETURNED', 'RETURN_TRANSFER', 'RETURN_AS_ON_SYSTEM', 'RETURN_HANDOVER', 'RETURN_COMPLETED'].includes(x.status)).length;
        return { count, returns };
    }
    return res;
  }

  async getCustomerHistoryBulk(phones: string[], tenantId: string): Promise<{[key: string]: any}> {
    if (!phones || phones.length === 0) return {};
    return this.request('/customer-history-bulk', 'POST', { phones }, { tenantId });
  }`;

content = content.replace(targetStr, replaceStr);
fs.writeFileSync('services/mockBackend.ts', content);
console.log("Updated mockBackend for bulk history");
