
import { Handler } from '@netlify/functions';
import { MongoClient, ServerApiVersion } from 'mongodb';

// --- CONFIG ---
const CENTRAL_URI = process.env.MONGODB_URI;
const CENTRAL_DB_NAME = 'milkyway_central'; 

let cachedCentralClient: MongoClient | null = null;
const tenantClients = new Map<string, MongoClient>();

async function getCentralDb() {
  if (cachedCentralClient) return cachedCentralClient.db(CENTRAL_DB_NAME);
  if (!CENTRAL_URI) throw new Error('MONGODB_URI environment variable is missing.');

  const client = new MongoClient(CENTRAL_URI, {
    serverApi: {
      version: ServerApiVersion.v1,
      strict: true,
      deprecationErrors: true,
    },
    connectTimeoutMS: 10000,
    socketTimeoutMS: 45000,
  });

  await client.connect();
  cachedCentralClient = client;
  return client.db(CENTRAL_DB_NAME);
}

async function getTenantDb(tenantId: string) {
    const central = await getCentralDb();
    const tenant = await central.collection('tenants').findOne({ id: tenantId });
    
    if (!tenant) throw new Error(`Tenant ${tenantId} not found`);
    
    const uri = tenant.mongoUri || CENTRAL_URI; 

    if (tenantClients.has(tenantId)) {
        return tenantClients.get(tenantId)!.db(); 
    }

    if (!uri) throw new Error("No database URI configured for this tenant.");

    const client = new MongoClient(uri);
    await client.connect();
    tenantClients.set(tenantId, client);
    return client.db(); 
}

// Helper for mapping Fardar statuses to Milky Way Internal Statuses
const mapStatus = (courierStatus: string): string => {
    const s = courierStatus.toLowerCase();
    if (s.includes('delivered')) return 'DELIVERED';
    if (s.includes('returned')) return 'RETURNED';
    if (s.includes('delivery')) return 'DELIVERY';
    if (s.includes('residual')) return 'RESIDUAL';
    return 'SHIPPED'; 
};

export const handler: Handler = async (event, context) => {
  context.callbackWaitsForEmptyEventLoop = false;
  
  const fullPath = event.path || '';
  const apiPrefix = '/.netlify/functions/api';
  let path = fullPath.startsWith(apiPrefix) ? fullPath.slice(apiPrefix.length) : fullPath;
  if (!path.startsWith('/')) path = '/' + path;
  if (path.endsWith('/') && path.length > 1) path = path.slice(0, -1);
  
  const method = event.httpMethod;

  try {
    const centralDb = await getCentralDb();
    const usersCol = centralDb.collection('users');
    const tenantsCol = centralDb.collection('tenants');

    // --- AUTO-INIT: Create default Dev Admin ---
    const devUser = await usersCol.findOne({ role: 'DEV_ADMIN' });
    if (!devUser) {
        await usersCol.insertOne({ 
            id: 'dev-1', 
            username: '6969dao.eth@ethermail.io', 
            password: 'SADun098', 
            role: 'DEV_ADMIN' 
        });
    }

    // --- COURIER CALLBACK WEBHOOK (Milky Way Receiver) ---
    // Endpoint: POST /.netlify/functions/api/courier-webhook
    if (path === '/courier-webhook' && method === 'POST') {
        // Fardar sends data as form-data
        // Netlify functions parse body. If it's x-www-form-urlencoded:
        const bodyParams = new URLSearchParams(event.body || '');
        const waybill_id = bodyParams.get('waybill_id');
        const delivery_status = bodyParams.get('delivery_status');
        const last_update_time = bodyParams.get('last_update_time');

        if (!waybill_id) return { statusCode: 400, body: 'Missing Waybill' };

        // Search across all tenants to find who owns this waybill
        const allTenants = await tenantsCol.find({ isActive: true }).toArray();
        let found = false;

        for (const tenant of allTenants) {
            const tDb = await getTenantDb(tenant.id);
            const ordersCol = tDb.collection('orders');
            const order = await ordersCol.findOne({ trackingNumber: waybill_id });

            if (order) {
                const newStatus = mapStatus(delivery_status || '');
                const logEntry = {
                    id: `log-cb-${Date.now()}`,
                    message: `EXTERNAL: Status update from Courier [${delivery_status}]. Updated at: ${last_update_time}`,
                    timestamp: new Date().toISOString(),
                    user: 'Fardar Express (API)'
                };

                await ordersCol.updateOne(
                    { id: order.id },
                    { 
                        $set: { 
                            status: newStatus,
                            courierStatus: delivery_status 
                        },
                        $push: { logs: logEntry }
                    }
                );
                found = true;
                break; // Found the order, stop searching other tenants
            }
        }

        return { 
            statusCode: 200, 
            headers: { "Access-Control-Allow-Origin": "*" }, // Match Fardar whitelist requirement
            body: JSON.stringify({ success: found, message: found ? 'Order updated' : 'Waybill not found in any Milky Way cluster' }) 
        };
    }

    // 0. HEALTH CHECK
    if (path === '/health') {
        return { statusCode: 200, body: JSON.stringify({ status: 'connected', timestamp: Date.now() }) };
    }

    // 1. LOGIN
    if (path === '/login' && method === 'POST') {
        const { username, password } = JSON.parse(event.body || '{}');
        const user = await usersCol.findOne({ username, password });
        if (user) return { statusCode: 200, body: JSON.stringify(user) };
        return { statusCode: 401, body: JSON.stringify({ error: 'Invalid credentials' }) };
    }

    // 2. TENANTS
    if (path === '/tenants') {
         if (method === 'GET') {
            const tenants = await tenantsCol.find({}).toArray();
            return { statusCode: 200, body: JSON.stringify(tenants) };
         }
         if (method === 'POST') {
             const { tenant, adminUser } = JSON.parse(event.body || '{}');
             await tenantsCol.insertOne(tenant);
             if (adminUser) await usersCol.insertOne(adminUser);
             return { statusCode: 200, body: 'OK' };
         }
         if (method === 'PUT') {
             const { tenant } = JSON.parse(event.body || '{}');
             await tenantsCol.updateOne({ id: tenant.id }, { $set: tenant });
             return { statusCode: 200, body: 'OK' };
         }
    }

    // --- TENANT DATA ---
    const getContext = async () => {
        const tenantId = event.queryStringParameters?.tenantId || JSON.parse(event.body || '{}').tenantId;
        if (!tenantId) throw new Error('Missing tenantId');
        const db = await getTenantDb(tenantId);
        return { db, orders: db.collection('orders'), products: db.collection('products') };
    };

    if (path === '/orders') {
        const { orders } = await getContext();
        if (method === 'GET') {
            const allOrders = await orders.find({}).toArray();
            return { statusCode: 200, body: JSON.stringify(allOrders) };
        }
        if (method === 'POST') {
            const { order } = JSON.parse(event.body || '{}');
            await orders.updateOne({ id: order.id }, { $set: order }, { upsert: true });
            return { statusCode: 200, body: JSON.stringify({ success: true }) };
        }
    }

    if (path === '/products') {
        const { products } = await getContext();
        if (method === 'GET') {
            const allProducts = await products.find({}).toArray();
            return { statusCode: 200, body: JSON.stringify(allProducts) };
        }
        if (method === 'POST') {
            const { product } = JSON.parse(event.body || '{}');
            await products.updateOne({ id: product.id }, { $set: product }, { upsert: true });
            return { statusCode: 200, body: JSON.stringify({ success: true }) };
        }
    }

    return { statusCode: 404, body: JSON.stringify({ error: 'Not Found', path: path }) };

  } catch (error: any) {
    console.error("API Error", error);
    return { statusCode: 500, body: JSON.stringify({ error: error.message || error.toString() }) };
  }
};
