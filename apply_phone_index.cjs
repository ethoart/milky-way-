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
                console.log("Creating phone index for", t.id);
                await tDb.collection('orders').createIndex({ tenantId: 1, customerPhone: 1 }).catch(()=>{});
                await tClient.close();
            } catch (err) { console.error("Error on tenant", t.id, err.message); }
        }
    }
    await client.close();
    console.log("Indexes created");
}
run();
