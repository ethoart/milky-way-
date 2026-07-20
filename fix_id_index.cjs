const fs = require('fs');

let content = fs.readFileSync('server.js', 'utf8');

content = content.replace(
  `            if (id.includes(",")) {
                const ids = id.split(",");
                const orders = await col.find({ id: { $in: ids } }).toArray();
                return res.json({ data: orders.map(clean), total: orders.length });
            }
            let order = await col.findOne({ id });`,
  `            if (id.includes(",")) {
                const ids = id.split(",");
                const orders = await col.find({ tenantId, id: { $in: ids } }).toArray();
                return res.json({ data: orders.map(clean), total: orders.length });
            }
            let order = await col.findOne({ tenantId, id });`
);

// Also add to setup-indexes
content = content.replace(
  `            await col.createIndex({ tenantId: 1, status: 1 });`,
  `            await col.createIndex({ tenantId: 1, status: 1 });
            await col.createIndex({ id: 1 }, { unique: true });
            await col.createIndex({ tenantId: 1, id: 1 });`
);

fs.writeFileSync('server.js', content);
console.log("Fixed server.js");

const { MongoClient } = require('mongodb');
require('dotenv').config();

async function run() {
    if (!process.env.MONGODB_URI) { console.error("no uri"); return; }
    const client = new MongoClient(process.env.MONGODB_URI);
    await client.connect();
    
    const centralDb = client.db('milkyway_central');
    const tenants = await centralDb.collection('tenants').find({}).toArray();
    for (const t of tenants) {
        if (t.mongoUri) {
            try {
                const tClient = new MongoClient(t.mongoUri);
                await tClient.connect();
                const tDb = tClient.db();
                console.log("Creating id index for", t.id);
                await tDb.collection('orders').createIndex({ id: 1 }, { unique: true });
                await tDb.collection('orders').createIndex({ tenantId: 1, id: 1 });
                await tClient.close();
            } catch (err) { console.error("Error on tenant", t.id, err.message); }
        }
    }
    await client.close();
    console.log("Indexes created");
}
run();
