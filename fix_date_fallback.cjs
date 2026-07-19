const fs = require('fs');
let content = fs.readFileSync('server.js', 'utf8');

const t = `const returnCompletedDate = o.returnCompletedAt ? getSLDateString(new Date(o.returnCompletedAt)) : (o.status === 'RETURN_COMPLETED' ? getSLDateString(new Date(o.createdAt || new Date())) : null);`;

const rep = `
            let inferredReturnDate = null;
            if (o.status === 'RETURN_COMPLETED' && !o.returnCompletedAt && o.logs) {
                const returnLog = o.logs.find(l => l.message && l.message.includes('RETURN_COMPLETED'));
                if (returnLog && returnLog.timestamp) inferredReturnDate = returnLog.timestamp;
            }
            const returnCompletedDate = o.returnCompletedAt ? getSLDateString(new Date(o.returnCompletedAt)) : (o.status === 'RETURN_COMPLETED' ? getSLDateString(new Date(inferredReturnDate || o.createdAt || new Date())) : null);
`;

content = content.replace(t, rep);
fs.writeFileSync('server.js', content);
console.log("Fixed date fallback");
