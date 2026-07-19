const fs = require('fs');
let content = fs.readFileSync('server.js', 'utf8');

const t1 = `order.status = 'RETURN_COMPLETED';`;
const rep1 = `order.status = 'RETURN_COMPLETED';
        order.returnCompletedAt = new Date().toISOString();`;

content = content.replace(t1, rep1);

const t2 = `const returnCompletedDate = o.returnCompletedAt ? getSLDateString(new Date(o.returnCompletedAt)) : null;`;
const rep2 = `const returnCompletedDate = o.returnCompletedAt ? getSLDateString(new Date(o.returnCompletedAt)) : (o.status === 'RETURN_COMPLETED' ? getSLDateString(new Date(o.createdAt || new Date())) : null);`;

content = content.replace(t2, rep2);

fs.writeFileSync('server.js', content);
console.log("Fixed returnCompletedAt logic!");
