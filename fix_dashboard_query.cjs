const fs = require('fs');
let content = fs.readFileSync('server.js', 'utf8');

content = content.replace(
  "const allOrders = await col.find({ tenantId }).toArray();",
  "const allOrders = await col.find({ tenantId }).project({ createdAt: 1, shippedAt: 1, confirmedAt: 1, deliveredAt: 1, returnCompletedAt: 1, status: 1, totalAmount: 1, items: 1, 'logs.message': 1, 'logs.user': 1, 'logs.timestamp': 1 }).toArray();"
);

fs.writeFileSync('server.js', content);
console.log("Fixed dashboard query projection");
