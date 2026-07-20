const fs = require('fs');
let content = fs.readFileSync('server.js', 'utf8');

const undoStr = `        const col = db.collection('orders');
        if (!col._idIndexEnsured) {
            col.createIndex({ id: 1 }, { unique: true }).catch(() => {});
            col.createIndex({ tenantId: 1, id: 1 }).catch(() => {});
            col._idIndexEnsured = true;
        }`;

const targetStr = `const app = express();`;

const replaceStr = `const app = express();
const ensuredIndexes = new Set();`;

const correctStr = `        const col = db.collection('orders');
        if (!ensuredIndexes.has(tenantId)) {
            col.createIndex({ id: 1 }).catch(() => {});
            col.createIndex({ tenantId: 1, id: 1 }).catch(() => {});
            ensuredIndexes.add(tenantId);
        }`;

content = content.split(undoStr).join(correctStr);
if (!content.includes('const ensuredIndexes')) {
    content = content.replace(targetStr, replaceStr);
}

fs.writeFileSync('server.js', content);
console.log("Fixed auto indexing");
