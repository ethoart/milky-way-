const fs = require('fs');
let content = fs.readFileSync('server.js', 'utf8');

const targetStr = `        const col = db.collection('orders');`;

const replaceStr = `        const col = db.collection('orders');
        if (!col._idIndexEnsured) {
            col.createIndex({ id: 1 }, { unique: true }).catch(() => {});
            col.createIndex({ tenantId: 1, id: 1 }).catch(() => {});
            col._idIndexEnsured = true;
        }`;

content = content.replace(targetStr, replaceStr); // this will replace the first occurrence
// Let's replace all occurrences just to be safe
content = content.split(targetStr).join(replaceStr);

fs.writeFileSync('server.js', content);
console.log("Added auto indexing");
