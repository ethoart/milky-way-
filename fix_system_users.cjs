const fs = require('fs');
let content = fs.readFileSync('server.js', 'utf8');

content = content.replace(
  /if \(\!uname \|\| uname === 'System' \|\| uname === 'DEV_ADMIN'\) return;/g,
  `if (!uname || ['System', 'DEV_ADMIN', 'Courier System', 'OMS Connector', 'OMS Scanner'].includes(uname)) return;`
);

fs.writeFileSync('server.js', content);
console.log("Fixed system users");
