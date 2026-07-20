const fs = require('fs');
let content = fs.readFileSync('services/apiClient.ts', 'utf8');

const targetStr = `  async updateOrder(order: Order): Promise<void> {
    await this.request('/orders', 'POST', { order, tenantId: order.tenantId }, { tenantId: order.tenantId });
  }`;

const replaceStr = `  async updateOrder(order: Order): Promise<void> {
    try {
        localStorage.setItem('pre_order_' + order.id, JSON.stringify(order));
    } catch(e) {}
    await this.request('/orders', 'POST', { order, tenantId: order.tenantId }, { tenantId: order.tenantId });
  }`;

content = content.replace(targetStr, replaceStr);
fs.writeFileSync('services/apiClient.ts', content);
console.log("Updated updateOrder to update local cache");
