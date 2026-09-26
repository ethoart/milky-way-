
import { Handler } from '@netlify/functions';
import { MongoClient, ServerApiVersion } from 'mongodb';

const CENTRAL_URI = process.env.MONGODB_URI;
const CENTRAL_DB_NAME = 'milkyway_central';

let cachedCentralClient: MongoClient | null = null;
const tenantClients = new Map<string, MongoClient>();

async function getConnectedClient(uri: string) {
  if (uri === CENTRAL_URI && cachedCentralClient) return cachedCentralClient;
  if (tenantClients.has(uri)) return tenantClients.get(uri)!;
  const options: any = {
    maxPoolSize: 10,
    minPoolSize: 2,
    connectTimeoutMS: 20000,
    socketTimeoutMS: 45000,
    retryWrites: true,
  };
  if (uri.startsWith('mongodb+srv://') || uri.includes('tls=true') || uri.includes('ssl=true')) {
    options.tls = true;
  }
  const client = new MongoClient(uri, options);
  try {
    await client.connect();
    if (uri === CENTRAL_URI) cachedCentralClient = client;
    else tenantClients.set(uri, client);
    return client;
  } catch (err) {
    if (uri === CENTRAL_URI) cachedCentralClient = null;
    else tenantClients.delete(uri);
    throw err;
  }
}

const FDE_ERRORS: Record<number, string> = {
  201: "Inactive Client",
  202: "Invalid Order ID (Numeric Required)",
  203: "Invalid Weight",
  204: "Invalid Parcel Description",
  205: "Invalid Name",
  206: "Contact Number 1 Invalid",
  207: "Contact Number 2 Invalid",
  208: "Invalid Address",
  209: "Invalid City Name",
  210: "Insert Failed, Try Again",
  211: "Invalid API Key",
  212: "Invalid or Inactive Client",
  213: "Invalid Exchange Value",
  214: "Courier Maintenance Mode"
};

const mapStatus = (courierStatus: string) => {
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

function parseMultipartData(rawBody: string): any {
    const result: any = {};
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

        const valueStart = headerMatch.index! + headerMatch[0].length;
        let value = part.substring(valueStart).trim();
        
        // Cleanup trailing dashes from end of body
        if (value.endsWith('--')) value = value.substring(0, value.length - 2).trim();
        
        result[name] = value;
    }
    return result;
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
    if (!CENTRAL_URI) throw new Error('MONGODB_URI is not defined.');
    const centralClient = await getConnectedClient(CENTRAL_URI);
    const centralDb = centralClient.db(CENTRAL_DB_NAME);
    const usersCol = centralDb.collection('users');
    const tenantsCol = centralDb.collection('tenants');
    const citiesCol = centralDb.collection('global_cities');

    if (path === '/health') return { statusCode: 200, headers, body: JSON.stringify({ status: 'connected' }) };

    let bodyData: any = {};
    // Basic JSON parse first
    if (event.body && (method === 'POST' || method === 'PUT')) {
        try { bodyData = JSON.parse(event.body); } catch(e) {}
    }

    const tenantId = event.queryStringParameters?.tenantId || bodyData.tenantId;
    let activeDb = centralDb;
    let tenantSettings: any = null;

    if (tenantId) {
      const tenantConfig = await tenantsCol.findOne({ id: tenantId });
      if (tenantConfig) {
        tenantSettings = tenantConfig.settings;
        if (tenantConfig.mongoUri) {
          const tenantClient = await getConnectedClient(tenantConfig.mongoUri);
          activeDb = tenantClient.db();
        }
      }
    }

    if (path === '/courier-webhook' && method === 'POST') {
        let payload = bodyData;
        const rawBody = event.body || '';

        // Robust Fallback 1: Multipart Parser
        if (Object.keys(payload).length === 0 && rawBody.includes('Content-Disposition: form-data')) {
             payload = parseMultipartData(rawBody);
        } else if (Object.keys(payload).length === 0 && rawBody.includes('=')) {
             // Robust Fallback 2: URL Encoded Parser (manual check for string params)
             const params = new URLSearchParams(rawBody);
             if (params.has('waybill_id')) {
                 params.forEach((value, key) => { payload[key] = value; });
             }
        }

        // Robust Fallback 3: JSON-in-key edge case
        if (!payload.waybill_id && !payload.waybillId && Object.keys(payload).length === 1) {
             try {
                 const potentialJson = JSON.parse(Object.keys(payload)[0]);
                 if (potentialJson.waybill_id || potentialJson.waybillId) payload = potentialJson;
             } catch(e) {}
        }

        const waybill_id = payload.waybill_id || payload.waybillId || event.queryStringParameters?.waybill_id;
        const statusRaw = payload.delivery_status || payload.current_status || payload.status || event.queryStringParameters?.delivery_status;
        const lastUpdate = payload.last_update_time || new Date().toISOString();

        if (!waybill_id) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Bad Request: waybill_id missing', receivedPayload: payload }) };

        const allTenants = await tenantsCol.find({ isActive: true }).toArray();
        let found = false;
        
        for (const t of allTenants) {
            try {
                let db = centralDb;
                if (t.mongoUri) {
                    const client = await getConnectedClient(t.mongoUri);
                    db = client.db();
                }
                
                const cleanWaybill = String(waybill_id).trim();
                const order = await db.collection('orders').findOne({ 
                    trackingNumber: { $regex: `^${cleanWaybill}$`, $options: 'i' } 
                });

                if (order) {
                    found = true;
                    const newStatus = mapStatus(statusRaw);
                    if (order.status !== newStatus) {
                        await db.collection('orders').updateOne(
                            { id: order.id },
                            {
                                $set: { status: newStatus, courierStatus: statusRaw },
                                $push: { logs: { id: `l-${Date.now()}`, message: `WEBHOOK: Status update to ${statusRaw} [Time: ${lastUpdate}]`, timestamp: new Date().toISOString(), user: 'Courier System' }}
                            } as any
                        );
                    }
                    return { statusCode: 200, headers, body: 'Success' };
                }
            } catch (e) { console.error(e); }
        }
        
        // Return 200 if not found to satisfy webhook retry policies
        return { statusCode: 200, headers, body: 'Waybill Processed (Not in Registry)' };
    }

    if (path === '/login' && method === 'POST') {
      const { username, password } = bodyData;
      
      const userCount = await usersCol.countDocuments({});
      if (userCount === 0) {
        const defaultAdmin = {
          id: 'admin-bootstrap',
          username: 'admin',
          password: 'admin',
          role: 'ADMIN',
          name: 'Emergency Bootstrap Admin',
          tenantId: 'dev'
        };
        await usersCol.insertOne(defaultAdmin);
      }

      const user = await usersCol.findOne({ username, password });
      if (user) return { statusCode: 200, headers, body: JSON.stringify(user) };
      return { statusCode: 401, headers, body: JSON.stringify({ error: 'Invalid credentials' }) };
    }

    if (path === '/cities') {
      if (method === 'GET') {
        const cityDoc = await citiesCol.findOne({ id: 'master_list' });
        return { statusCode: 200, headers, body: JSON.stringify({ cities: cityDoc?.cities || [] }) };
      }
      if (method === 'POST') {
        const { cities } = bodyData;
        await citiesCol.updateOne({ id: 'master_list' }, { $set: { cities } }, { upsert: true });
        return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
      }
    }

    if (path === '/tenants') {
      if (method === 'GET') return { statusCode: 200, headers, body: JSON.stringify(await tenantsCol.find({}).toArray()) };
      if (method === 'POST' || method === 'PUT') {
        const { tenant, adminUser } = bodyData;
        await tenantsCol.updateOne({ id: tenant.id }, { $set: tenant }, { upsert: true });
        if (adminUser) await usersCol.updateOne({ tenantId: tenant.id, role: 'SUPER_ADMIN' }, { $set: adminUser }, { upsert: true });
        return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
      }
      if (method === 'DELETE') {
        const id = event.queryStringParameters?.id;
        await tenantsCol.deleteOne({ id });
        await usersCol.deleteMany({ tenantId: id });
        return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
      }
    }

    if (path === '/users') {
      if (method === 'GET') return { statusCode: 200, headers, body: JSON.stringify(await usersCol.find({ tenantId }).toArray()) };
      if (method === 'POST') {
        const user = bodyData;
        await usersCol.updateOne({ id: user.id }, { $set: user }, { upsert: true });
        return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
      }
      if (method === 'DELETE') {
        const id = event.queryStringParameters?.id;
        await usersCol.deleteOne({ id });
        return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
      }
    }

    if (path === '/products') {
      const prodCol = activeDb.collection('products');
      if (method === 'GET') return { statusCode: 200, headers, body: JSON.stringify(await prodCol.find({ tenantId }).toArray()) };
      if (method === 'POST') {
        const { product } = bodyData;
        await prodCol.updateOne({ id: product.id }, { $set: { ...product, tenantId } }, { upsert: true });
        return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
      }
      if (method === 'DELETE') {
        const id = event.queryStringParameters?.id;
        await prodCol.deleteOne({ id, tenantId });
        return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
      }
    }

    if (path === '/orders') {
      const ordersCol = activeDb.collection('orders');
      if (method === 'GET') {
        const id = event.queryStringParameters?.id;
        if (id) return { statusCode: 200, headers, body: JSON.stringify(await ordersCol.findOne({ id })) };

        const page = parseInt(event.queryStringParameters?.page || '1');
        const limit = parseInt(event.queryStringParameters?.limit || '50');
        const search = event.queryStringParameters?.search || '';
        const status = event.queryStringParameters?.status || 'ALL';
        const productId = event.queryStringParameters?.productId;
        const startDate = event.queryStringParameters?.startDate;
        const endDate = event.queryStringParameters?.endDate;

        const query: any = { tenantId };
        if (status !== 'ALL') {
          if (status === 'TODAY_SHIPPED') {
            const dateToMatch = startDate;
            if (dateToMatch) {
              const startUtc = new Date(`${dateToMatch}T00:00:00+05:30`).toISOString();
              const endUtc = new Date(`${dateToMatch}T23:59:59.999+05:30`).toISOString();
              query.shippedAt = { $gte: startUtc, $lte: endUtc };
            } else {
              query.status = 'SHIPPED';
            }
          } else if (status === 'LOGISTICS_ALL') {
            // New Filter: Only show active logistic statuses (excluding pipeline)
            query.status = { 
                $in: [
                    'SHIPPED', 'DELIVERY', 'DELIVERED', 
                    'TRANSFER', 'RETURNED', 'RETURN_TRANSFER', 
                    'RETURN_HANDOVER', 'RETURN_COMPLETED', 
                    'RETURN_AS_ON_SYSTEM', 'RESIDUAL', 'REARRANGE'
                ] 
            };
          } else {
            query.status = status;
          }
        }
        if (productId) query['items.productId'] = productId;
        if (startDate || endDate) {
          query.createdAt = {};
          if (startDate) query.createdAt.$gte = startDate;
          if (endDate) query.createdAt.$lte = endDate + 'T23:59:59';
        }
        if (search) {
          query.$or = [
            { id: { $regex: search, $options: 'i' } },
            { customerName: { $regex: search, $options: 'i' } },
            { customerPhone: { $regex: search, $options: 'i' } },
            { trackingNumber: { $regex: search, $options: 'i' } }
          ];
        }

        const total = await ordersCol.countDocuments(query);
        const data = await ordersCol.find(query).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).toArray();
        return { statusCode: 200, headers, body: JSON.stringify({ data, total, page, limit }) };
      }
      if (method === 'POST') {
        const { order, orders } = bodyData;
        if (orders) {
          const ops = orders.map((o: any) => ({ updateOne: { filter: { id: o.id }, update: { $set: { ...o, tenantId } }, upsert: true } }));
          await ordersCol.bulkWrite(ops);
        } else if (order) {
          await ordersCol.updateOne({ id: order.id }, { $set: { ...order, tenantId } }, { upsert: true });
        }
        return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
      }
      if (method === 'DELETE') {
        const { id, purge } = event.queryStringParameters || {};
        if (!tenantId) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Context Required' }) };
        if (purge === 'true') {
          const result = await ordersCol.deleteMany({ tenantId });
          return { statusCode: 200, headers, body: JSON.stringify({ success: true, count: result.deletedCount }) };
        }
        if (id) {
          const ids = id.split(',');
          const result = await ordersCol.deleteMany({ id: { $in: ids }, tenantId });
          return { statusCode: 200, headers, body: JSON.stringify({ success: true, count: result.deletedCount }) };
        }
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing Target' }) };
      }
    }

    if (path === '/orders/share' && method === 'POST') {
      const { sourceTenantId, targetTenantIds, orderIds, user } = bodyData;
      if (!sourceTenantId || !targetTenantIds || !Array.isArray(targetTenantIds) || !orderIds || !Array.isArray(orderIds)) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing required fields for sharing' }) };
      }

      // Fetch source client & DB
      const sourceConfig = await tenantsCol.findOne({ id: sourceTenantId });
      if (!sourceConfig || !sourceConfig.mongoUri) {
        return { statusCode: 404, headers, body: JSON.stringify({ error: 'Source tenant database not found' }) };
      }
      const sourceClient = await getConnectedClient(sourceConfig.mongoUri);
      const sourceDb = sourceClient.db();
      const sourceOrdersCol = sourceDb.collection('orders');
      const sourceProductsCol = sourceDb.collection('products');

      // Fetch source orders
      const sourceOrders = await sourceOrdersCol.find({ id: { $in: orderIds }, tenantId: sourceTenantId }).toArray();
      if (sourceOrders.length === 0) {
        return { statusCode: 404, headers, body: JSON.stringify({ error: 'No orders found to share' }) };
      }

      // Map source products by ID
      const productIds = [];
      sourceOrders.forEach((o: any) => {
        o.items?.forEach((item: any) => {
          if (item.productId) productIds.push(item.productId);
        });
      });
      const sourceProducts = await sourceProductsCol.find({ id: { $in: productIds } }).toArray();
      const sourceProductsMap = new Map<string, any>(sourceProducts.map((p: any) => [p.id, p]));

      // Determine target tenant IDs
      let resolvedTargets = [...targetTenantIds];
      if (targetTenantIds.includes('all')) {
        const activeTenants = await tenantsCol.find({ isActive: true }).toArray();
        resolvedTargets = activeTenants.map((t: any) => t.id).filter(id => id !== sourceTenantId);
      }

      const shareSummary: any[] = [];

      for (const targetTenantId of resolvedTargets) {
        try {
          const targetConfig = await tenantsCol.findOne({ id: targetTenantId });
          if (!targetConfig || !targetConfig.mongoUri) {
            shareSummary.push({ tenantId: targetTenantId, success: false, error: 'Database config missing' });
            continue;
          }
          const targetClient = await getConnectedClient(targetConfig.mongoUri);
          const targetDb = targetClient.db();
          const targetOrdersCol = targetDb.collection('orders');
          const targetProductsCol = targetDb.collection('products');

          // Get existing products in target tenant to check SKU match
          const targetProducts = await targetProductsCol.find({}).toArray();
          const targetSkuMap = new Map<string, any>();
          targetProducts.forEach((p: any) => {
            if (p.sku) targetSkuMap.set(p.sku.toLowerCase().trim(), p);
            if (p.name) targetSkuMap.set(p.name.toLowerCase().trim(), p);
          });

          let sharedCount = 0;
          let duplicateCount = 0;

          for (const order of sourceOrders) {
            const targetOrderId = `shared-${order.id}`;
            const existingOrder = await targetOrdersCol.findOne({ id: targetOrderId });
            if (existingOrder) {
              duplicateCount++;
              continue;
            }

            const mappedItems: any[] = [];
            for (const item of (order.items || [])) {
              let targetProduct = null;
              const sourceProd = sourceProductsMap.get(item.productId);
              const itemSku = sourceProd?.sku || item.sku || item.name;

              if (itemSku) {
                targetProduct = targetSkuMap.get(itemSku.toLowerCase().trim());
              }

              if (!targetProduct) {
                const newProductId = `p-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
                const newProduct = {
                  id: newProductId,
                  tenantId: targetTenantId,
                  sku: sourceProd?.sku || itemSku || 'GENERIC-SKU',
                  name: sourceProd?.name || item.name || 'Shared Product',
                  price: sourceProd?.price || item.price || 0,
                  batches: [{
                    id: `batch-${Date.now()}`,
                    quantity: 100,
                    buyingPrice: (sourceProd?.price || item.price || 0) * 0.5,
                    createdAt: new Date().toISOString()
                  }]
                };
                await targetProductsCol.insertOne(newProduct);
                targetProduct = newProduct;
                if (newProduct.sku) targetSkuMap.set(newProduct.sku.toLowerCase().trim(), newProduct);
              }

              mappedItems.push({
                productId: targetProduct.id,
                sku: targetProduct.sku,
                name: targetProduct.name,
                price: targetProduct.price,
                quantity: item.quantity || 1
              });
            }

            const totalAmount = mappedItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);

            const sharedOrder = {
              id: targetOrderId,
              tenantId: targetTenantId,
              customerName: order.customerName,
              customerPhone: order.customerPhone,
              customerPhone2: order.customerPhone2 || '',
              customerAddress: order.customerAddress,
              customerCity: order.customerCity || '',
              parcelWeight: order.parcelWeight || '1',
              items: mappedItems,
              totalAmount: totalAmount,
              status: order.status || 'CONFIRMED',
              createdAt: new Date().toISOString(),
              isPrinted: false,
              openedBy: user || 'System Share',
              logs: [
                {
                  id: `l-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
                  message: `Shared from shop: ${sourceTenantId}`,
                  timestamp: new Date().toISOString(),
                  user: user || 'System Share'
                },
                ...(order.logs || []).map((l: any) => ({ ...l, id: `l-orig-${l.id}` }))
              ]
            };

            await targetOrdersCol.insertOne(sharedOrder);
            sharedCount++;
          }

          shareSummary.push({
            tenantId: targetTenantId,
            shared: sharedCount,
            duplicate: duplicateCount,
            success: true
          });

        } catch (err: any) {
          shareSummary.push({
            tenantId: targetTenantId,
            success: false,
            error: err.message
          });
        }
      }

      return { statusCode: 200, headers, body: JSON.stringify({ success: true, summary: shareSummary }) };
    }

    if (path === '/admin/unified-backup' && method === 'GET') {
      const users = await usersCol.find({}).toArray();
      const tenants = await tenantsCol.find({}).toArray();
      
      const tenantsData: any = {};
      
      for (const tenant of tenants) {
        try {
          let tenantDb = centralDb;
          if (tenant.mongoUri) {
            const tenantClient = await getConnectedClient(tenant.mongoUri);
            tenantDb = tenantClient.db();
          }
          
          const orders = await tenantDb.collection('orders').find({}).toArray();
          const products = await tenantDb.collection('products').find({}).toArray();
          tenantsData[tenant.id] = {
            orders,
            products
          };
        } catch (err: any) {
          console.error(`Failed serverless backup for tenant ${tenant.id}:`, err);
          tenantsData[tenant.id] = {
            orders: [],
            products: [],
            error: err.message
          };
        }
      }
      
      const backupPayload = {
        version: "1.0.0",
        exportedAt: new Date().toISOString(),
        central: {
          users,
          tenants
        },
        tenantsData
      };
      
      return { statusCode: 200, headers, body: JSON.stringify(backupPayload) };
    }

    if (path === '/admin/unified-restore' && method === 'POST') {
      const backup = bodyData;
      if (!backup || !backup.central || !backup.tenantsData) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: "Invalid backup payload format." }) };
      }
      
      // 1. Restore Central Users
      if (Array.isArray(backup.central.users) && backup.central.users.length > 0) {
        await usersCol.deleteMany({});
        await usersCol.insertMany(backup.central.users);
      }
      
      // 2. Restore Central Tenants
      if (Array.isArray(backup.central.tenants) && backup.central.tenants.length > 0) {
        await tenantsCol.deleteMany({});
        await tenantsCol.insertMany(backup.central.tenants);
      }
      
      const restoreSummary: any[] = [];
      
      // 3. Restore each Tenant's Data
      for (const [tenantId, tenantData] of Object.entries(backup.tenantsData)) {
        try {
          const castedTenantData = (tenantData || {}) as any;
          let tenantDb = centralDb;
          const tenantConfig = await tenantsCol.findOne({ id: tenantId });
          if (tenantConfig && tenantConfig.mongoUri) {
            const tenantClient = await getConnectedClient(tenantConfig.mongoUri);
            tenantDb = tenantClient.db();
          }
          
          // Restore Orders
          const ordersCol = tenantDb.collection('orders');
          await ordersCol.deleteMany({});
          if (Array.isArray(castedTenantData.orders) && castedTenantData.orders.length > 0) {
            await ordersCol.insertMany(castedTenantData.orders);
          }
          
          // Restore Products
          const productsCol = tenantDb.collection('products');
          await productsCol.deleteMany({});
          if (Array.isArray(castedTenantData.products) && castedTenantData.products.length > 0) {
            await productsCol.insertMany(castedTenantData.products);
          }
          
          restoreSummary.push({
            tenantId,
            ordersCount: castedTenantData.orders?.length || 0,
            productsCount: castedTenantData.products?.length || 0,
            success: true
          });
        } catch (err: any) {
          console.error(`Failed serverless restore for tenant ${tenantId}:`, err);
          restoreSummary.push({
            tenantId,
            success: false,
            error: err.message
          });
        }
      }
      
      return { statusCode: 200, headers, body: JSON.stringify({ success: true, summary: restoreSummary }) };
    }

    if (path === '/ship-order' && method === 'POST') {
        const { order } = bodyData;
        const ordersCol = activeDb.collection('orders');
        if (!tenantSettings?.courierApiKey || !tenantSettings.courierApiKey.trim()) return { statusCode: 400, headers, body: JSON.stringify({ error: "Cannot ship order: Courier Auth Key (API Code) is missing in Settings. Please configure your Courier API Key in settings first." }) };

        // SANITIZE: fde expects numeric order_id
        const fdeOrderId = order.id.replace(/\D/g, '').slice(-10) || Math.floor(Math.random() * 1000000000).toString();

        // INTELLIGENT DESCRIPTION LOGIC: Prioritize product name if description is generic or missing
        const productNames = order.items && order.items.length > 0 ? order.items.map((i: any) => i.name).join(' + ') : 'Standard Shipment';
        const hasCustomDescription = order.parcelDescription && order.parcelDescription !== 'Online Order';
        const finalDescription = hasCustomDescription ? order.parcelDescription : productNames;

        const formData = new URLSearchParams();
        formData.append('api_key', tenantSettings.courierApiKey.trim());
        formData.append('client_id', tenantSettings.courierClientId.trim());
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

        const targetUrl = tenantSettings.courierMode === 'EXISTING_WAYBILL' 
          ? 'https://www.fdedomestic.com/api/parcel/existing_waybill_api_v1.php'
          : 'https://www.fdedomestic.com/api/parcel/new_api_v1.php';

        if (tenantSettings.courierMode === 'EXISTING_WAYBILL') {
            formData.append('waybill_id', (order.trackingNumber || '').toString());
        }

        const response = await fetch(targetUrl, { 
            method: 'POST', 
            headers: { 
                'Content-Type': 'application/x-www-form-urlencoded',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Accept': '*/*'
            },
            body: formData 
        });
        
        const rawText = await response.text();
        let data: any;
        try {
            data = JSON.parse(rawText);
        } catch(e) {
            return { statusCode: 400, headers, body: JSON.stringify({ error: `FDE Text Response: ${rawText.slice(0, 100)}` }) };
        }

        const status = Number(data.status);
        const hasWaybill = data.waybill_no && data.waybill_no.trim().length > 0;
        const isSuccess = status === 200 || hasWaybill;

        if (isSuccess) {
            if (tenantSettings.courierMode !== 'EXISTING_WAYBILL' && !hasWaybill) {
                return { statusCode: 400, headers, body: JSON.stringify({ error: `Courier Agent API did not return a valid Waybill Number (API Code). Response: ${rawText}` }) };
            }
            const updated = { 
                ...order, 
                status: 'SHIPPED', 
                trackingNumber: data.waybill_no || order.trackingNumber, 
                shippedAt: new Date().toISOString(),
                logs: [...(order.logs || []), { id: `l-${Date.now()}`, message: `FDE Handshake: Success. Waybill: ${data.waybill_no || 'Assigned'}`, timestamp: new Date().toISOString(), user: 'OMS Connector' }]
            };
            await ordersCol.updateOne({ id: order.id }, { $set: updated });
            return { statusCode: 200, headers, body: JSON.stringify(updated) };
        }
        
        const errorMsg = data.message || FDE_ERRORS[status] || `FDE Error ${status}: Handshake Refused`;
        return { statusCode: 400, headers, body: JSON.stringify({ error: errorMsg }) };
    }

    if (path === '/process-return' && method === 'POST') {
        const { trackingOrId } = bodyData;
        const ordersCol = activeDb.collection('orders');
        const order = await ordersCol.findOne({ $or: [{ id: trackingOrId }, { trackingNumber: trackingOrId }] });
        if (order) {
            let alreadyProcessed = false;
            let updated = { ...order };
            if (order.warehouseScanned) {
                alreadyProcessed = true;
            } else {
                const now = new Date().toISOString();
                updated = { 
                    ...order, 
                    warehouseScanned: true,
                    status: 'RETURN_COMPLETED',
                    returnCompletedAt: now,
                    returnedAt: order.returnedAt || now
                };
                await ordersCol.updateOne({ id: order.id }, { $set: updated });
            }
            return { statusCode: 200, headers, body: JSON.stringify({ ...updated, alreadyProcessed }) };
        }
        return { statusCode: 404, headers, body: JSON.stringify({ error: 'Not Found' }) };
    }

    if (path === '/customer-history' && method === 'GET') {
        const { phone } = event.queryStringParameters || {};
        if (!phone) return { statusCode: 200, headers, body: JSON.stringify({ count: 0, returns: 0 }) };
        const last8 = phone.slice(-8);
        const count = await activeDb.collection('orders').countDocuments({ customerPhone: { $regex: last8 + "$" } });
        const returns = await activeDb.collection('orders').countDocuments({ 
            customerPhone: { $regex: last8 + "$" }, 
            status: { $in: ['RETURNED', 'REJECTED', 'RETURN_COMPLETED'] } 
        });
        return { statusCode: 200, headers, body: JSON.stringify({ count, returns }) };
    }

    return { statusCode: 404, headers, body: JSON.stringify({ error: 'Not Found' }) };
  } catch (error: any) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
  }
};
