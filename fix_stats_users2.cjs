const fs = require('fs');
let content = fs.readFileSync('server.js', 'utf8');

const target = "const users = await db.collection('users').find({ tenantId }).toArray();";
content = content.replace(target, `const centralDb = await connectCentral();\n        const users = await centralDb.collection('users').find({ tenantId }).toArray();`);

fs.writeFileSync('server.js', content);
console.log("Fixed users fetching in stats (second attempt)!");
