const fs = require('fs');
let content = fs.readFileSync('server.js', 'utf8');

const targetStr = `if (!uname || ['System', 'DEV_ADMIN', 'Courier System', 'OMS Connector', 'OMS Scanner'].includes(uname)) return;`;
const replaceStr = `
const un = (uname || '').trim().toLowerCase();
if (!un || ['system', 'dev_admin', 'courier system', 'oms connector', 'oms scanner'].includes(un)) return;
`;

content = content.replace(targetStr, replaceStr);
fs.writeFileSync('server.js', content);
console.log("Fixed user filtering");
