const fs = require('fs');
let content = fs.readFileSync('pages/Returns.tsx', 'utf8');

const t1 = `const handleScanProcess = async (code: string) => {`;
const rep1 = `const handleScanProcess = async (code: string) => {
    const currentUser = localStorage.getItem('mw_user') ? JSON.parse(localStorage.getItem('mw_user')!).username : 'System';`;

content = content.replace(t1, rep1);

const t2 = `result = await db.processReturn(cleanCode, tenantId);`;
const rep2 = `result = await db.processReturn(cleanCode, tenantId, currentUser);`;

content = content.replace(t2, rep2);

const t3 = `result = await db.shipOrder(order, tenantId);`;
const rep3 = `result = await db.shipOrder(order, tenantId, currentUser);`;

content = content.replace(t3, rep3);

const t4 = `const updated = { ...order, status: OrderStatus.DELIVERED, deliveredAt: new Date().toISOString() };
              await db.updateOrder(updated);`;
const rep4 = `const updated = { ...order, status: OrderStatus.DELIVERED, deliveredAt: new Date().toISOString() };
              if (!updated.logs) updated.logs = [];
              updated.logs.push({ id: \`l-\${Date.now()}\`, message: \`Status Protocol: Order transitioned to DELIVERED\`, timestamp: new Date().toISOString(), user: currentUser });
              await db.updateOrder(updated);`;

content = content.replace(t4, rep4);

fs.writeFileSync('pages/Returns.tsx', content);
console.log("Fixed returns");
