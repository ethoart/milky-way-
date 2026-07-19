const fs = require('fs');
let content = fs.readFileSync('server.js', 'utf8');

content = content.replace(
  "if (!centralDb) return res.status(500).json({ error: 'Central DB not connected' });\n        await centralDb.collection('tenants').updateOne({ id: tenant.id }, { $set: clean(tenant) }, { upsert: true });",
  "const db = await connectCentral();\n        await db.collection('tenants').updateOne({ id: tenant.id }, { $set: clean(tenant) }, { upsert: true });"
);

content = content.replace(
  "if (!centralDb) return res.status(500).json({ error: 'Central DB not connected' });\n        await centralDb.collection('tenants').updateOne({ id }, { $set: { settings } });",
  "const db = await connectCentral();\n        await db.collection('tenants').updateOne({ id }, { $set: { settings } });"
);

content = content.replace(
  "if (!centralDb) return res.status(500).json({ error: 'Central DB not connected' });\n        await centralDb.collection('tenants').deleteOne({ id });",
  "const db = await connectCentral();\n        await db.collection('tenants').deleteOne({ id });"
);

content = content.replace(
  "await centralDb.collection('users').updateOne",
  "await db.collection('users').updateOne"
);

fs.writeFileSync('server.js', content);
