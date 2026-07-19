const fs = require('fs');
let content = fs.readFileSync('server.js', 'utf8');
content = content.replace(
  "if (!centralDb) return res.status(500).json({ error: 'Central DB not connected' });\n        const tenants = await centralDb.collection('tenants').find({}).toArray();",
  "const db = await connectCentral();\n        const tenants = await db.collection('tenants').find({}).toArray();"
);
fs.writeFileSync('server.js', content);
