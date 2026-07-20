const fs = require('fs');
let content = fs.readFileSync('server.js', 'utf8');

const targetStr = `        const col = db.collection('orders');
        if (!ensuredIndexes.has(tenantId)) {
            col.createIndex({ id: 1 }).catch(() => {});
            col.createIndex({ tenantId: 1, id: 1 }).catch(() => {});
            ensuredIndexes.add(tenantId);
        }`;

const replaceStr = `        const col = db.collection('orders');
        if (!ensuredIndexes.has(tenantId)) {
            col.createIndex({ id: 1 }).catch(() => {});
            col.createIndex({ tenantId: 1, id: 1 }).catch(() => {});
            col.createIndex({ tenantId: 1 }).catch(() => {});
            col.createIndex({ tenantId: 1, createdAt: -1 }).catch(() => {});
            col.createIndex({ tenantId: 1, status: 1 }).catch(() => {});
            col.createIndex({ tenantId: 1, "items.productId": 1 }).catch(() => {});
            col.createIndex({ status: 1 }).catch(() => {});
            col.createIndex({ createdAt: 1 }).catch(() => {});
            ensuredIndexes.add(tenantId);
        }`;

content = content.split(targetStr).join(replaceStr);
fs.writeFileSync('server.js', content);
console.log("Fixed auto indexing 2");
