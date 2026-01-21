
// MILKY WAY OMS PRODUCTION BACKEND REFERENCE
// This file is a mirror of netlify/functions/api.mts

import { Handler } from '@netlify/functions';
import { MongoClient, ServerApiVersion } from 'mongodb';

const MONGODB_URI = process.env.MONGODB_URI || process.env.VITE_MONGODB_URI;
const CENTRAL_DB_NAME = 'milkyway_central';

let cachedClient: MongoClient | null = null;

async function getClient() {
  if (cachedClient) {
    try {
      await cachedClient.db('admin').command({ ping: 1 });
      return cachedClient;
    } catch (e) {
      cachedClient = null;
    }
  }

  if (!MONGODB_URI) throw new Error('MONGODB_URI missing.');

  const client = new MongoClient(MONGODB_URI, {
    serverApi: ServerApiVersion.v1,
    connectTimeoutMS: 8000,
    serverSelectionTimeoutMS: 8000,
  });

  await client.connect();
  cachedClient = client;
  return client;
}

export const handler: Handler = async (event) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers, body: '' };

  const fullPath = event.path || '';
  const path = fullPath.replace('/api', '').replace('/.netlify/functions/api', '').replace(/\/$/, '');
  const method = event.httpMethod;
  const tenantId = event.queryStringParameters?.tenantId;

  try {
    const mongoClient = await getClient();
    const centralDb = mongoClient.db(CENTRAL_DB_NAME);
    const db = tenantId ? mongoClient.db(`tenant_${tenantId}`) : centralDb;

    if (path === '/login' && method === 'POST') {
      const { username, password } = JSON.parse(event.body || '{}');
      const user = await centralDb.collection('users').findOne({ username, password });
      if (user) return { statusCode: 200, headers, body: JSON.stringify(user) };
      return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorized' }) };
    }

    if (path === '/orders') {
      if (method === 'GET') {
        const orders = await db.collection('orders').find({}).toArray();
        return { statusCode: 200, headers, body: JSON.stringify(orders) };
      }
      if (method === 'POST') {
        const { order } = JSON.parse(event.body || '{}');
        await db.collection('orders').updateOne({ id: order.id }, { $set: order }, { upsert: true });
        return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
      }
    }

    return { statusCode: 200, headers, body: JSON.stringify({ message: "Milky Way Active" }) };
  } catch (error: any) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
  }
};
