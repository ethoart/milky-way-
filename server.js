
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
// Standard Parsers
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
// Fallback Parser: Capture anything else (like text/plain, multipart without multer, or missing content-type) as string
app.use(express.text({ type: '*/*', limit: '50mb' }));

let centralClient;
let centralDb;

async function connectCentral() {
    if (!centralClient) {
        if (!MONGODB_URI) throw new Error("MONGODB_URI is missing");
        try {
            centralClient = new MongoClient(MONGODB_URI, {
                serverApi: { version: ServerApiVersion.v1, strict: true, deprecationErrors: true },
                connectTimeoutMS: 15000
            });
            await centralClient.connect();
            centralDb = centralClient.db(CENTRAL_DB_NAME);
            console.log(">>> MW-OMS Master Node Active.");
        } catch (err) {
            centralClient = null;
            throw err;
        }
    }
    return centralDb;
}

const tenantClients = new Map();
async function getTenantDb(tenantId) {
    const db = await connectCentral();
    const tenantConfig = await db.collection('tenants').findOne({ id: tenantId });
    if (tenantConfig && tenantConfig.mongoUri) {
        if (tenantClients.has(tenantId)) return tenantClients.get(tenantId).db();
        try {
            const tClient = new MongoClient(tenantConfig.mongoUri);
            await tClient.connect();
            tenantClients.set(tenantId, tClient);
            return tClient.db();
        } catch (err) { return db; }
    }
    return db;
}

const FDE_ERRORS = {
  201: "Inactive Client",
  202: "Invalid Order ID (Numeric Required)",
  203: "Invalid Weight",
  204: "Invalid Parcel Description",
  205: "Invalid Name",
  206: "Contact Number 1 Invalid",
  207: "Contact Number 2 Invalid",
  208: "Invalid Address",
  209: "Invalid City Name",
  210: "Insert Failed",
  211: "Invalid API Key",
  212: "Invalid or Inactive Client",
  213: "Invalid Exchange Value",
  214: "Maintenance Mode"
};

const mapStatus = (courierStatus) => {
    const s = (courierStatus || '').toLowerCase();
    
    // Priority: Delivered check
    if (s.includes('delivered')) return 'DELIVERED';

    // Distinguish between forward Transfer and Return Transfer
    if (s.includes('return') && s.includes('transfer')) return 'RETURN_TRANSFER';
    if (s.includes('transfer')) return 'TRANSFER';

    if (s.includes('returned')) return 'RETURNED';
    if (s.includes('handover')) return 'RETURN_HANDOVER';
    if (s.includes('transfer')) return 'RETURN_TRANSFER';
    if (s.includes('system')) return 'RETURN_AS_ON_SYSTEM';
    if (s.includes('delivery')) return 'DELIVERY';
    if (s.includes('residual')) return 'RESIDUAL';
    if (s.includes('rearrange')) return 'REARRANGE';
    if (s.includes('waiting')) return 'PENDING';
    return 'SHIPPED'; 
};

const clean = (obj) => {
  if (!obj) return obj;
  const { _id, ...rest } = obj;
  return rest;
};

// Helper: Parse raw multipart string manually without external libs
function parseMultipartData(rawBody) {
    const result = {};
    if (!rawBody || typeof rawBody !== 'string') return result;
    
    // 1. Identify Boundary (scan first few lines)
    const lines = rawBody.split(/\r?\n/);
    let boundary = '';
    for (const line of lines) {
        if (line.trim().startsWith('--')) {
            boundary = line.trim();
            break;
        }
    }
    if (!boundary) return result;

    // 2. Split by boundary
    const parts = rawBody.split(boundary);

    for (const part of parts) {
        // 3. Find Name
        if (!part || !part.includes('name="')) continue;
        const nameMatch = part.match(/name="([^"]+)"/);
        if (!nameMatch) continue;
        
        const name = nameMatch[1];
        
        // 4. Find Value (content after double newline)
        const headerMatch = part.match(/\r?\n\r?\n/);
        if (!headerMatch) continue;

        const valueStart = headerMatch.index + headerMatch[0].length;
        let value = part.substring(valueStart).trim();
        
        // Cleanup trailing dashes from end of body
        if (value.endsWith('--')) value = value.substring(0, value.length - 2).trim();
        
        result[name] = value;
    }
    return result;
}

app.get('/api/health', (req, res) => res.json({ status: 'connected' }));

app.post('/api/login', async (req, res) => {
    try {
        const db = await connectCentral();
        const { username, password } = req.body;
        const user = await db.collection('users').findOne({ username, password });
        if (user) res.json(clean(user));
        else res.status(401).json({ error: 'Identity failure' });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/cities', async (req, res) => {
    try {
        const db = await connectCentral();
        const cityDoc = await db.collection('global_cities').findOne({ id: 'master_list' });
        res.json({ cities: cityDoc?.cities || [] });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/cities', async (req, res) => {
    try {
        const db = await connectCentral();
        const { cities } = req.body;
        await db.collection('global_cities').updateOne({ id: 'master_list' }, { $set: { cities } }, { upsert: true });
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/users', async (req, res) => {
    try {
        const { tenantId } = req.query;
        const db = await connectCentral();
        const users = await db.collection('users').find({ tenantId }).toArray();
        res.json(users.map(clean));
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/users', async (req, res) => {
    try {
        const user = req.body;
        const db = await connectCentral();
        await db.collection('users').updateOne({ id: user.id }, { $set: clean(user) }, { upsert: true });
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/users', async (req, res) => {
    try {
        const { id } = req.query;
        const db = await connectCentral();
        await db.collection('users').deleteOne({ id });
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/orders/dashboard-stats', async (req, res) => {
    try {
        const { tenantId, startDate, endDate } = req.query;
        if (!tenantId) return res.status(400).json({ error: 'Context Required' });
        
        const db = await getTenantDb(tenantId);
        const col = db.collection('orders');
        
        const dateMatch = { tenantId };
        if (startDate) dateMatch.createdAt = { $gte: startDate };
        if (endDate) {
            dateMatch.createdAt = dateMatch.createdAt || {};
            dateMatch.createdAt.$lte = endDate + 'T23:59:59';
        }

        // Global stats (all time or date filtered)
        const pipeline = [
            { $match: dateMatch },
            { $group: { 
                _id: "$status", 
                count: { $sum: 1 },
                value: { $sum: "$totalAmount" } 
            } }
        ];

        const results = await col.aggregate(pipeline).toArray();
        
        const stats = {
          deliveredCount: 0, deliveredValue: 0,
          returnedCount: 0, returnedValue: 0,
          confirmedCount: 0, confirmedValue: 0,
          shippedCount: 0, shippedValue: 0,
          restockCount: 0, restockValue: 0
        };

        results.forEach(r => {
            if (r._id === 'DELIVERED') { stats.deliveredCount = r.count; stats.deliveredValue = r.value; }
            if (['RETURNED', 'RETURN_TRANSFER', 'RETURN_AS_ON_SYSTEM', 'RETURN_HANDOVER', 'RETURN_COMPLETED'].includes(r._id)) { 
                stats.returnedCount += r.count; stats.returnedValue += r.value; 
            }
            if (r._id === 'CONFIRMED') { stats.confirmedCount = r.count; stats.confirmedValue = r.value; }
            if (r._id === 'SHIPPED') { stats.shippedCount = r.count; stats.shippedValue = r.value; }
            if (r._id === 'RESIDUAL') { stats.restockCount = r.count; stats.restockValue = r.value; } // simplistic mapping
        });

        res.json({ stats, inventory: { totalCount: 0, costValue: 0, retailValue: 0 }, dailyMap: {}, productStats: {}, teamStats: {}, todayRevenue: 0, todayDeliveredCount: 0, todayShippedCount: 0, todayReturnsCount: 0 });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/orders/counts', async (req, res) => {
    try {
        const { tenantId, productId, startDate, endDate, dateField = 'createdAt' } = req.query;
        if (!tenantId) return res.status(400).json({ error: 'Context Required' });
        
        const db = await getTenantDb(tenantId);
        const col = db.collection('orders');
        
        const matchStage = { tenantId };
        
        if (productId && productId !== 'ALL') {
            matchStage['items.productId'] = productId;
        }
        
        if (startDate || endDate) {
            matchStage[dateField] = {};
            if (startDate) matchStage[dateField].$gte = new Date(`${startDate}T00:00:00+05:30`).toISOString();
            if (endDate) matchStage[dateField].$lte = new Date(`${endDate}T23:59:59.999+05:30`).toISOString();
        }

        const pipeline = [
            { $match: matchStage },
            { $group: { 
                _id: "$status", 
                count: { $sum: 1 },
                value: { $sum: "$totalAmount" } 
            } }
        ];

        const results = await col.aggregate(pipeline).toArray();
        const total = results.reduce((sum, r) => sum + r.count, 0);
        const totalValue = results.reduce((sum, r) => sum + (r.value || 0), 0);
        
        const counts = { ALL: total, ALL_VALUE: totalValue };
        results.forEach(r => {
            if (r._id) {
                counts[r._id] = r.count;
                counts[`${r._id}_VALUE`] = r.value || 0;
            }
        });

        res.json(counts);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/orders', async (req, res) => {
    try {
        const { tenantId, id, page, limit, search, status, productId, startDate, endDate } = req.query;
        const db = await getTenantDb(tenantId);
        const col = db.collection('orders');

        if (id) {
            if (id.includes(",")) {
                const ids = id.split(",");
                const orders = await col.find({ id: { $in: ids } }).toArray();
                return res.json({ data: orders.map(clean), total: orders.length });
            }
            let order = await col.findOne({ id });
            return res.json(clean(order));

        }

        const query = { tenantId };
        
        if (status && status !== 'ALL') {
            if (status === 'TODAY_SHIPPED') {
                const dateToMatch = startDate;
                if (dateToMatch) {
                    // SL Time is UTC+5:30. So SL Midnight is previous day 18:30:00 UTC.
                    const startUtc = new Date(`${dateToMatch}T00:00:00+05:30`).toISOString();
                    const endUtc = new Date(`${dateToMatch}T23:59:59.999+05:30`).toISOString();
                    query.shippedAt = { $gte: startUtc, $lte: endUtc };
                } else if (status === 'RESIDUAL_ALL') { query.status = { $in: ['RESIDUAL', 'REARRANGE', 'HOLD'] }; } else if (status === 'RETURN_ALL') { query.status = { $in: ['RETURNED', 'RETURN_TRANSFER', 'RETURN_AS_ON_SYSTEM', 'RETURN_HANDOVER', 'RETURN_COMPLETED'] }; } else {
                    query.status = 'SHIPPED';
                }
            } else if (status === 'LOGISTICS_ALL') {
                query.status = { 
                    $in: [
                        'SHIPPED', 'DELIVERY', 'DELIVERED', 
                        'TRANSFER', 'RETURNED', 'RETURN_TRANSFER', 
                        'RETURN_HANDOVER', 'RETURN_COMPLETED', 
                        'RETURN_AS_ON_SYSTEM', 'RESIDUAL', 'REARRANGE'
                    ] 
                };
            } else if (status === 'RESIDUAL_ALL') { query.status = { $in: ['RESIDUAL', 'REARRANGE', 'HOLD'] }; } else if (status === 'RETURN_ALL') { query.status = { $in: ['RETURNED', 'RETURN_TRANSFER', 'RETURN_AS_ON_SYSTEM', 'RETURN_HANDOVER', 'RETURN_COMPLETED'] }; } else {
                query.status = status;
            }
        }

        if (productId) query['items.productId'] = productId;
        
        if (!query.shippedAt && (startDate || endDate)) {
            query.createdAt = {};
            if (startDate) query.createdAt.$gte = startDate;
            if (endDate) query.createdAt.$lte = endDate + 'T23:59:59';
        }

        if (search) {
            query.$or = [
                { id: { $regex: search, $options: 'i' } },
                { customerName: { $regex: search, $options: 'i' } },
                { customerPhone: { $regex: search, $options: 'i' } },
                { trackingNumber: { $regex: search, $options: 'i' } }
            ];
        }

        const p = parseInt(page) || 1;
        const l = parseInt(limit) || 50;
        const total = await col.countDocuments(query);
        const data = await col.find(query).sort({ createdAt: -1 }).skip((p - 1) * l).limit(l).toArray();

        res.json({ data: data.map(clean), total, page: p, limit: l });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/orders', async (req, res) => {
    try {
        const { tenantId } = req.query;
        const { order, orders } = req.body;
        const db = await getTenantDb(tenantId);
        const col = db.collection('orders');

        if (orders) {
            const ops = orders.map(o => ({ 
                updateOne: { 
                    filter: { id: o.id }, 
                    update: { $set: { ...clean(o), tenantId } }, 
                    upsert: true 
                } 
            }));
            await col.bulkWrite(ops);
        } else if (order) {
            await col.updateOne({ id: order.id }, { $set: { ...clean(order), tenantId } }, { upsert: true });
        }
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/orders', async (req, res) => {
    try {
        const { tenantId, id, purge } = req.query;
        if (!tenantId) return res.status(400).json({ error: 'Context Required' });
        const db = await getTenantDb(tenantId);
        const col = db.collection('orders');
        if (purge === 'true') {
            const result = await col.deleteMany({ tenantId });
            return res.json({ success: true, count: result.deletedCount });
        }
        if (id) {
            const ids = id.split(',');
            const result = await col.deleteMany({ id: { $in: ids }, tenantId });
            return res.json({ success: true, count: result.deletedCount });
        }
        res.status(400).json({ error: 'Missing Target' });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/customer-history', async (req, res) => {
    try {
        const { tenantId, phone } = req.query;
        if (!phone) return res.json([]);
        const db = await getTenantDb(tenantId);
        const col = db.collection('orders');
        const history = await col.find({ tenantId, customerPhone: phone }).sort({ createdAt: -1 }).toArray();
        res.json(history.map(clean));
    } catch (e) { res.status(500).json({ error: e.message }); }
});


app.get('/api/products', async (req, res) => {
    try {
        const { tenantId } = req.query;
        if (!tenantId) return res.status(400).json({ error: 'Context Required' });
        const db = await getTenantDb(tenantId);
        const products = await db.collection('products').find({ tenantId }).toArray();
        res.json(products.map(clean));
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/products', async (req, res) => {
    try {
        const { tenantId } = req.query;
        const { product } = req.body;
        if (!tenantId) return res.status(400).json({ error: 'Context Required' });
        const db = await getTenantDb(tenantId);
        await db.collection('products').updateOne({ id: product.id }, { $set: { ...clean(product), tenantId } }, { upsert: true });
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/products', async (req, res) => {
    try {
        const { tenantId, id } = req.query;
        if (!tenantId || !id) return res.status(400).json({ error: 'Context Required' });
        const db = await getTenantDb(tenantId);
        await db.collection('products').deleteOne({ id, tenantId });
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/tenants', async (req, res) => {
    try {
        if (!centralDb) return res.status(500).json({ error: 'Central DB not connected' });
        const tenants = await centralDb.collection('tenants').find({}).toArray();
        res.json(tenants.map(clean));
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/tenants', async (req, res) => {
    try {
        const { tenant, adminUser } = req.body;
        if (!centralDb) return res.status(500).json({ error: 'Central DB not connected' });
        await centralDb.collection('tenants').updateOne({ id: tenant.id }, { $set: clean(tenant) }, { upsert: true });
        if (adminUser) {
            await centralDb.collection('users').updateOne({ id: adminUser.id }, { $set: clean(adminUser) }, { upsert: true });
        }
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/tenants', async (req, res) => {
    try {
        const { id, settings } = req.body;
        if (!centralDb) return res.status(500).json({ error: 'Central DB not connected' });
        await centralDb.collection('tenants').updateOne({ id }, { $set: { settings } });
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/tenants', async (req, res) => {
    try {
        const { id } = req.query;
        if (!centralDb) return res.status(500).json({ error: 'Central DB not connected' });
        await centralDb.collection('tenants').deleteOne({ id });
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/ship-order', async (req, res) => {
    try {
        const { tenantId } = req.query;
        const { order } = req.body;
        if (!tenantId) return res.status(400).json({ error: 'Context Required' });
        const db = await getTenantDb(tenantId);
        await db.collection('orders').updateOne({ id: order.id }, { $set: { ...clean(order), tenantId } }, { upsert: true });
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/customer-history-detailed', async (req, res) => {
    try {
        const { tenantId, phone } = req.query;
        if (!phone) return res.json([]);
        const db = await getTenantDb(tenantId);
        const history = await db.collection('orders').find({ tenantId, customerPhone: phone }).sort({ createdAt: -1 }).toArray();
        res.json(history.map(clean));
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/process-return', async (req, res) => {
    try {
        const { tenantId } = req.query;
        const { trackingOrId } = req.body;
        if (!tenantId) return res.status(400).json({ error: 'Context Required' });
        const db = await getTenantDb(tenantId);
        const order = await db.collection('orders').findOne({ tenantId, $or: [{ id: trackingOrId }, { trackingNumber: trackingOrId }] });
        if (!order) return res.status(404).json({ error: 'Not Found' });
        order.status = 'RETURN_COMPLETED';
        await db.collection('orders').updateOne({ id: order.id }, { $set: { ...clean(order), tenantId } });
        res.json(clean(order));
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/security-logs', async (req, res) => {
    res.json([]);
});

if (process.env.NODE_ENV !== "production") {
    import('vite').then(async (vite) => {
        const viteServer = await vite.createServer({
            server: { middlewareMode: true },
            appType: 'spa',
        });
        app.use(viteServer.middlewares);
        app.listen(PORT, "0.0.0.0", () => console.log(`Dev Server http://localhost:${PORT}`));
    });
} else {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'dist', 'index.html')));
    app.listen(PORT, "0.0.0.0", () => console.log(`Prod Server http://localhost:${PORT}`));
}
