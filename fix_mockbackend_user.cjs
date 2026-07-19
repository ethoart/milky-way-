const fs = require('fs');
let content = fs.readFileSync('services/mockBackend.ts', 'utf8');

content = content.replace(
  `async shipOrder(order: Order, tenantId: string): Promise<Order> {`,
  `async shipOrder(order: Order, tenantId: string, user?: string): Promise<Order> {`
);
content = content.replace(
  `return this.request('/ship-order', 'POST', { order, tenantId });`,
  `return this.request('/ship-order', 'POST', { order, tenantId, user });`
);

content = content.replace(
  `async processReturn(trackingOrId: string, tenantId: string): Promise<Order | null> {`,
  `async processReturn(trackingOrId: string, tenantId: string, user?: string): Promise<Order | null> {`
);
content = content.replace(
  `return this.request('/process-return', 'POST', { trackingOrId, tenantId });`,
  `return this.request('/process-return', 'POST', { trackingOrId, tenantId, user });`
);

fs.writeFileSync('services/mockBackend.ts', content);
console.log("Fixed mockbackend");
