const fs = require('fs');
let content = fs.readFileSync('server.js', 'utf8');

const funcTargetStr = `        col.createIndex({ tenantId: 1, "items.productId": 1 }).catch(() => {});`;
const funcReplaceStr = `        col.createIndex({ tenantId: 1, "items.productId": 1 }).catch(() => {});
        col.createIndex({ tenantId: 1, customerPhone: 1 }).catch(() => {});`;

content = content.replace(funcTargetStr, funcReplaceStr);

fs.writeFileSync('server.js', content);
console.log("Added customerPhone index");
