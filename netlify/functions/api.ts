
import { Handler } from '@netlify/functions';
import { MongoClient, ServerApiVersion } from 'mongodb';

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
    }
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

    const client = new MongoClient(uri!);
    await client.connect();
    tenantClients.set(tenantId, client);
    return client.db(); 
}

export const handler: Handler = async (event, context) => {
  context.callbackWaitsForEmptyEventLoop = false;
  
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers };
  }

  const apiPrefix = '/.netlify/functions/api';
  let path = event.path.startsWith(apiPrefix) ? event.path.slice(apiPrefix.length) : event.path;
  if (!path.startsWith('/')) path = '/' + path;
  
  const method = event.httpMethod;

  try {
    const centralDb = await getCentralDb();
    const usersCol = centralDb.collection('users');
    const tenantsCol = centralDb.collection('tenants');

    // Auto-init Dev Admin
    const devUser = await usersCol.findOne({ role: 'DEV_ADMIN' });
    if (!devUser) {
      await usersCol.insertOne({ 
        id: 'dev-1', 
        username: '6969dao.eth@ethermail.io', 
        password: 'SADun098', 
        role: 'DEV_ADMIN' 
      });
    }

    if (path === '/health') return { statusCode: 200, headers, body: JSON.stringify({ status: 'connected' }) };

    if (path === '/login' && method === 'POST') {
      const { username, password } = JSON.parse(event.body || '{}');
      // Search by username OR email for flexibility
      const user = await usersCol.findOne({ 
          $or: [{ username }, { email: username }], 
          password 
      });
      if (user) return { statusCode: 200, headers, body: JSON.stringify(user) };
      return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorized Access' }) };
    }

    if (path === '/tenants') {
      if (method === 'GET') {
        const tenants = await tenantsCol.find({}).toArray();
        return { statusCode: 200, headers, body: JSON.stringify(tenants) };
      }
      if (method === 'POST') {
        const { tenant, adminUser } = JSON.parse(event.body || '{}');
        // Ensure atomic injection
        await tenantsCol.updateOne({ id: tenant.id }, { $set: tenant }, { upsert: true });
        if (adminUser) {
            await usersCol.updateOne({ username: adminUser.username }, { $set: adminUser }, { upsert: true });
        }
        return { statusCode: 200, headers, body: JSON.stringify({ success: true, message: "Cluster Deployed" }) };
      }
      if (method === 'PUT') {
        const { tenant } = JSON.parse(event.body || '{}');
        await tenantsCol.updateOne({ id: tenant.id }, { $set: tenant });
        return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
      }
    }

    if (path === '/users') {
      if (method === 'GET') {
        const users = await usersCol.find({}).toArray();
        return { statusCode: 200, headers, body: JSON.stringify(users) };
      }
      if (method === 'POST') {
        const { tenantId, username, role, email, password } = JSON.parse(event.body || '{}');
        const newUser = {
          id: `u-${Date.now()}`,
          tenantId,
          username,
          role,
          email,
          password
        };
        await usersCol.insertOne(newUser);
        return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
      }
      if (method === 'DELETE') {
        const id = event.queryStringParameters?.id;
        if (!id) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing id' }) };
        await usersCol.deleteOne({ id });
        return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
      }
    }

    const tenantId = event.queryStringParameters?.tenantId || JSON.parse(event.body || '{}').tenantId;

    if (path === '/orders') {
      if (!tenantId) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing tenantId context' }) };
      const tDb = await getTenantDb(tenantId);
      const ordersCol = tDb.collection('orders');
      if (method === 'GET') {
        const orders = await ordersCol.find({}).sort({ createdAt: -1 }).toArray();
        return { statusCode: 200, headers, body: JSON.stringify(orders) };
      }
      if (method === 'POST') {
        const { order } = JSON.parse(event.body || '{}');
        await ordersCol.updateOne({ id: order.id }, { $set: order }, { upsert: true });
        return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
      }
    }

    if (path === '/products') {
      if (!tenantId) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing tenantId context' }) };
      const tDb = await getTenantDb(tenantId);
      const productsCol = tDb.collection('products');
      if (method === 'GET') {
        const products = await productsCol.find({}).toArray();
        return { statusCode: 200, headers, body: JSON.stringify(products) };
      }
      if (method === 'POST') {
        const { product } = JSON.parse(event.body || '{}');
        await productsCol.updateOne({ id: product.id }, { $set: product }, { upsert: true });
        return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
      }
    }

    return { statusCode: 404, headers, body: JSON.stringify({ error: 'Cluster Endpoint Not Found' }) };

  } catch (error: any) {
    console.error("MILKY WAY API CRITICAL FAILURE:", error);
    return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
  }
};
