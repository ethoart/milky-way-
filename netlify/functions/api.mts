// Milky Way OMS Production API Handler
// Handles Auth, Multi-Tenancy, and Infrastructure Control

import { Handler } from '@netlify/functions';
import { MongoClient, ServerApiVersion } from 'mongodb';

const MONGODB_URI = process.env.MONGODB_URI || process.env.VITE_MONGODB_URI;
const CENTRAL_DB_NAME = 'milkyway_central';

let centralClient: MongoClient | null = null;
const tenantClients = new Map<string, MongoClient>();

async function getCentralDb() {
  if (!centralClient) {
    centralClient = new MongoClient(MONGODB_URI!, {
      serverApi: ServerApiVersion.v1,
      connectTimeoutMS: 10000,
    });
    await centralClient.connect();
  }
  return centralClient.db(CENTRAL_DB_NAME);
}

async function getTenantDb(tenantId: string) {
  if (!tenantId || tenantId === 'central') return await getCentralDb();
  if (tenantClients.has(tenantId)) return tenantClients.get(tenantId)!.db(`tenant_${tenantId}`);

  const centralDb = await getCentralDb();
  const tenant = await centralDb.collection('tenants').findOne({ id: tenantId });

  if (!tenant || !tenant.mongoUri) throw new Error('Tenant cluster not configured');

  const client = new MongoClient(tenant.mongoUri, {
    serverApi: ServerApiVersion.v1,
    connectTimeoutMS: 10000,
  });
  
  await client.connect();
  tenantClients.set(tenantId, client);
  return client.db(`tenant_${tenantId}`);
}

export const handler: Handler = async (event) => {
  const path = event.path.replace('/.netlify/functions/api', '');
  const method = event.httpMethod;
  const tenantId = event.queryStringParameters?.tenantId || '';
  
  try {
    const centralDb = await getCentralDb();

    if (path === '/login' && method === 'POST') {
      const { username, password } = JSON.parse(event.body || '{}');
      let user = await centralDb.collection('users').findOne({ username, password });
      if (!user && tenantId) {
        const tDb = await getTenantDb(tenantId);
        user = await tDb.collection('users').findOne({ username, password });
      }
      return { statusCode: user ? 200 : 401, body: JSON.stringify(user || { error: 'Invalid' }) };
    }

    if (path === '/tenants') {
      if (method === 'GET') return { statusCode: 200, body: JSON.stringify(await centralDb.collection('tenants').find({}).toArray()) };
      if (method === 'POST') {
        const { tenant, adminUser } = JSON.parse(event.body || '{}');
        await centralDb.collection('tenants').updateOne({ id: tenant.id }, { $set: tenant }, { upsert: true });
        if (adminUser) await centralDb.collection('users').updateOne({ id: adminUser.id }, { $set: adminUser }, { upsert: true });
        return { statusCode: 200, body: JSON.stringify({ success: true }) };
      }
    }

    const db = await getTenantDb(tenantId);
    if (path === '/orders') {
       if (method === 'GET') return { statusCode: 200, body: JSON.stringify(await db.collection('orders').find({}).toArray()) };
       if (method === 'POST') {
         const { order } = JSON.parse(event.body || '{}');
         await db.collection('orders').updateOne({ id: order.id }, { $set: order }, { upsert: true });
         return { statusCode: 200, body: JSON.stringify({ success: true }) };
       }
    }

    return { statusCode: 404, body: "Not Found" };
  } catch (e: any) {
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};
