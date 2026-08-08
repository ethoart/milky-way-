
import compression from 'compression';
import express from 'express';
import cors from 'cors';
import { MongoClient, ServerApiVersion } from 'mongodb';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 8080;
const MONGODB_URI = process.env.MONGODB_URI;
const CENTRAL_DB_NAME = 'milkyway_central';

app.use(cors());
app.use(compression());
// Standard Parsers
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
// Fallback Parser: Capture anything else (like text/plain, multipart without multer, or missing content-type) as string
app.use(express.text({ type: '*/*', limit: '50mb' }));

let centralDbPromise = null;

async function connectCentral() {
    if (!centralDbPromise) {
        if (!MONGODB_URI) {
            return Promise.reject(new Error("MONGODB_URI is missing"));
        }
        centralDbPromise = (async () => {
            const client = new MongoClient(MONGODB_URI, {
                serverApi: { version: ServerApiVersion.v1, strict: true, deprecationErrors: true },
                connectTimeoutMS: 15000,
                maxPoolSize: 50
            });
            await client.connect();
            console.log(">>> MW-OMS Master Node Active.");
            const db = client.db(CENTRAL_DB_NAME);

            // Self-healing database migration for admin users
            try {
                const usersCol = db.collection('users');
                const badUsers = await usersCol.find({ 
                    $or: [
                        { id: { $exists: false } }, 
                        { id: null }, 
                        { id: "" }, 
                        { id: undefined }
                    ] 
                }).toArray();

                if (badUsers.length > 0) {
                    console.log(`>>> DB Migration: found ${badUsers.length} users with null/missing IDs. Starting cleanup...`);
                    for (const u of badUsers) {
                        const safeTenantId = u.tenantId || 'master-default';
                        const safeId = `u-admin-${safeTenantId}`;

                        // Delete the old corrupted document
                        await usersCol.deleteOne({ _id: u._id });

                        // Insert/Upsert the healed document with a clean unique ID
                        const fixedUser = {
                            id: safeId,
                            username: u.username,
                            password: u.password,
                            email: u.email || u.username,
                            role: 'SUPER_ADMIN',
                            tenantId: safeTenantId,
                            permissions: u.permissions || ['ALL_PERMISSIONS']
                        };
                        await usersCol.updateOne({ id: safeId }, { $set: fixedUser }, { upsert: true });
                        console.log(`>>> DB Migration: Successfully healed user ${u.username} with ID ${safeId} to SUPER_ADMIN`);
                    }
                }

                // Auto-upgrade u-admin-* users to SUPER_ADMIN
                const adminUsers = await usersCol.find({ id: { $regex: /^u-admin-/ } }).toArray();
                for (const u of adminUsers) {
                    if (u.role !== 'SUPER_ADMIN') {
                        await usersCol.updateOne({ id: u.id }, { $set: { role: 'SUPER_ADMIN' } });
                        console.log(`>>> DB Migration: Upgraded role of ${u.username} to SUPER_ADMIN`);
                    }
                }
            } catch (err) {
                console.error(">>> DB Migration Error:", err);
            }

            return db;
        })();
        centralDbPromise.catch(err => {
            centralDbPromise = null;
        });
    }
    return centralDbPromise;
}

const tenantDbs = new Map();

// In-memory query caching & live tracking layer
const queryCache = new Map();
const tenantLastAction = new Map();

function getCache(tenantId, queryType, cacheKey) {
    if (!tenantId) return null;
    const tenantMap = queryCache.get(tenantId.toString());
    if (!tenantMap) return null;
    const cacheEntry = tenantMap.get(`${queryType}:${cacheKey}`);
    if (!cacheEntry) return null;
    
    // Cache is valid for 15 seconds (prevents slamming DB during concurrency)
    if (Date.now() - cacheEntry.timestamp < 15000) {
        return cacheEntry.data;
    }
    tenantMap.delete(`${queryType}:${cacheKey}`);
    return null;
}

function setCache(tenantId, queryType, cacheKey, data) {
    if (!tenantId) return;
    const tid = tenantId.toString();
    let tenantMap = queryCache.get(tid);
    if (!tenantMap) {
        tenantMap = new Map();
        queryCache.set(tid, tenantMap);
    }
    tenantMap.set(`${queryType}:${cacheKey}`, {
        data,
        timestamp: Date.now()
    });
}

function clearTenantCache(tenantId) {
    if (!tenantId) return;
    const tid = tenantId.toString();
    queryCache.delete(tid);
    tenantLastAction.set(tid, Date.now());
}

async function ensureTenantIndexes(db, tenantId) {
    try {
        const ordersCol = db.collection('orders');
        const indexesToCreate = [
            { spec: { id: 1 }, options: { unique: true } },
            { spec: { tenantId: 1 } },
            { spec: { status: 1 } },
            { spec: { createdAt: 1 } },
            { spec: { shippedAt: 1 } },
            { spec: { confirmedAt: 1 } },
            { spec: { deliveredAt: 1 } },
            { spec: { returnedAt: 1 } },
            { spec: { returnCompletedAt: 1 } },
            { spec: { tenantId: 1, createdAt: -1 } },
            { spec: { tenantId: 1, status: 1 } },
            { spec: { tenantId: 1, customerPhone: 1 } },
            { spec: { tenantId: 1, shippedAt: 1 } },
            { spec: { tenantId: 1, confirmedAt: 1 } },
            { spec: { tenantId: 1, deliveredAt: 1 } },
            { spec: { tenantId: 1, returnedAt: 1 } },
            { spec: { tenantId: 1, returnCompletedAt: 1 } },
            { spec: { tenantId: 1, "logs.timestamp": 1 } },
            { spec: { trackingNumber: 1 } },
            { spec: { customerName: 1 } },
            { spec: { "logs.timestamp": 1 } }
        ];
        
        for (const index of indexesToCreate) {
            try {
                await ordersCol.createIndex(index.spec, index.options || {});
            } catch (e) {
                if (index.options && index.options.unique) {
                    try {
                        await ordersCol.createIndex(index.spec, {});
                    } catch (e2) {
                        console.error(`Failed to create index ${JSON.stringify(index.spec)}:`, e2);
                    }
                } else {
                    console.error(`Failed to create index ${JSON.stringify(index.spec)}:`, e);
                }
            }
        }
        
        const productsCol = db.collection('products');
        const productIndexes = [
            { spec: { id: 1 }, options: { unique: true } },
            { spec: { tenantId: 1 } }
        ];
        for (const index of productIndexes) {
            try {
                await productsCol.createIndex(index.spec, index.options || {});
            } catch (e) {
                if (index.options && index.options.unique) {
                    try {
                        await productsCol.createIndex(index.spec, {});
                    } catch (e2) {}
                }
            }
        }
        console.log(`Indexes successfully checked/created for tenant database: ${tenantId}`);
    } catch (err) {
        console.error(`Failed to ensure indexes for tenant ${tenantId}:`, err);
    }
}

async function getTenantDb(tenantId) {
    if (tenantDbs.has(tenantId)) return tenantDbs.get(tenantId);
    const db = await connectCentral();
    const tenantConfig = await db.collection('tenants').findOne({ id: tenantId });
    if (tenantConfig && tenantConfig.mongoUri) {
        try {
            const tClient = new MongoClient(tenantConfig.mongoUri, { maxPoolSize: 50 });
            await tClient.connect();
            const tDb = tClient.db();
            tenantDbs.set(tenantId, tDb);
            ensureTenantIndexes(tDb, tenantId);
            return tDb;
        } catch (err) { 
            tenantDbs.set(tenantId, db);
            ensureTenantIndexes(db, tenantId);
            return db; 
        }
    }
    tenantDbs.set(tenantId, db);
    ensureTenantIndexes(db, tenantId);
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
    const s = (courierStatus || '').toLowerCase().trim();
    if (!s) return 'SHIPPED';

    // Handle return-related statuses first to avoid overlap
    if (s.includes('return') || s.includes('rtn')) {
        if (s.includes('transfer')) return 'RETURN_TRANSFER';
        if (s.includes('handover')) return 'RETURN_HANDOVER';
        if (s.includes('complete') || s.includes('completed') || s.includes('done') || s.includes('receive') || s.includes('received')) return 'RETURN_COMPLETED';
        return 'RETURNED';
    }

    // Handle delivered-related statuses next
    if (
        s.includes('delivered') || 
        s.includes('success') || 
        s.includes('complete') || 
        s.includes('completed') || 
        s.includes('done') || 
        s.includes('delivered to customer') || 
        s.includes('delivery success') ||
        s.includes('cod paid') || 
        s.includes('cod_paid') || 
        s.includes('cod collected') || 
        s.includes('cod_collected') || 
        s.includes('paid') || 
        s.includes('settled') || 
        s.includes('collected') || 
        s.includes('successful') || 
        s.includes('closed')
    ) {
        return 'DELIVERED';
    }

    // Handle other states
    if (s.includes('transfer')) return 'TRANSFER';
    if (s.includes('delivery')) return 'DELIVERY';
    if (s.includes('residual')) return 'RESIDUAL';
    if (s.includes('rearrange')) return 'REARRANGE';
    if (s.includes('waiting') || s.includes('pending')) return 'PENDING';
    if (s.includes('system')) return 'RETURN_AS_ON_SYSTEM';

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


app.get('/api/setup-indexes', async (req, res) => {
    try {
        const tenantId = req.query.tenantId || req.body.tenantId;
        const centralDb = await connectCentral();
        await centralDb.collection('tenants').createIndex({ id: 1 }, { unique: true });
        
        if (tenantId) {
            const db = await getTenantDb(tenantId);
            const col = db.collection('orders');
            await col.createIndex({ tenantId: 1 });
            await col.createIndex({ status: 1 });
            await col.createIndex({ createdAt: 1 });
            await col.createIndex({ shippedAt: 1 });
            await col.createIndex({ tenantId: 1, createdAt: -1 });
            await col.createIndex({ tenantId: 1, status: 1 });
            return res.json({ success: true, message: 'Indexes created for tenant ' + tenantId });
        }
        res.json({ success: true, message: 'Central indexes created' });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});


app.get('/api/log-users', async (req, res) => {
    try {
        const tenantId = req.query.tenantId || req.body.tenantId;
        if (tenantId) {
            const db = await getTenantDb(tenantId);
            const col = db.collection('orders');
            
            // Get sample logs to see their case
            const orders = await col.find({"logs.user": { $regex: /Courier|OMS|System|DEV/i }}).limit(10).toArray();
            const users = new Set();
            orders.forEach(o => {
               o.logs.forEach(l => { if (l.user) users.add(l.user); });
            });
            return res.json({ users: Array.from(users) });
        }
        res.json({ error: 'tenantId missing' });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/health', (req, res) => res.json({ status: 'connected', env: Object.keys(process.env).join(',') }));

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
        const tenantId = req.query.tenantId || req.body.tenantId;
        const db = await connectCentral();
        const centralDb = await connectCentral();
        const users = await centralDb.collection('users').find({ tenantId }).toArray();
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

app.get('/api/debug-database', async (req, res) => {
    try {
        const db = await connectCentral();
        const tenants = await db.collection('tenants').find({}).toArray();
        const users = await db.collection('users').find({}).toArray();
        const results = { tenants, users, tenantOrders: {} };
        for (const t of tenants) {
            const tDb = await getTenantDb(t.id);
            const orders = await tDb.collection('orders').find({}).toArray();
            results.tenantOrders[t.id] = orders.map(o => ({
                id: o.id,
                trackingNumber: o.trackingNumber,
                status: o.status,
                createdAt: o.createdAt,
                shippedAt: o.shippedAt,
                deliveredAt: o.deliveredAt,
                returnedAt: o.returnedAt,
                returnCompletedAt: o.returnCompletedAt
            }));
        }
        res.json(results);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/orders/dashboard-stats', async (req, res) => {
    try {
        const { tenantId, startDate, endDate } = req.query;
        if (!tenantId) return res.status(400).json({ error: 'Context Required' });
        
        const cacheKey = `${startDate || 'default'}_${endDate || 'default'}`;
        const cachedData = getCache(tenantId, 'dashboard-stats', cacheKey);
        if (cachedData) {
            return res.json(cachedData);
        }
        
        function getSLDateString(d) {
            try {
                return new Intl.DateTimeFormat('en-CA', {
                    timeZone: 'Asia/Colombo',
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit'
                }).format(d);
            } catch (err) {
                try {
                    const slTime = new Date(d.getTime() + (5.5 * 60 * 60 * 1000));
                    return slTime.toISOString().split('T')[0];
                } catch (e) {
                    return null;
                }
            }
        }

        const db = await getTenantDb(tenantId);
        const col = db.collection('orders');
        
        const today = getSLDateString(new Date());
        const products = await db.collection('products').find({ tenantId }).toArray();
        const centralDb = await connectCentral();
        const users = await centralDb.collection('users').find({ tenantId }).toArray();
        
        const dailyMap = {};
        const dStart = startDate ? new Date(startDate) : new Date(new Date().setDate(new Date().getDate() - 30));
        const dEnd = endDate ? new Date(endDate) : new Date();
        for (let d = new Date(dStart); d <= dEnd; d.setDate(d.getDate() + 1)) {
            const slDate = getSLDateString(d);
            let formatOptions = { month: 'short', day: 'numeric' };
            if (dStart.getFullYear() !== dEnd.getFullYear() || !startDate) {
                formatOptions.year = '2-digit';
            }
            try {
                dailyMap[slDate] = { 
                    date: new Intl.DateTimeFormat('en-US', formatOptions).format(d), 
                    monthKey: new Intl.DateTimeFormat('en-US', { month: 'short', year: '2-digit' }).format(d),
                    sales: 0, 
                    shipped: 0 
                };
            } catch (e) {
                dailyMap[slDate] = { 
                    date: d.toLocaleDateString('en-US', formatOptions), 
                    monthKey: d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
                    sales: 0, 
                    shipped: 0 
                };
            }
        }
        
        let inventoryTotalCount = 0;
        let inventoryCostValue = 0;
        let inventoryRetailValue = 0;
        const productStats = {};
        products.forEach(p => {
            let pStock = 0;
            if (p.batches && p.batches.length > 0) {
                p.batches.forEach(b => {
                    pStock += (b.quantity || 0);
                    inventoryCostValue += ((b.quantity || 0) * (b.buyingPrice || 0));
                });
            } else {
                pStock = p.stock || 0;
                // fallback to 0 cost if no batches
            }
            inventoryTotalCount += pStock;
            inventoryRetailValue += (pStock * (p.price || 0));
            productStats[p.id] = { 
                sku: p.sku || 'Unknown', name: p.name || 'Unknown', salesCount: 0, confirmed: 0, 
                shipped: 0, delivered: 0, returned: 0, upcomingReturn: 0, revenue: 0, profit: 0, buyingPrice: (p.batches && p.batches.length > 0) ? p.batches[0].buyingPrice : 0 
            };
        });
        
        const teamStats = {};

        let query = { tenantId };
        
        if (startDate && endDate) {
            const sDate = new Date(`${startDate}T00:00:00+05:30`).toISOString();
            const eDate = new Date(`${endDate}T23:59:59.999+05:30`).toISOString();
            const tDate = new Date(`${today}T00:00:00+05:30`).toISOString();
            const tEndDate = new Date(`${today}T23:59:59.999+05:30`).toISOString();
            const wDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
            
            query.$or = [
                { createdAt: { $gte: sDate, $lte: eDate } },
                { shippedAt: { $gte: sDate, $lte: eDate } },
                { confirmedAt: { $gte: sDate, $lte: eDate } },
                { deliveredAt: { $gte: sDate, $lte: eDate } },
                { returnedAt: { $gte: sDate, $lte: eDate } },
                { returnCompletedAt: { $gte: sDate, $lte: eDate } },
                { "logs.timestamp": { $gte: sDate, $lte: eDate } },
                { createdAt: { $gte: tDate, $lte: tEndDate } },
                { shippedAt: { $gte: tDate, $lte: tEndDate } },
                { deliveredAt: { $gte: tDate, $lte: tEndDate } },
                { returnedAt: { $gte: tDate, $lte: tEndDate } },
                { returnCompletedAt: { $gte: tDate, $lte: tEndDate } },
                { createdAt: { $gte: wDate } },
                { shippedAt: { $gte: wDate } },
                { deliveredAt: { $gte: wDate } },
                { returnedAt: { $gte: wDate } },
                { returnCompletedAt: { $gte: wDate } }
            ];
        }

        const allOrders = await col.find(query).project({ createdAt: 1, shippedAt: 1, confirmedAt: 1, deliveredAt: 1, returnedAt: 1, returnCompletedAt: 1, status: 1, totalAmount: 1, items: 1, 'logs.message': 1, 'logs.user': 1, 'logs.timestamp': 1 }).toArray();
        
        let deliveredCount = 0, returnedCount = 0, confirmedCount = 0, shippedCount = 0, restockCount = 0;
        let deliveredValue = 0, returnedValue = 0, confirmedValue = 0, shippedValue = 0, restockValue = 0;
        let todayOrders = 0, todayRevenue = 0, todayShippedCount = 0, todayReturnsCount = 0, todayDeliveredCount = 0;
        let weeklyDeliveredCount = 0, weeklyReturnsCount = 0;
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        const sevenDaysAgoStr = getSLDateString(sevenDaysAgo);

        allOrders.forEach(o => {
            const createDate = o.createdAt ? getSLDateString(new Date(o.createdAt)) : null;
            const wasShipped = !!o.shippedAt || ['SHIPPED', 'TRANSFER', 'DELIVERY', 'DELIVERED', 'RETURNED', 'RETURN_TRANSFER', 'RETURN_AS_ON_SYSTEM', 'RETURN_HANDOVER', 'RETURN_COMPLETED', 'RESIDUAL', 'REARRANGE', 'HOLD'].includes(o.status);
            const shipDate = o.shippedAt ? getSLDateString(new Date(o.shippedAt)) : (wasShipped ? getSLDateString(new Date(o.createdAt)) : null);
            const confirmDate = o.confirmedAt ? getSLDateString(new Date(o.confirmedAt)) : null;

            // Inferred / actual delivery date
            let actualDeliverDate = null;
            if (o.deliveredAt) {
                actualDeliverDate = o.deliveredAt;
            } else if (o.status === 'DELIVERED') {
                if (o.logs && Array.isArray(o.logs)) {
                    for (let i = o.logs.length - 1; i >= 0; i--) {
                        const log = o.logs[i];
                        if (log && log.message) {
                            if (log.message.includes('transitioned to DELIVERED')) {
                                actualDeliverDate = log.timestamp;
                                break;
                            }
                            if (log.message.includes('WEBHOOK: Status update to')) {
                                const match = log.message.match(/WEBHOOK: Status update to ([^\[]+)/);
                                if (match) {
                                    const rawStat = match[1].trim();
                                    if (mapStatus(rawStat) === 'DELIVERED') {
                                        actualDeliverDate = log.timestamp;
                                        break;
                                    }
                                }
                            }
                        }
                    }
                }
                if (!actualDeliverDate) {
                    actualDeliverDate = o.shippedAt || o.createdAt;
                }
            }
            const deliverDate = actualDeliverDate ? getSLDateString(new Date(actualDeliverDate)) : null;

            // Inferred / actual return date (when return was initiated)
            let actualReturnDate = null;
            const returnStatuses = ['RETURNED', 'RETURN_TRANSFER', 'RETURN_AS_ON_SYSTEM', 'RETURN_HANDOVER', 'RETURN_COMPLETED'];
            const isCurrentlyReturned = returnStatuses.includes(o.status);

            if (o.returnedAt) {
                actualReturnDate = o.returnedAt;
            } else if (isCurrentlyReturned) {
                if (o.logs && Array.isArray(o.logs)) {
                    for (let i = o.logs.length - 1; i >= 0; i--) {
                        const log = o.logs[i];
                        if (log && log.message) {
                            let foundTransition = false;
                            for (const rStat of returnStatuses) {
                                if (log.message.includes(`transitioned to ${rStat}`)) {
                                    actualReturnDate = log.timestamp;
                                    foundTransition = true;
                                    break;
                                }
                            }
                            if (foundTransition) break;

                            if (log.message.includes('WEBHOOK: Status update to')) {
                                const match = log.message.match(/WEBHOOK: Status update to ([^\[]+)/);
                                if (match) {
                                    const rawStat = match[1].trim();
                                    const mapped = mapStatus(rawStat);
                                    if (returnStatuses.includes(mapped)) {
                                        actualReturnDate = log.timestamp;
                                        break;
                                    }
                                }
                            }
                        }
                    }
                }
                if (!actualReturnDate) {
                    actualReturnDate = o.returnCompletedAt || o.createdAt;
                }
            }
            const returnedDate = actualReturnDate ? getSLDateString(new Date(actualReturnDate)) : null;

            // Inferred / actual return completed date (when restocked)
            let actualReturnCompletedDate = null;
            if (o.returnCompletedAt) {
                actualReturnCompletedDate = o.returnCompletedAt;
            } else if (o.status === 'RETURN_COMPLETED') {
                if (o.logs && Array.isArray(o.logs)) {
                    for (let i = o.logs.length - 1; i >= 0; i--) {
                        const log = o.logs[i];
                        if (log && log.message) {
                            if (log.message.includes('transitioned to RETURN_COMPLETED')) {
                                actualReturnCompletedDate = log.timestamp;
                                break;
                            }
                            if (log.message.includes('WEBHOOK: Status update to')) {
                                const match = log.message.match(/WEBHOOK: Status update to ([^\[]+)/);
                                if (match) {
                                    const rawStat = match[1].trim();
                                    if (mapStatus(rawStat) === 'RETURN_COMPLETED') {
                                        actualReturnCompletedDate = log.timestamp;
                                        break;
                                    }
                                }
                            }
                        }
                    }
                }
                if (!actualReturnCompletedDate) {
                    actualReturnCompletedDate = o.createdAt;
                }
            }
            const returnCompletedDate = actualReturnCompletedDate ? getSLDateString(new Date(actualReturnCompletedDate)) : null;


            const createIsInRange = createDate && createDate >= (startDate || "2000-01-01") && createDate <= (endDate || "2099-12-31");
            const shipIsInRange = shipDate && shipDate >= (startDate || "2000-01-01") && shipDate <= (endDate || "2099-12-31");
            const confirmIsInRange = confirmDate && confirmDate >= (startDate || "2000-01-01") && confirmDate <= (endDate || "2099-12-31");
            const deliverIsInRange = deliverDate && deliverDate >= (startDate || "2000-01-01") && deliverDate <= (endDate || "2099-12-31");
            const returnedIsInRange = returnedDate && returnedDate >= (startDate || "2000-01-01") && returnedDate <= (endDate || "2099-12-31");
            const returnCompletedIsInRange = returnCompletedDate && returnCompletedDate >= (startDate || "2000-01-01") && returnCompletedDate <= (endDate || "2099-12-31");

            // Today Snapshots
            if (createDate === today) todayOrders++;
            if (shipDate === today) todayShippedCount++;
            
            if (o.status === 'DELIVERED') {
                if (deliverDate === today) {
                    todayDeliveredCount++;
                    todayRevenue += o.totalAmount || 0;
                }
            }
            if (isCurrentlyReturned && returnedDate === today) {
                todayReturnsCount++;
            }

            // Weekly Snapshots (Last 7 Days)
            if (o.status === 'DELIVERED') {
                if (deliverDate && deliverDate >= sevenDaysAgoStr && deliverDate <= today) {
                    weeklyDeliveredCount++;
                }
            }
            if (isCurrentlyReturned && returnedDate && returnedDate >= sevenDaysAgoStr && returnedDate <= today) {
                weeklyReturnsCount++;
            }

            // Sales / Leads based on create date
            if (createIsInRange) {
                (o.items || []).forEach(item => {
                    if (!productStats[item.productId]) {
                        productStats[item.productId] = {
                            sku: 'Unknown', name: item.productName || 'Unknown Product', salesCount: 0, confirmed: 0, 
                            shipped: 0, delivered: 0, returned: 0, upcomingReturn: 0, revenue: 0, profit: 0, buyingPrice: 0 
                        };
                    }
                    {
                        productStats[item.productId].salesCount += (Number(item.quantity) || 1);
                        productStats[item.productId].revenue += (((Number(item.quantity)||1) * (Number(item.price) || 0)) || 0);
                    }
                });
            }

            // Confirmed
            const isConfirmedState = o.status === 'CONFIRMED';
            if (isConfirmedState && (confirmIsInRange || (!o.confirmedAt && createIsInRange))) {
                confirmedCount++;
                confirmedValue += o.totalAmount || 0;
                (o.items || []).forEach(item => {
                    if (!productStats[item.productId]) {
                        productStats[item.productId] = {
                            sku: 'Unknown', name: item.productName || 'Unknown Product', salesCount: 0, confirmed: 0, 
                            shipped: 0, delivered: 0, returned: 0, upcomingReturn: 0, revenue: 0, profit: 0, buyingPrice: 0 
                        };
                    }
                    productStats[item.productId].confirmed += (Number(item.quantity) || 1);
                });
            }

            // Delivered
            const isDeliveredState = o.status === 'DELIVERED';
            if (isDeliveredState && deliverIsInRange) {
                deliveredCount++;
                deliveredValue += o.totalAmount || 0;
                const dDate = deliverDate;
                if (dDate && dailyMap[dDate]) dailyMap[dDate].sales += o.totalAmount || 0;
                
                (o.items || []).forEach(item => {
                    if (!productStats[item.productId]) {
                        productStats[item.productId] = {
                            sku: 'Unknown', name: item.productName || 'Unknown Product', salesCount: 0, confirmed: 0, 
                            shipped: 0, delivered: 0, returned: 0, upcomingReturn: 0, revenue: 0, profit: 0, buyingPrice: 0 
                        };
                    }
                    productStats[item.productId].delivered += (Number(item.quantity) || 1);
                });
            }

            // Shipped
            if (wasShipped && shipIsInRange) {
                shippedCount++;
                shippedValue += o.totalAmount || 0;
                if (shipDate && dailyMap[shipDate]) dailyMap[shipDate].shipped += o.totalAmount || 0;
                (o.items || []).forEach(item => {
                    if (!productStats[item.productId]) {
                        productStats[item.productId] = {
                            sku: 'Unknown', name: item.productName || 'Unknown Product', salesCount: 0, confirmed: 0, 
                            shipped: 0, delivered: 0, returned: 0, upcomingReturn: 0, revenue: 0, profit: 0, buyingPrice: 0 
                        };
                    }
                    productStats[item.productId].shipped += (Number(item.quantity) || 1);
                });
            }

            // Returned (overall) - if it is currently in a returned state and was returned in range
            const activeReturnStatuses = ['RETURNED', 'RETURN_TRANSFER', 'RETURN_AS_ON_SYSTEM', 'RETURN_HANDOVER'];
            const isCurrentlyActiveReturned = activeReturnStatuses.includes(o.status);
            if (isCurrentlyActiveReturned && returnedIsInRange) {
                returnedCount++;
                returnedValue += o.totalAmount || 0;
            }

            // Return Completed (Restock)
            const isReturnCompletedState = o.status === 'RETURN_COMPLETED';
            if (isReturnCompletedState && returnCompletedIsInRange) {
                restockCount++;
                restockValue += o.totalAmount || 0;
                (o.items || []).forEach(item => {
                    if (!productStats[item.productId]) {
                        productStats[item.productId] = {
                            sku: 'Unknown', name: item.productName || 'Unknown Product', salesCount: 0, confirmed: 0, 
                            shipped: 0, delivered: 0, returned: 0, upcomingReturn: 0, revenue: 0, profit: 0, buyingPrice: 0 
                        };
                    }
                    productStats[item.productId].returned += (Number(item.quantity) || 1);
                });
            }
            
            // Upcoming Returns
            if (['RETURNED', 'RETURN_TRANSFER', 'RETURN_AS_ON_SYSTEM', 'RETURN_HANDOVER'].includes(o.status) && returnedIsInRange) {
                 (o.items || []).forEach(item => {
                    if (!productStats[item.productId]) {
                        productStats[item.productId] = {
                            sku: 'Unknown', name: item.productName || 'Unknown Product', salesCount: 0, confirmed: 0, 
                            shipped: 0, delivered: 0, returned: 0, upcomingReturn: 0, revenue: 0, profit: 0, buyingPrice: 0 
                        };
                    }
                    productStats[item.productId].upcomingReturn += (Number(item.quantity) || 1);
                });
            }

            // Team Stats from Logs
            const userMetricsThisOrder = {};
            if (o.logs && Array.isArray(o.logs)) {
                o.logs.forEach(log => {
                    const uname = log.user;
                    
const un = (uname || '').trim().toLowerCase();
if (!un || ['system', 'dev_admin', 'courier system', 'oms connector', 'oms scanner'].includes(un)) return;

                    
                    const logDate = log.timestamp ? new Date(log.timestamp) : new Date(o.createdAt || new Date());
                    const logSLDate = getSLDateString(logDate);
                    const logIsInRange = logSLDate >= (startDate || logSLDate) && logSLDate <= (endDate || logSLDate);
                    
                    if (logIsInRange) {
                        if (!teamStats[uname]) {
                            teamStats[uname] = { 
                                name: uname, interactions: 0, confirms: 0, rejects: 0, 
                                noAnswers: 0, openLeads: 0, rescheduledDelivered: 0, rescheduledReturned: 0 
                            };
                        }
                        
                        if (!userMetricsThisOrder[uname]) {
                            userMetricsThisOrder[uname] = new Set();
                            teamStats[uname].interactions++;
                        }
                        
                        const metrics = userMetricsThisOrder[uname];
                        const msg = log.message || '';
                        
                        if (msg.includes('CONFIRMED') && !metrics.has('confirms')) { teamStats[uname].confirms++; metrics.add('confirms'); }
                        if (msg.includes('REJECTED') && !metrics.has('rejects')) { teamStats[uname].rejects++; metrics.add('rejects'); }
                        if (msg.includes('NO_ANSWER') && !metrics.has('noAnswers')) { teamStats[uname].noAnswers++; metrics.add('noAnswers'); }
                        if ((msg.includes('OPEN_LEAD') || msg.includes('Manual Creation') || msg.includes('System Ingestion')) && !metrics.has('openLeads')) { teamStats[uname].openLeads++; metrics.add('openLeads'); }
                        if (msg.includes('DELIVERED') && !metrics.has('delivered')) { teamStats[uname].rescheduledDelivered++; metrics.add('delivered'); }
                        if (msg.includes('RETURN_COMPLETED') && !metrics.has('returned')) { teamStats[uname].rescheduledReturned++; metrics.add('returned'); }
                    }
                });
            }
        });


        const activeUsers = new Set(users.map(u => u.username));
        Object.keys(teamStats).forEach(uname => {
            if (!activeUsers.has(uname) || teamStats[uname].interactions === 0) {
                delete teamStats[uname];
            }
        });

        const stats = {
            deliveredCount, deliveredValue, returnedCount, returnedValue,
            confirmedCount, confirmedValue, shippedCount, shippedValue,
            restockCount, restockValue
        };
        
        const statsResponse = { 
            stats, 
            inventory: { totalCount: inventoryTotalCount, costValue: inventoryCostValue, retailValue: inventoryRetailValue }, 
            dailyMap, 
            productStats, 
            teamStats, 
            todayRevenue, todayDeliveredCount, todayShippedCount, todayReturnsCount, todayOrders,
            weeklyDeliveredCount, weeklyReturnsCount
        };
        
        setCache(tenantId, 'dashboard-stats', cacheKey, statsResponse);
        res.json(statsResponse);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/orders/counts', async (req, res) => {
    try {
        const { tenantId, productId, startDate, endDate, dateField = 'createdAt' } = req.query;
        if (!tenantId) return res.status(400).json({ error: 'Context Required' });
        
        const cacheKey = `${productId || 'ALL'}_${startDate || 'default'}_${endDate || 'default'}_${dateField}`;
        const cachedData = getCache(tenantId, 'counts', cacheKey);
        if (cachedData) {
            return res.json(cachedData);
        }
        
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

        setCache(tenantId, 'counts', cacheKey, counts);
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
            const dateMatch = {};
            if (startDate) dateMatch.$gte = startDate;
            if (endDate) dateMatch.$lte = endDate + 'T23:59:59';
            
            // To ensure we get all relevant orders for the dashboard, match any of the activity dates
            if (query.$or) {
                // If there's already an $or (like search), we need to use $and
                const existingOr = query.$or;
                delete query.$or;
                query.$and = [
                    { $or: existingOr },
                    { $or: [ { createdAt: dateMatch }, { shippedAt: dateMatch }, { deliveredAt: dateMatch }, { confirmedAt: dateMatch } ] }
                ];
            } else {
                query.$or = [
                    { createdAt: dateMatch },
                    { shippedAt: dateMatch },
                    { deliveredAt: dateMatch },
                    { confirmedAt: dateMatch }
                ];
            }
        }

        if (search) {
            const searchOr = [
                { id: { $regex: search, $options: 'i' } },
                { customerName: { $regex: search, $options: 'i' } },
                { customerPhone: { $regex: search, $options: 'i' } },
                { trackingNumber: { $regex: search, $options: 'i' } }
            ];
            
            if (query.$or) {
                const existingOr = query.$or;
                delete query.$or;
                if (query.$and) {
                    query.$and.push({ $or: searchOr });
                } else {
                    query.$and = [
                        { $or: existingOr },
                        { $or: searchOr }
                    ];
                }
            } else if (query.$and) {
                query.$and.push({ $or: searchOr });
            } else {
                query.$or = searchOr;
            }
        }

        const p = parseInt(page) || 1;
        const l = parseInt(limit) || 50;
        const total = await col.countDocuments(query);
        const data = await col.find(query).sort({ createdAt: -1 }).skip((p - 1) * l).limit(l).toArray();

        res.json({ data: data.map(clean), total, page: p, limit: l });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/orders/bulk-search', async (req, res) => {
    try {
        const { waybills } = req.body;
        if (!waybills || !Array.isArray(waybills)) {
            return res.status(400).json({ error: 'Missing or invalid waybills array in body' });
        }

        const waybillsSet = new Set(waybills.map(w => String(w || '').trim()).filter(Boolean));
        const waybillsArr = Array.from(waybillsSet);
        const resultsMap = {};

        // Initialize map with not-found placeholders
        waybillsArr.forEach(wb => {
            resultsMap[wb.toUpperCase()] = { waybill: wb, found: false };
        });

        if (waybillsArr.length > 0) {
            const masterDb = await connectCentral();
            const tenants = await masterDb.collection('tenants').find({}).toArray();

            for (const tenant of tenants) {
                try {
                    const tDb = await getTenantDb(tenant.id);
                    const orders = await tDb.collection('orders').find({
                        $or: [
                            { trackingNumber: { $in: waybillsArr } },
                            { trackingNumber: { $in: waybillsArr.map(w => w.toLowerCase()) } },
                            { trackingNumber: { $in: waybillsArr.map(w => w.toUpperCase()) } },
                            { id: { $in: waybillsArr } }
                        ]
                    }).toArray();

                    orders.forEach(order => {
                        const trNo = String(order.trackingNumber || '').trim().toUpperCase();
                        const ordId = String(order.id || '').trim().toUpperCase();

                        const matchedKey = waybillsArr.find(w => {
                            const upperW = w.toUpperCase();
                            return upperW === trNo || upperW === ordId;
                        });

                        if (matchedKey) {
                            resultsMap[matchedKey.toUpperCase()] = {
                                waybill: matchedKey,
                                found: true,
                                orderId: order.id,
                                status: order.status,
                                customerName: order.customerName,
                                customerPhone: order.customerPhone,
                                shopId: tenant.id,
                                shopName: tenant.settings?.shopName || tenant.domain || tenant.id,
                                createdAt: order.createdAt,
                                shippedAt: order.shippedAt,
                                deliveredAt: order.deliveredAt,
                                returnedAt: order.returnedAt,
                                returnCompletedAt: order.returnCompletedAt
                            };
                        }
                    });
                } catch (tenantErr) {
                    console.error(`Error searching waybills for tenant ${tenant.id}:`, tenantErr);
                }
            }
        }

        res.json({
            success: true,
            results: Object.values(resultsMap)
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

async function isCustomerBlocked(phone1, phone2) {
    const phones = [phone1, phone2].map(p => String(p || '').trim()).filter(p => p.length > 0);
    if (phones.length === 0) return false;

    try {
        const masterDb = await connectCentral();
        const tenants = await masterDb.collection('tenants').find({}).toArray();
        
        let negativeRecordCount = 0;
        
        await Promise.all(tenants.map(async (t) => {
            try {
                const tDb = await getTenantDb(t.id);
                const count = await tDb.collection('orders').countDocuments({
                    $or: [
                        { customerPhone: { $in: phones } },
                        { customerPhone2: { $in: phones } }
                    ],
                    status: { $in: ['REJECTED', 'NO_ANSWER_REJECT', 'NO_ANSWER'] }
                });
                negativeRecordCount += count;
            } catch (err) {
                console.error(`Error checking block status for tenant ${t.id}:`, err);
            }
        }));
        
        return negativeRecordCount >= 2;
    } catch (err) {
        console.error("Error in isCustomerBlocked master lookup:", err);
        return false;
    }
}

app.post('/api/orders', async (req, res) => {
    try {
        const tenantId = req.query.tenantId || req.body.tenantId;
        const { order, orders } = req.body;
        const db = await getTenantDb(tenantId);
        const col = db.collection('orders');

        if (orders) {
            // Check which ones are new
            const orderIds = orders.map(o => o.id).filter(Boolean);
            const existingOrders = await col.find({ id: { $in: orderIds } }).toArray();
            const existingIds = new Set(existingOrders.map(o => o.id));

            // For new ones, check if customer is blocked
            const finalOrders = [];
            let blockedCount = 0;

            for (const o of orders) {
                const isNew = !existingIds.has(o.id);
                const isLeadStatus = o.status === 'PENDING' || o.status === 'OPEN_LEAD';
                const isDevAdmin = o.logs && o.logs[0] && o.logs[0].user === 'DEV_ADMIN';
                
                if (isNew && isLeadStatus && !isDevAdmin) {
                    const blocked = await isCustomerBlocked(o.customerPhone, o.customerPhone2);
                    if (blocked) {
                        blockedCount++;
                        continue; // Skip this blocked lead
                    }
                }
                finalOrders.push(o);
            }

            if (finalOrders.length > 0) {
                const ops = finalOrders.map(o => ({ 
                    updateOne: { 
                        filter: { id: o.id }, 
                        update: { $set: { ...clean(o), tenantId } }, 
                        upsert: true 
                    } 
                }));
                await col.bulkWrite(ops);
            }

            clearTenantCache(tenantId);
            res.json({ success: true, blockedCount });
        } else if (order) {
            const existing = await col.findOne({ id: order.id });
            const isNew = !existing;
            const isLeadStatus = order.status === 'PENDING' || order.status === 'OPEN_LEAD';
            const isDevAdmin = order.logs && order.logs[0] && order.logs[0].user === 'DEV_ADMIN';
            
            if (isNew && isLeadStatus && !isDevAdmin) {
                const blocked = await isCustomerBlocked(order.customerPhone, order.customerPhone2);
                if (blocked) {
                    return res.status(400).json({ error: 'Lead Blocked: Customer has 2 or more rejected/no-answer records in history.' });
                }
            }

            await col.updateOne({ id: order.id }, { $set: { ...clean(order), tenantId } }, { upsert: true });
            clearTenantCache(tenantId);
            res.json({ success: true });
        } else {
            res.status(400).json({ error: 'Missing Order Content' });
        }
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
            clearTenantCache(tenantId);
            return res.json({ success: true, count: result.deletedCount });
        }
        if (id) {
            const ids = id.split(',');
            const result = await col.deleteMany({ id: { $in: ids }, tenantId });
            clearTenantCache(tenantId);
            return res.json({ success: true, count: result.deletedCount });
        }
        res.status(400).json({ error: 'Missing Target' });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/customer-history-batch', async (req, res) => {
    try {
        const { tenantId, phones } = req.body;
        if (!phones || !Array.isArray(phones) || phones.length === 0) return res.json({});
        
        const masterDb = await connectCentral();
        const tenants = await masterDb.collection('tenants').find({}).toArray();
        
        let allHistory = [];
        await Promise.all(tenants.map(async (t) => {
            try {
                const tDb = await getTenantDb(t.id);
                // Create robust query for the batch of phones
                const queryConditions = [];
                phones.forEach(p => {
                    const cleanP = String(p).replace(/\D/g, '');
                    const last9 = cleanP.slice(-9);
                    if (last9.length >= 9) {
                        const pattern = last9.split('').join('\\D*');
                        const regex = new RegExp(pattern + '$');
                        queryConditions.push({ customerPhone: regex });
                        queryConditions.push({ customerPhone2: regex });
                    } else {
                        queryConditions.push({ customerPhone: p });
                        queryConditions.push({ customerPhone2: p });
                    }
                });
                
                const orders = await tDb.collection('orders').find({ $or: queryConditions }).toArray();
                const shopName = t.settings?.shopName || t.id;
                orders.forEach(o => {
                    o.shopName = shopName;
                });
                allHistory.push(...orders);
            } catch (err) {
                console.error(`Error fetching customer history batch for tenant ${t.id}:`, err);
            }
        }));
        
        // Group by phone
        const historyMap = {};
        for (const order of allHistory) {
            const cleanOrderPhone = String(order.customerPhone || '').replace(/\D/g, '');
            const cleanOrderPhone2 = String(order.customerPhone2 || '').replace(/\D/g, '');
            
            const matchedPhone = phones.find(p => {
                const cleanP = String(p).replace(/\D/g, '');
                const last9 = cleanP.slice(-9);
                if (last9.length >= 9) {
                    return cleanOrderPhone.endsWith(last9) || cleanOrderPhone2.endsWith(last9);
                }
                return p === order.customerPhone || p === order.customerPhone2;
            });
            
            const p = matchedPhone || order.customerPhone;
            if (!historyMap[p]) {
                historyMap[p] = {
                    status: 'NEW',
                    count: 0,
                    returns: 0
                };
            }
            historyMap[p].count += 1;
            const isReturn = ['RETURNED', 'RETURN_TRANSFER', 'RETURN_HANDOVER', 'RETURN_COMPLETED', 'RETURN_AS_ON_SYSTEM', 'REJECTED'].includes(order.status);
            if (isReturn) historyMap[p].returns += 1;
            if (historyMap[p].returns > 0) historyMap[p].status = 'WARNING';
            else if (historyMap[p].count > 1) historyMap[p].status = 'REPEAT';
        }
        
        res.json(historyMap);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/customer-history', async (req, res) => {
    try {
        const { tenantId, phone } = req.query;
        if (!phone) return res.json({ status: 'NEW', count: 0, returns: 0, orders: [] });
        
        const masterDb = await connectCentral();
        const tenants = await masterDb.collection('tenants').find({}).toArray();
        
        let allHistory = [];
        const cleanPhone = String(phone).replace(/\D/g, '');
        const last9 = cleanPhone.slice(-9);
        let phoneQuery = {};
        if (last9.length >= 9) {
            const pattern = last9.split('').join('\\D*');
            const regex = new RegExp(pattern + '$');
            phoneQuery = {
                $or: [
                    { customerPhone: regex },
                    { customerPhone2: regex }
                ]
            };
        } else {
            phoneQuery = {
                $or: [
                    { customerPhone: phone },
                    { customerPhone2: phone }
                ]
            };
        }

        await Promise.all(tenants.map(async (t) => {
            try {
                const tDb = await getTenantDb(t.id);
                const orders = await tDb.collection('orders').find(phoneQuery).toArray();
                const shopName = t.settings?.shopName || t.id;
                orders.forEach(o => {
                    o.shopName = shopName;
                });
                allHistory.push(...orders);
            } catch (err) {
                console.error(`Error fetching customer history for tenant ${t.id}:`, err);
            }
        }));

        // Sort by createdAt desc
        allHistory.sort((a, b) => {
            const da = a.createdAt ? new Date(a.createdAt).getTime() : 0;
            const db = b.createdAt ? new Date(b.createdAt).getTime() : 0;
            return db - da;
        });
        
        const count = allHistory.length;
        const returns = allHistory.filter(o => ['RETURNED', 'RETURN_TRANSFER', 'RETURN_HANDOVER', 'RETURN_COMPLETED', 'RETURN_AS_ON_SYSTEM', 'REJECTED'].includes(o.status)).length;
        let status = 'NEW';
        if (returns > 0) status = 'WARNING';
        else if (count > 0) status = 'REPEAT';

        res.json({
            status,
            count,
            returns,
            orders: allHistory.map(clean)
        });
    } catch (e) { res.status(500).json({ error: e.message }); }
});


app.get('/api/products', async (req, res) => {
    try {
        const tenantId = req.query.tenantId || req.body.tenantId;
        if (!tenantId) return res.status(400).json({ error: 'Context Required' });
        const db = await getTenantDb(tenantId);
        const products = await db.collection('products').find({ tenantId }).toArray();
        res.json(products.map(clean));
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/products', async (req, res) => {
    try {
        const tenantId = req.query.tenantId || req.body.tenantId;
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
        const db = await connectCentral();
        const { id } = req.query;
        if (id) {
            const tenant = await db.collection('tenants').findOne({ id });
            return res.json(tenant ? [clean(tenant)] : []);
        }
        const tenants = await db.collection('tenants').find({}).toArray();
        res.json(tenants.map(clean));
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/tenants', async (req, res) => {
    try {
        const { tenant, adminUser } = req.body;
        const db = await connectCentral();
        await db.collection('tenants').updateOne({ id: tenant.id }, { $set: clean(tenant) }, { upsert: true });
        if (adminUser) {
            const userId = adminUser.id || `u-admin-${tenant.id}`;
            const userTenantId = adminUser.tenantId || tenant.id;
            const userRole = adminUser.role || 'SUPER_ADMIN';
            const userEmail = adminUser.email || adminUser.username;

            const existingUser = await db.collection('users').findOne({ id: userId });

            const fullAdminUser = {
                id: userId,
                username: adminUser.username || (existingUser ? existingUser.username : undefined),
                password: adminUser.password || (existingUser ? existingUser.password : undefined),
                email: userEmail || (existingUser ? existingUser.email : undefined),
                role: userRole,
                tenantId: userTenantId,
                permissions: adminUser.permissions || (existingUser ? existingUser.permissions : ['ALL_PERMISSIONS'])
            };

            await db.collection('users').updateOne({ id: userId }, { $set: clean(fullAdminUser) }, { upsert: true });
        }
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/tenants', async (req, res) => {
    try {
        const { id, settings } = req.body;
        const db = await connectCentral();
        await db.collection('tenants').updateOne({ id }, { $set: { settings } });
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/tenants', async (req, res) => {
    try {
        const { id } = req.query;
        const db = await connectCentral();
        await db.collection('tenants').deleteOne({ id });
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/ship-order', async (req, res) => {
    try {
        const tenantId = req.query.tenantId || req.body.tenantId;
        const { order, user } = req.body;
        if (!tenantId) return res.status(400).json({ error: 'Context Required' });

        const db = await getTenantDb(tenantId);
        const existing = await db.collection('orders').findOne({ id: order.id, tenantId });
        let updatedOrder = { ...order };

        const centralDb = await connectCentral();
        const tenant = await centralDb.collection('tenants').findOne({ id: tenantId });
        let trackingResponse = null;

        if (!tenant || !tenant.settings || !tenant.settings.courierApiKey || !tenant.settings.courierApiKey.trim()) {
            return res.status(400).json({ error: "Cannot ship order: Courier Auth Key (API Code) is missing in Settings. Please configure your Courier API Key in settings first." });
        }

        if (tenant && tenant.settings && tenant.settings.courierApiKey) {
            try {
                const fdeOrderId = order.id.replace(/\D/g, '').slice(-10) || Math.floor(Math.random() * 1000000000).toString();
                const productNames = order.items && order.items.length > 0 ? order.items.map((i) => i.name).join(' + ') : 'Standard Shipment';
                const hasCustomDescription = order.parcelDescription && order.parcelDescription !== 'Online Order';
                const finalDescription = hasCustomDescription ? order.parcelDescription : productNames;

                const formData = new URLSearchParams();
                formData.append('api_key', tenant.settings.courierApiKey.trim());
                formData.append('client_id', (tenant.settings.courierClientId || '').trim());
                formData.append('order_id', fdeOrderId);
                formData.append('parcel_weight', order.parcelWeight || '1');
                formData.append('parcel_description', finalDescription.slice(0, 50));
                formData.append('recipient_name', order.customerName);
                formData.append('recipient_contact_1', order.customerPhone.replace(/\D/g, ''));
                
                const phone2 = (order.customerPhone2 || '').replace(/\D/g, '');
                if (phone2) formData.append('recipient_contact_2', phone2);
                
                formData.append('recipient_address', order.customerAddress);
                formData.append('recipient_city', order.customerCity || '');
                formData.append('amount', Math.round(order.totalAmount).toString());
                formData.append('exchange', '0');

                const targetUrl = tenant.settings.courierMode === 'EXISTING_WAYBILL' 
                    ? 'https://www.fdedomestic.com/api/parcel/existing_waybill_api_v1.php'
                    : 'https://www.fdedomestic.com/api/parcel/new_api_v1.php';
                    
                if (tenant.settings.courierMode === 'EXISTING_WAYBILL') {
                    formData.append('waybill_id', (order.trackingNumber || '').toString());
                }

                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 15000);
                const response = await fetch(targetUrl, { 
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/x-www-form-urlencoded',
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                        'Accept': '*/*'
                    },
                    body: formData,
                    signal: controller.signal
                });
                clearTimeout(timeoutId);
                
                const rawText = await response.text();
                let data = {};
                try {
                    data = JSON.parse(rawText);
                } catch(e) {
                    throw new Error(`FDE Format Error: ${rawText.slice(0, 100)}`);
                }
                
                // If FDE returns a waybill_no or status 200, it is success!
                const status = Number(data.status);
                const hasWaybill = data.waybill_no && data.waybill_no.trim().length > 0;
                const isSuccess = status === 200 || hasWaybill;

                if (isSuccess) {
                    if (tenant.settings.courierMode !== 'EXISTING_WAYBILL' && !hasWaybill) {
                        throw new Error(`Courier Agent API did not return a valid Waybill Number (API Code). Response: ${rawText}`);
                    }
                    updatedOrder.trackingNumber = data.waybill_no || order.trackingNumber;
                    trackingResponse = `Waybill ${updatedOrder.trackingNumber || 'Assigned'}. (Raw: ${rawText})`;
                } else {
                    const errorMsg = data.message || FDE_ERRORS[status] || `FDE Error ${status}: ${rawText}`;
                    throw new Error(errorMsg);
                }
            } catch (err) { 
                console.error("Courier API error:", err);
                return res.status(400).json({ error: err.message });
            }
        }

        if (existing) {
            updatedOrder = { ...existing, ...updatedOrder, status: 'SHIPPED', shippedAt: new Date().toISOString() };
            if (!updatedOrder.logs) updatedOrder.logs = [];
            updatedOrder.logs.push({ id: `l-${Date.now()}`, message: `Status Protocol: Order transitioned to SHIPPED. ${trackingResponse || ''}`, timestamp: new Date().toISOString(), user: user || 'OMS Connector' });
        } else {
            updatedOrder.status = 'SHIPPED';
            updatedOrder.shippedAt = new Date().toISOString();
        }
        await db.collection('orders').updateOne({ id: order.id }, { $set: { ...clean(updatedOrder), tenantId } }, { upsert: true });
        clearTenantCache(tenantId);
        res.json({ success: true, updatedOrder });
    } catch (e) { res.status(500).json({ error: e.message }); }
});
app.get('/api/customer-history-detailed', async (req, res) => {
    try {
        const { tenantId, phone } = req.query;
        if (!phone) return res.json([]);
        
        const masterDb = await connectCentral();
        const tenants = await masterDb.collection('tenants').find({}).toArray();
        
        let allHistory = [];
        const cleanPhone = String(phone).replace(/\D/g, '');
        const last9 = cleanPhone.slice(-9);
        let phoneQuery = {};
        if (last9.length >= 9) {
            const pattern = last9.split('').join('\\D*');
            const regex = new RegExp(pattern + '$');
            phoneQuery = {
                $or: [
                    { customerPhone: regex },
                    { customerPhone2: regex }
                ]
            };
        } else {
            phoneQuery = {
                $or: [
                    { customerPhone: phone },
                    { customerPhone2: phone }
                ]
            };
        }

        await Promise.all(tenants.map(async (t) => {
            try {
                const tDb = await getTenantDb(t.id);
                const orders = await tDb.collection('orders').find(phoneQuery).toArray();
                const shopName = t.settings?.shopName || t.id;
                orders.forEach(o => {
                    o.shopName = shopName;
                });
                allHistory.push(...orders);
            } catch (err) {
                console.error(`Error fetching customer history for tenant ${t.id}:`, err);
            }
        }));

        // Sort by createdAt desc
        allHistory.sort((a, b) => {
            const da = a.createdAt ? new Date(a.createdAt).getTime() : 0;
            const db = b.createdAt ? new Date(b.createdAt).getTime() : 0;
            return db - da;
        });

        res.json(allHistory.map(clean));
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/process-return', async (req, res) => {
    try {
        const tenantId = req.query.tenantId || req.body.tenantId;
        const { trackingOrId, user } = req.body;
        if (!tenantId) return res.status(400).json({ error: 'Context Required' });
        const db = await getTenantDb(tenantId);
        const order = await db.collection('orders').findOne({ tenantId, $or: [{ id: trackingOrId }, { trackingNumber: trackingOrId }] });
        if (!order) return res.status(404).json({ error: 'Not Found' });
        order.status = 'RETURN_COMPLETED';
        order.returnCompletedAt = new Date().toISOString();
        if (!order.returnedAt) {
            order.returnedAt = order.returnCompletedAt;
        }
        if (!order.logs) order.logs = [];
        order.logs.push({ id: `l-${Date.now()}`, message: `Status Protocol: Order transitioned to RETURN_COMPLETED`, timestamp: order.returnCompletedAt, user: user || 'System' });
        await db.collection('orders').updateOne({ id: order.id }, { $set: { ...clean(order), tenantId } });
        clearTenantCache(tenantId);
        res.json(clean(order));
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/courier-webhook', async (req, res) => {
    try {
        console.log(">>> RECEIVED COURIER WEBHOOK:", req.body);
        let payload = {};
        if (typeof req.body === 'object' && req.body !== null) {
            payload = req.body;
        } else if (typeof req.body === 'string') {
            try {
                payload = JSON.parse(req.body);
            } catch (e) {
                payload = parseMultipartData(req.body);
            }
        }

        if (typeof req.body === 'string' && !req.body.trim().startsWith('{') && req.body.includes('=')) {
            try {
                const params = new URLSearchParams(req.body);
                for (const [k, v] of params.entries()) {
                    payload[k] = v;
                }
            } catch (e) {}
        }

        const getField = (obj, keys) => {
            for (const key of keys) {
                const val = obj[key];
                if (val !== undefined && val !== null) return String(val).trim();
            }
            for (const k of Object.keys(obj)) {
                if (keys.map(x => x.toLowerCase()).includes(k.toLowerCase())) {
                    return String(obj[k]).trim();
                }
            }
            return null;
        };

        const waybillId = getField(payload, ['waybill_id', 'waybill_no', 'waybill', 'tracking_number', 'tracking_no', 'trackingNumber', 'barcode']);
        const orderId = getField(payload, ['order_id', 'id', 'orderId']);
        const rawStatus = getField(payload, ['status', 'status_name', 'status_code', 'state', 'status_desc', 'event', 'courier_status', 'current_status', 'currentStatus']);

        if (!waybillId && !orderId) {
            return res.status(400).json({ error: 'Missing identifying fields (waybill_id or order_id)' });
        }
        if (!rawStatus) {
            return res.status(400).json({ error: 'Missing status field' });
        }

        const mappedStatus = mapStatus(rawStatus);

        const centralDb = await connectCentral();
        const tenants = await centralDb.collection('tenants').find({}).toArray();
        let foundOrder = null;
        let foundTenantId = null;
        let tDb = null;

        for (const tenant of tenants) {
            const db = await getTenantDb(tenant.id);
            let order = null;
            if (waybillId) {
                order = await db.collection('orders').findOne({ trackingNumber: waybillId });
            }
            if (!order && orderId) {
                order = await db.collection('orders').findOne({ id: orderId });
                if (!order) {
                    const numericId = orderId.replace(/\D/g, '');
                    if (numericId) {
                        order = await db.collection('orders').findOne({ id: { $regex: new RegExp(numericId + "$") } });
                    }
                }
            }
            if (order) {
                foundOrder = order;
                foundTenantId = tenant.id;
                tDb = db;
                break;
            }
        }

        if (!foundOrder) {
            console.warn(`>>> Webhook Warning: No matching order found for waybill ${waybillId || 'N/A'} or orderId ${orderId || 'N/A'}`);
            return res.status(404).json({ error: 'Order not found' });
        }

        const timestamp = new Date().toISOString();
        const previousStatus = foundOrder.status;
        foundOrder.status = mappedStatus;

        if (mappedStatus === 'DELIVERED') {
            if (!foundOrder.deliveredAt) foundOrder.deliveredAt = timestamp;
        } else if (['RETURNED', 'RETURN_TRANSFER', 'RETURN_AS_ON_SYSTEM', 'RETURN_HANDOVER'].includes(mappedStatus)) {
            if (!foundOrder.returnedAt) foundOrder.returnedAt = timestamp;
        } else if (mappedStatus === 'RETURN_COMPLETED') {
            if (!foundOrder.returnCompletedAt) foundOrder.returnCompletedAt = timestamp;
            if (!foundOrder.returnedAt) foundOrder.returnedAt = timestamp;
        } else if (mappedStatus === 'SHIPPED') {
            if (!foundOrder.shippedAt) foundOrder.shippedAt = timestamp;
        }

        if (!foundOrder.logs) foundOrder.logs = [];
        foundOrder.logs.push({
            id: `l-webhook-${Date.now()}`,
            message: `WEBHOOK: Status update to ${rawStatus} [Logistics Sync - Waybill: ${waybillId || foundOrder.trackingNumber || 'N/A'}]`,
            timestamp,
            user: 'Courier Webhook'
        });

        await tDb.collection('orders').updateOne({ id: foundOrder.id }, { $set: { ...clean(foundOrder), tenantId: foundTenantId } });
        clearTenantCache(foundTenantId);

        console.log(`>>> Webhook Success: Order ${foundOrder.id} updated to ${mappedStatus} (Raw: ${rawStatus})`);
        return res.json({
            success: true,
            orderId: foundOrder.id,
            previousStatus,
            newStatus: mappedStatus,
            rawStatus
        });
    } catch (e) {
        console.error(">>> Webhook Error:", e);
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/tenant-last-action', (req, res) => {
    try {
        const { tenantId } = req.query;
        if (!tenantId) return res.status(400).json({ error: 'Context Required' });
        const lastAction = tenantLastAction.get(tenantId.toString()) || 0;
        res.json({ lastAction });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/security-logs', async (req, res) => {
    res.json([]);
});

const isProd = process.env.NODE_ENV === "production" || fs.existsSync(path.join(__dirname, 'dist', 'index.html'));
if (!isProd) {
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
