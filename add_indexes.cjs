const { MongoClient, ServerApiVersion } = require('mongodb');
require('dotenv').config();
const MONGODB_URI = process.env.MONGODB_URI;
async function run() {
    if (!MONGODB_URI) { console.error("no uri"); return; }
    const client = new MongoClient(MONGODB_URI);
    await client.connect();
    
    // For central db
    const centralDb = client.db('milkyway_central');
    await centralDb.collection('tenants').createIndex({ id: 1 }, { unique: true });
    
    const tenants = await centralDb.collection('tenants').find({}).toArray();
    for (const t of tenants) {
        if (t.mongoUri) {
            try {
                const tClient = new MongoClient(t.mongoUri);
                await tClient.connect();
                const tDb = tClient.db();
                console.log("Creating indexes for", t.id);
                await tDb.collection('orders').createIndex({ tenantId: 1 });
                await tDb.collection('orders').createIndex({ status: 1 });
                await tDb.collection('orders').createIndex({ createdAt: 1 });
                await tDb.collection('orders').createIndex({ tenantId: 1, createdAt: -1 });
                await tDb.collection('orders').createIndex({ customerPhone: 1 });
                await tDb.collection('products').createIndex({ tenantId: 1 });
                await tDb.collection('users').createIndex({ tenantId: 1 });
                await tClient.close();
            } catch (err) { console.error("Error on tenant", t.id, err.message); }
        }
    }
    
    // Also index central db orders and products just in case they use central db for tenant data
    await centralDb.collection('orders').createIndex({ tenantId: 1 });
    await centralDb.collection('orders').createIndex({ status: 1 });
    await centralDb.collection('orders').createIndex({ createdAt: 1 });
    await centralDb.collection('orders').createIndex({ tenantId: 1, createdAt: -1 });
    await centralDb.collection('orders').createIndex({ customerPhone: 1 });
    await centralDb.collection('products').createIndex({ tenantId: 1 });
    await centralDb.collection('users').createIndex({ tenantId: 1 });

    await client.close();
    console.log("Indexes created successfully!");
}
run();
