const fs = require('fs');
let content = fs.readFileSync('services/apiClient.ts', 'utf8');

const targetStr = `  async processReturn(trackingOrId: string, tenantId: string, user?: string): Promise<Order | null> {
    return this.request('/process-return', 'POST', { trackingOrId, tenantId, user });
  }`;

const replaceStr = `  async processReturn(trackingOrId: string, tenantId: string, user?: string): Promise<Order | null> {
    const res = await this.request('/process-return', 'POST', { trackingOrId, tenantId, user });
    if (res && res.id) {
        try { localStorage.setItem('pre_order_' + res.id, JSON.stringify(res)); } catch(e) {}
    }
    return res;
  }`;

content = content.replace(targetStr, replaceStr);
fs.writeFileSync('services/apiClient.ts', content);
console.log("Updated processReturn to update local cache");
