const fs = require('fs');
let content = fs.readFileSync('server.js', 'utf8');

const regex = /        if \(!ensuredIndexes\.has\(tenantId\)\) \{[\s\S]*?ensuredIndexes\.add\(tenantId\);\n        \}/g;

const functionStr = `function ensureTenantIndexes(col, tenantId) {
    if (!ensuredIndexes.has(tenantId)) {
        col.createIndex({ id: 1 }).catch(() => {});
        col.createIndex({ tenantId: 1, id: 1 }).catch(() => {});
        col.createIndex({ tenantId: 1 }).catch(() => {});
        col.createIndex({ tenantId: 1, createdAt: -1 }).catch(() => {});
        col.createIndex({ tenantId: 1, status: 1 }).catch(() => {});
        col.createIndex({ tenantId: 1, shippedAt: 1 }).catch(() => {});
        col.createIndex({ tenantId: 1, confirmedAt: 1 }).catch(() => {});
        col.createIndex({ tenantId: 1, deliveredAt: 1 }).catch(() => {});
        col.createIndex({ tenantId: 1, returnCompletedAt: 1 }).catch(() => {});
        col.createIndex({ tenantId: 1, "items.productId": 1 }).catch(() => {});
        col.createIndex({ status: 1 }).catch(() => {});
        col.createIndex({ createdAt: 1 }).catch(() => {});
        ensuredIndexes.add(tenantId);
    }
}
`;

content = content.replace(/const ensuredIndexes = new Set\(\);/, 'const ensuredIndexes = new Set();\n' + functionStr);
content = content.replace(regex, '        ensureTenantIndexes(col, tenantId);');

fs.writeFileSync('server.js', content);
console.log("Unified indexes");
