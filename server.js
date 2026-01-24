import express from 'express';
import cors from 'cors';
import { MongoClient, ServerApiVersion } from 'mongodb';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 8080;
const MONGODB_URI = process.env.MONGODB_URI;
const CENTRAL_DB_NAME = 'milkyway_central';

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Static frontend serving for VPS
app.use(express.static(path.join(__dirname, 'dist')));

let client;
let centralDb;

async function connectDb() {
    if (!client) {
        client = new MongoClient(MONGODB_URI, {
            serverApi: { version: ServerApiVersion.v1, strict: true, deprecationErrors: true },
            maxPoolSize: 20,
            minPoolSize: 5
        });
        await client.connect();
        centralDb = client.db(CENTRAL_DB_NAME);
        console.log("MILKY WAY: Node Grid Online.");
    }
    return centralDb;
}

// Middleware to get specific tenant DB
async function getTenantDb(tenantId) {
    const db = await connectDb();
    const tenantsCol = db.collection('tenants');
    const tenantConfig = await tenantsCol.findOne({ id: tenantId });
    if (tenantConfig && tenantConfig.mongoUri) {
        const tClient = new MongoClient(tenantConfig.mongoUri);
        await tClient.connect();
        const dbName = new URL(tenantConfig.mongoUri).pathname.slice(1) || `mw_cluster_${tenantId}`;
        return tClient.db(dbName);
    }
    return db;
}

// API ROUTES
app.get('/api/health', (req, res) => res.json({ status: 'operational' }));

app.post('/api/login', async (req, res) => {
    const db = await connectDb();
    const { username, password } = req.body;
    const user = await db.collection('users').findOne({ username, password });
    if (user) {
        const { password: _, ...safeUser } = user;
        res.json(safeUser);
    } else {
        res.status(401).json({ error: 'Identity mismatch' });
    }
});

app.get('/api/tenants', async (req, res) => {
    const db = await connectDb();
    res.json(await db.collection('tenants').find({}).toArray());
});

app.post('/api/tenants', async (req, res) => {
    const db = await connectDb();
    const { tenant, adminUser } = req.body;
    await db.collection('tenants').updateOne({ id: tenant.id }, { $set: tenant }, { upsert: true });
    if (adminUser) {
        await db.collection('users').updateOne({ tenantId: tenant.id, role: 'SUPER_ADMIN' }, { $set: adminUser }, { upsert: true });
    }
    res.json({ success: true });
});

app.get('/api/orders', async (req, res) => {
    const { tenantId, id } = req.query;
    const db = await getTenantDb(tenantId);
    if (id) {
        res.json(await db.collection('orders').findOne({ id }));
    } else {
        res.json(await db.collection('orders').find({ tenantId }).sort({ createdAt: -1 }).toArray());
    }
});

app.post('/api/orders', async (req, res) => {
    const { tenantId } = req.query;
    const { order, orders } = req.body;
    const db = await getTenantDb(tenantId);
    const ordersCol = db.collection('orders');

    if (orders) {
        const ops = orders.map(o => ({ updateOne: { filter: { id: o.id }, update: { $set: { ...o, tenantId } }, upsert: true } }));
        await ordersCol.bulkWrite(ops);
    } else if (order) {
        const { _id, ...data } = order;
        await ordersCol.updateOne({ id: order.id }, { $set: { ...data, tenantId } }, { upsert: true });
    }
    res.json({ success: true });
});

app.delete('/api/orders', async (req, res) => {
    const { id, tenantId } = req.query;
    const db = await getTenantDb(tenantId);
    await db.collection('orders').deleteOne({ id });
    res.json({ success: true });
});

app.get('/api/products', async (req, res) => {
    const { tenantId } = req.query;
    const db = await getTenantDb(tenantId);
    res.json(await db.collection('products').find({ tenantId }).toArray());
});

app.post('/api/products', async (req, res) => {
    const { tenantId } = req.query;
    const { product } = req.body;
    const db = await getTenantDb(tenantId);
    const { _id, ...data } = product;
    await db.collection('products').updateOne({ id: product.id }, { $set: data }, { upsert: true });
    res.json({ success: true });
});

app.get('/api/users', async (req, res) => {
    const db = await connectDb();
    const { tenantId } = req.query;
    res.json(await db.collection('users').find({ tenantId }).toArray());
});

app.post('/api/users', async (req, res) => {
    const db = await connectDb();
    const user = req.body;
    await db.collection('users').updateOne({ id: user.id }, { $set: user }, { upsert: true });
    res.json({ success: true });
});

app.delete('/api/users', async (req, res) => {
    const db = await connectDb();
    await db.collection('users').deleteOne({ id: req.query.id });
    res.json({ success: true });
});

// Handle SPA routing
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`MILKY WAY STANDALONE: Running on port ${PORT}`);
});