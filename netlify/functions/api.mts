// Milky Way OMS Consolidated API Handler (MTS)
// Environment Required: MONGODB_URI

import { Handler } from '@netlify/functions';
import { MongoClient, ObjectId } from 'mongodb';

const CENTRAL_URI = process.env.MONGODB_URI;
const CENTRAL_DB_NAME = 'milkyway_central';

let cachedCentralClient: MongoClient | null = null;
const tenantClients = new Map<string, MongoClient>();

async function getCentralDb() {
  if (cachedCentralClient) return cachedCentralClient.db(CENTRAL_DB_NAME);
  if (!CENTRAL_URI) throw new Error('MONGODB_URI environment variable is missing.');
  const client = new MongoClient(CENTRAL_URI);
  await client.connect();
  cachedCentralClient = client;
  return client.db(CENTRAL_DB_NAME);
}

async function getTenantDb(tenantId: string | null) {
  const central = await getCentralDb();
  if (!tenantId) return central;
  const tenant = await central.collection('tenants').findOne({ id: tenantId });
  if (!tenant) return central;
  const uri = tenant.mongoUri || CENTRAL_URI;
  if (tenantClients.has(tenantId)) return tenantClients.get(tenantId)!.db();
  const client = new MongoClient(uri);
  await client.connect();
  tenantClients.set(tenantId, client);
  return client.db();
}

export const handler: Handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers, body: '' };
  const path = event.path.replace('/.netlify/functions/api', '');
  const method = event.httpMethod;
  const tenantId = event.queryStringParameters?.tenantId || null;

  try {
    const db = await getTenantDb(tenantId);
    if (path === '/health') return { statusCode: 200, headers, body: JSON.stringify({ status: 'online' }) };

    if (path === '/login' && method === 'POST') {
      const { username, password } = JSON.parse(event.body || '{}');
      const central = await getCentralDb();
      const user = await central.collection('users').findOne({ username, password });
      if (!user) return { statusCode: 401, headers, body: JSON.stringify({ error: 'Auth Failed' }) };
      return { statusCode: 200, headers, body: JSON.stringify(user) };
    }

    if (path === '/tenants') {
      const central = await getCentralDb();
      if (method === 'GET') return { statusCode: 200, headers, body: JSON.stringify(await central.collection('tenants').find({}).toArray()) };
      if (method === 'POST') {
        const { tenant, adminUser } = JSON.parse(event.body || '{}');
        await central.collection('tenants').insertOne(tenant);
        if (adminUser) await central.collection('users').insertOne(adminUser);
        return { statusCode: 201, headers, body: JSON.stringify({ success: true }) };
      }
    }

    if (path === '/users') {
      const central = await getCentralDb();
      if (method === 'GET') return { statusCode: 200, headers, body: JSON.stringify(await central.collection('users').find({}).toArray()) };
      if (method === 'POST') {
        await central.collection('users').insertOne(JSON.parse(event.body || '{}'));
        return { statusCode: 201, headers, body: JSON.stringify({ success: true }) };
      }
    }

    if (path === '/orders') {
      if (method === 'GET') return { statusCode: 200, headers, body: JSON.stringify(await db.collection('orders').find({}).toArray()) };
      if (method === 'POST') {
        const { order } = JSON.parse(event.body || '{}');
        await db.collection('orders').updateOne({ id: order.id }, { $set: order }, { upsert: true });
        return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
      }
    }

    if (path === '/products') {
      if (method === 'GET') return { statusCode: 200, headers, body: JSON.stringify(await db.collection('products').find({}).toArray()) };
      if (method === 'POST') {
        const { product } = JSON.parse(event.body || '{}');
        await db.collection('products').updateOne({ id: product.id }, { $set: product }, { upsert: true });
        return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
      }
    }

    return { statusCode: 404, headers, body: JSON.stringify({ error: 'Not Found' }) };
  } catch (error: any) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
  }
};
