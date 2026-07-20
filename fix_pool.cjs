const fs = require('fs');
let content = fs.readFileSync('server.js', 'utf8');

content = content.replace(
  "serverApi: { version: ServerApiVersion.v1, strict: true, deprecationErrors: true },",
  "serverApi: { version: ServerApiVersion.v1, strict: true, deprecationErrors: true },\n                maxPoolSize: 200,"
);
content = content.replace(
  "const tClient = new MongoClient(tenantConfig.mongoUri, { maxPoolSize: 50 });",
  "const tClient = new MongoClient(tenantConfig.mongoUri, { maxPoolSize: 200 });"
);

fs.writeFileSync('server.js', content);
console.log("Updated connection pools");
