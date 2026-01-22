import { Handler } from '@netlify/functions';
import { MongoClient, ServerApiVersion } from 'mongodb';

// Constants
const CENTRAL_URI = process.env.MONGODB_URI;
const CENTRAL_DB_NAME = 'milkyway_central';

// Connection Pooling
let cachedCentralClient: MongoClient | null = null;
const tenantClients = new Map<string, MongoClient>();

async function getConnectedClient(uri: string = CENTRAL_URI!) {
  const isCentral = uri === CENTRAL_URI;
  if (isCentral && cachedCentralClient) return cachedCentralClient;
  if (!isCentral && tenantClients.has(uri)) return tenantClients.get(uri)!;

  const client = new MongoClient(uri, {
    serverApi: { version: ServerApiVersion.v1, strict: true, deprecationErrors: true },
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

  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers, body: '' };

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

    if (path === '/login' && method === 'POST') {
      const { username, password } = JSON.parse(event.body || '{}');
      const user = await usersCol.findOne({ username, password });
      if (user) {
        const { password: _, ...safeUser } = user;
        return { statusCode: 200, headers, body: JSON.stringify(safeUser) };
      }
      return { statusCode: 401, headers, body: JSON.stringify({ error: 'Invalid credentials' }) };
    }

    if (path === '/tenants') {
      if (method === 'GET') return { statusCode: 200, headers, body: JSON.stringify(await tenantsCol.find({}).toArray()) };
      if (method === 'POST' || method === 'PUT') {
        const { tenant, adminUser } = JSON.parse(event.body || '{}');
        const { _id, ...tenantData } = tenant;
        await tenantsCol.updateOne({ id: tenant.id }, { $set: tenantData }, { upsert: true });
        if (adminUser) {
          const updateFields: any = {};
          if (adminUser.username) updateFields.username = adminUser.username;
          if (adminUser.password) updateFields.password = adminUser.password;
          await usersCol.updateOne({ tenantId: tenant.id, role: 'SUPER_ADMIN' }, { $set: updateFields }, { upsert: true });
        }
        return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
      }
    }

    const tenantId = event.queryStringParameters?.tenantId || JSON.parse(event.body || '{}').tenantId;
    let activeDb = centralDb;
    if (tenantId) {
      const tenantConfig = await tenantsCol.findOne({ id: tenantId });
      if (tenantConfig && tenantConfig.mongoUri) {
        try {
          const tenantClient = await getConnectedClient(tenantConfig.mongoUri);
          const dbName = new URL(tenantConfig.mongoUri).pathname.slice(1) || `mw_cluster_${tenantId}`;
          activeDb = tenantClient.db(dbName);
        } catch (e) {}
      }
    }

    if (path === '/orders') {
      const ordersCol = activeDb.collection('orders');
      if (method === 'GET') {
        const id = event.queryStringParameters?.id;
        if (id) return { statusCode: 200, headers, body: JSON.stringify(await ordersCol.findOne({ id })) };
        return { statusCode: 200, headers, body: JSON.stringify(await ordersCol.find({ tenantId }).sort({ createdAt: -1 }).toArray()) };
      }
      if (method === 'POST') {
        const { order, orders } = JSON.parse(event.body || '{}');
        if (orders && Array.isArray(orders)) {
          const ops = orders.map(o => ({
            updateOne: { filter: { id: o.id }, update: { $set: { ...o, tenantId } }, upsert: true }
          }));
          await ordersCol.bulkWrite(ops);
        } else if (order) {
          const { _id, ...orderData } = order;
          await ordersCol.updateOne({ id: order.id }, { $set: { ...orderData, tenantId } }, { upsert: true });
        }
        return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
      }
      if (method === 'DELETE') {
        const id = event.queryStringParameters?.id;
        await ordersCol.deleteOne({ id });
        return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
      }
    }

    // Default 404
    return { statusCode: 404, headers, body: JSON.stringify({ error: 'Endpoint Not Found' }) };
  } catch (error: any) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Internal Cluster Error', details: error.message }) };
  }
};