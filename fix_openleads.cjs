const fs = require('fs');
let content = fs.readFileSync('server.js', 'utf8');

content = content.replace(
  `if (msg.includes('OPEN_LEAD')) teamStats[uname].openLeads++;`,
  `if (msg.includes('OPEN_LEAD') || msg.includes('Manual Creation') || msg.includes('System Ingestion')) teamStats[uname].openLeads++;`
);

fs.writeFileSync('server.js', content);
console.log("Fixed openLeads");
