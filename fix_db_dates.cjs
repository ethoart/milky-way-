const { MongoClient } = require('mongodb');
require('dotenv').config();

async function fix() {
    const client = new MongoClient(process.env.MONGODB_URI);
    await client.connect();
    const db = client.db('milkyway_central');
    
    // update all orders with RETURN_COMPLETED but no returnCompletedAt
    const result = await db.collection('orders').updateMany(
        { status: 'RETURN_COMPLETED', returnCompletedAt: { $exists: false } },
        { $set: { returnCompletedAt: new Date().toISOString() } }
    );
    console.log("Fixed missing returnCompletedAt:", result.modifiedCount);
    
    await client.close();
}
fix();
