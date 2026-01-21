import { Handler } from '@netlify/functions';
import { MongoClient, ServerApiVersion } from 'mongodb';

// Constants
const CENTRAL_URI = process.env.MONGODB_URI;
const CENTRAL_DB_NAME = 'milkyway_central';

// Connection Pooling
let cachedClient: MongoClient | null = null;

async function getConnectedClient() {
  if (cachedClient) {
    try {
      // Ping the server to check if connection is still alive
      await cachedClient.db('admin').command({ ping: 1 });
      return cachedClient;
    } catch (e) {
      console.warn("Cached MongoDB client lost connection, reconnecting...");
      cachedClient = null;
    }
  }

  if (!CENTRAL_URI) {
    throw new Error('MONGODB_URI environment variable is missing in Netlify settings.');
  }

  const client = new MongoClient(CENTRAL_URI, {
    serverApi: {
      version: ServerApiVersion.v1,
      strict: true,
      deprecationErrors: true,
    },
    // Prevent long hangs that cause 502s
    connectTimeoutMS: 5000,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 30000,
  });

  await client.connect();
  cachedClient = client;
  return client;
}

export const handler: Handler = async (event, context) => {
  // Prevent context from waiting for the event loop to be empty (important for serverless DB)
  context.callbackWaitsForEmptyEventLoop = false;

  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  };

  // Handle pre-flight OPTIONS request
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  // Path Normalization
  const apiPrefix = '/.netlify/functions/api';
  let path = event.path.replace(apiPrefix, '').replace('/api', '') || '/';
  if (!path.startsWith('/')) path = '/' + path;
  
  const method = event.httpMethod;

  try {
    const mongoClient = await getConnectedClient();
    const centralDb = mongoClient.db(CENTRAL_DB_NAME);
    const usersCol = centralDb.collection('users');
    const tenantsCol = centralDb.collection('tenants');

    // System Bootstrapping: Ensure Dev Admin exists
    const devExists = await usersCol.findOne({ role: 'DEV_ADMIN' });
    if (!devExists) {
      await usersCol.insertOne({
        id: 'dev-root',
        username: 'admin@milkyway.com',
        password: 'admin', // Default password
        role: 'DEV_ADMIN',
        createdAt: new Date().toISOString()
      });
    }

    // Health Check
    if (path === '/health' || path === '/') {
      return { statusCode: 200, headers, body: JSON.stringify({ status: 'connected', timestamp: new Date().toISOString() }) };
    }

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

    // --- Tenant Management (Infrastructure) ---
    if (path === '/tenants') {
      if (method === 'GET') {
        const tenants = await tenantsCol.find({}).toArray();
        return { statusCode: 200, headers, body: JSON.stringify(tenants) };
      }
      if (method === 'POST') {
        const { tenant, adminUser } = JSON.parse(event.body || '{}');
        await tenantsCol.updateOne({ id: tenant.id }, { $set: tenant }, { upsert: true });
        if (adminUser) {
          await usersCol.updateOne({ id: adminUser.id }, { $set: adminUser }, { upsert: true });
        }
        return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
      }
      if (method === 'PUT') {
        const { tenant } = JSON.parse(event.body || '{}');
        await tenantsCol.updateOne({ id: tenant.id }, { $set: tenant });
        return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
      }
    }

    // --- User Management (Team) ---
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
        if (!id) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing id' }) };
        await usersCol.deleteOne({ id });
        return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
      }
    }

    // --- Multi-Tenant Order/Product Logic ---
    const tenantId = event.queryStringParameters?.tenantId || JSON.parse(event.body || '{}').tenantId;
    if (!tenantId && (path.includes('orders') || path.includes('products'))) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing tenantId parameter' }) };
    }

    // We use the central DB for order data but filter by tenantId for simplified structure
    // In a high-scale environment, we would switch to getTenantDb(tenantId)
    const activeDb = centralDb; 

    if (path === '/orders') {
      const ordersCol = activeDb.collection('orders');
      if (method === 'GET') {
        const id = event.queryStringParameters?.id;
        if (id) {
          const order = await ordersCol.findOne({ id, tenantId });
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

    return { statusCode: 404, headers, body: JSON.stringify({ error: 'Endpoint Not Found', path }) };

  } catch (error: any) {
    console.error("Critical API Failure:", error);
    return { 
      statusCode: 500, 
      headers, 
      body: JSON.stringify({ 
        error: 'Milky Way Internal Cluster Error', 
        details: error.message 
      }) 
    };
  }
};