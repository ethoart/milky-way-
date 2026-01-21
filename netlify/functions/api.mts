
import { Handler } from '@netlify/functions';
import { MongoClient } from 'mongodb';

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

async function getTenantDb(tenantId: string) {
    const central = await getCentralDb();
    const tenant = await central.collection('tenants').findOne({ id: tenantId });
    if (!tenant) throw new Error(`Tenant ${tenantId} not found`);
    const uri = tenant.mongoUri || CENTRAL_URI; 
    if (tenantClients.has(tenantId)) return tenantClients.get(tenantId)!.db(); 
    const client = new MongoClient(uri);
    await client.connect();
    tenantClients.set(tenantId, client);
    return client.db(); 
}

const mapStatus = (courierStatus: string): string => {
    const s = courierStatus.toLowerCase();
    if (s.includes('delivered')) return 'DELIVERED';
    if (s.includes('returned')) return 'RETURNED';
    if (s.includes('delivery')) return 'DELIVERY';
    return 'SHIPPED'; 
};

const handler: Handler = async (event, context) => {
  context.callbackWaitsForEmptyEventLoop = false;
  const fullPath = event.path || '';
  const apiPrefix = '/.netlify/functions/api';
  let path = fullPath.startsWith(apiPrefix) ? fullPath.slice(apiPrefix.length) : fullPath;
  if (!path.startsWith('/')) path = '/' + path;
  
  const method = event.httpMethod;

  try {
    const centralDb = await getCentralDb();
    const usersCol = centralDb.collection('users');
    const tenantsCol = centralDb.collection('tenants');

    if (path === '/courier-webhook' && method === 'POST') {
        const bodyParams = new URLSearchParams(event.body || '');
        const waybill_id = bodyParams.get('waybill_id');
        const delivery_status = bodyParams.get('delivery_status');
        const last_update_time = bodyParams.get('last_update_time');

        if (!waybill_id) return { statusCode: 400, body: 'Bad Request' };

        const allTenants = await tenantsCol.find({ isActive: true }).toArray();
        for (const tenant of allTenants) {
            const tDb = await getTenantDb(tenant.id);
            const ordersCol = tDb.collection('orders');
            const order = await ordersCol.findOne({ trackingNumber: waybill_id });

            if (order) {
                await ordersCol.updateOne({ id: order.id }, { 
                    $set: { status: mapStatus(delivery_status || ''), courierStatus: delivery_status },
                    $push: { logs: { id: `log-cb-${Date.now()}`, message: `EXTERNAL: ${delivery_status}`, timestamp: new Date().toISOString(), user: 'Courier API' } }
                });
                return { statusCode: 200, headers: { "Access-Control-Allow-Origin": "*" }, body: 'Updated' };
            }
        }
        return { statusCode: 404, body: 'Waybill Not Found' };
    }

    if (path === '/health') return { statusCode: 200, body: 'OK' };

    return { statusCode: 404, body: 'Not Found' };
  } catch (error: any) {
    return { statusCode: 500, body: error.toString() };
  }
};

export { handler };
