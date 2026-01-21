import { Handler } from '@netlify/functions';
import { MongoClient, ServerApiVersion } from 'mongodb';

// Constants
const CENTRAL_URI = process.env.MONGODB_URI;
const CENTRAL_DB_NAME = 'milkyway_central';

// Connection Pooling
let cachedCentralClient: MongoClient | null = null;
const tenantClients = new Map<string, MongoClient>();

async function getConnectedClient(uri: string = CENTRAL_URI!) {
  // Check cache for this specific URI
  const isCentral = uri === CENTRAL_URI;
  if (isCentral && cachedCentralClient) return cachedCentralClient;
  if (!isCentral && tenantClients.has(uri)) return tenantClients.get(uri)!;

  if (!uri) throw new Error('Target MongoDB URI is missing.');

  const client = new MongoClient(uri, {
    serverApi: {
      version: ServerApiVersion.v1,
      strict: true,
      deprecationErrors: true,
    },
    connectTimeoutMS: 8000,
    serverSelectionTimeoutMS: 8000,
  });

  await client.connect();
  
  if (isCentral) cachedCentralClient = client;
  else tenantClients.set(uri, client);
  
  return client;
}

export const handler: Handler = async (event, context) => {
  context.callbackWaitsForEmptyEventLoop = false;

  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  const apiPrefix = '/.netlify/functions/api';
  let path = event.path.replace(apiPrefix, '').replace('/api', '') || '/';
  if (!path.startsWith('/')) path = '/' + path;
  
  const method = event.httpMethod;

  try {
    const centralClient = await getConnectedClient(CENTRAL_URI!);
    const centralDb = centralClient.db(CENTRAL_DB_NAME);
    const usersCol = centralDb.collection('users');
    const tenantsCol = centralDb.collection('tenants');

    if (path === '/health') return { statusCode: 200, headers, body: JSON.stringify({ status: 'connected' }) };

    // --- Authentication ---
    if (path === '/login' && method === 'POST') {
      const { username, password } = JSON.parse(event.body || '{}');
      const user = await usersCol.findOne({ username, password });
      if (user) {
        const { password: _, ...safeUser } = user;
        return { statusCode: 200, headers, body: JSON.stringify(safeUser) };
      }
      return { statusCode: 401, headers, body: JSON.stringify({ error: 'Invalid credentials' }) };
    }

    // --- Central Infrastructure ---
    if (path === '/tenants') {
      if (method === 'GET') {
        const tenants = await tenantsCol.find({}).toArray();
        return { statusCode: 200, headers, body: JSON.stringify(tenants) };
      }
      if (method === 'POST') {
        const { tenant, adminUser } = JSON.parse(event.body || '{}');
        await tenantsCol.updateOne({ id: tenant.id }, { $set: tenant }, { upsert: true });
        if (adminUser) await usersCol.updateOne({ id: adminUser.id }, { $set: adminUser }, { upsert: true });
        return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
      }
      if (method === 'PUT') {
        const { tenant, adminUser } = JSON.parse(event.body || '{}');
        
        // CRITICAL FIX: Sanitize the tenant object to remove immutable MongoDB _id
        const { _id, ...tenantData } = tenant;
        
        // Update Tenant Metadata
        await tenantsCol.updateOne({ id: tenant.id }, { $set: tenantData });
        
        // Update Primary Super Admin credentials if provided
        if (adminUser) {
          const updateFields: any = {};
          if (adminUser.username) updateFields.username = adminUser.username;
          if (adminUser.password) updateFields.password = adminUser.password;
          
          if (Object.keys(updateFields).length > 0) {
            await usersCol.updateOne(
              { tenantId: tenant.id, role: 'SUPER_ADMIN' },
              { $set: updateFields }
            );
          }
        }
        return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
      }
    }

    if (path === '/users') {
      if (method === 'GET') {
        const users = await usersCol.find({}).toArray();
        return { statusCode: 200, headers, body: JSON.stringify(users.map(({ password: _, ...u }) => u)) };
      }
      if (method === 'POST') {
        const data = JSON.parse(event.body || '{}');
        await usersCol.updateOne({ id: data.id || `u-${Date.now()}` }, { $set: data }, { upsert: true });
        return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
      }
      if (method === 'DELETE') {
        const id = event.queryStringParameters?.id;
        await usersCol.deleteOne({ id });
        return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
      }
    }

    // --- Dynamic Tenant-Specific Storage Routing ---
    const tenantId = event.queryStringParameters?.tenantId || JSON.parse(event.body || '{}').tenantId;
    let activeDb = centralDb;
    
    if (tenantId) {
      const tenantConfig = await tenantsCol.findOne({ id: tenantId });
      if (tenantConfig && tenantConfig.mongoUri) {
        try {
          const tenantClient = await getConnectedClient(tenantConfig.mongoUri);
          let dbName = `mw_cluster_${tenantId}`;
          try {
            dbName = new URL(tenantConfig.mongoUri).pathname.slice(1) || dbName;
          } catch (e) { /* use default if URL is not valid mongo uri format */ }
          activeDb = tenantClient.db(dbName);
        } catch (e) {
          console.error(`Tenant DB Routing Error: ${tenantId}`, e);
        }
      }
    }

    if (path === '/orders') {
      const ordersCol = activeDb.collection('orders');
      if (method === 'GET') {
        const id = event.queryStringParameters?.id;
        if (id) {
          const order = await ordersCol.findOne({ id });
          return { statusCode: 200, headers, body: JSON.stringify(order) };
        }
        const orders = await ordersCol.find({ tenantId }).sort({ createdAt: -1 }).toArray();
        return { statusCode: 200, headers, body: JSON.stringify(orders) };
      }
      if (method === 'POST') {
        const { order } = JSON.parse(event.body || '{}');
        await ordersCol.updateOne({ id: order.id }, { $set: { ...order, tenantId } }, { upsert: true });
        return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
      }
    }

    if (path === '/products') {
      const productsCol = activeDb.collection('products');
      if (method === 'GET') {
        const products = await productsCol.find({ tenantId }).toArray();
        return { statusCode: 200, headers, body: JSON.stringify(products) };
      }
      if (method === 'POST') {
        const { product } = JSON.parse(event.body || '{}');
        await productsCol.updateOne({ id: product.id }, { $set: { ...product, tenantId } }, { upsert: true });
        return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
      }
    }

    return { statusCode: 404, headers, body: JSON.stringify({ error: 'Endpoint Not Found' }) };

  } catch (error: any) {
    console.error("API Critical Failure:", error);
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Internal Cluster Error', details: error.message }) };
  }
};