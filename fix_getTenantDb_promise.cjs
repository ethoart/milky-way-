const fs = require('fs');
let content = fs.readFileSync('server.js', 'utf8');

const target = `const tenantDbCache = new Map();
async function getTenantDb(tenantId) {
    if (tenantDbCache.has(tenantId)) return tenantDbCache.get(tenantId);
    if (tenantClients.has(tenantId)) {
        const db = tenantClients.get(tenantId).db();
        tenantDbCache.set(tenantId, db);
        return db;
    }
    const central = await connectCentral();
    const tenantConfig = await central.collection('tenants').findOne({ id: tenantId });
    if (tenantConfig && tenantConfig.mongoUri) {
        try {
            const tClient = new MongoClient(tenantConfig.mongoUri, { maxPoolSize: 200 });
            await tClient.connect();
            tenantClients.set(tenantId, tClient);
            const db = tClient.db();
            tenantDbCache.set(tenantId, db);
            return db;
        } catch (err) { return central; }
    }
    tenantDbCache.set(tenantId, central);
    return central;
}`;

const replacement = `const tenantDbCache = new Map();
const tenantDbPromises = new Map();
async function getTenantDb(tenantId) {
    if (tenantDbCache.has(tenantId)) return tenantDbCache.get(tenantId);
    if (tenantDbPromises.has(tenantId)) return tenantDbPromises.get(tenantId);

    const p = (async () => {
        if (tenantClients.has(tenantId)) {
            const db = tenantClients.get(tenantId).db();
            tenantDbCache.set(tenantId, db);
            return db;
        }
        const central = await connectCentral();
        const tenantConfig = await central.collection('tenants').findOne({ id: tenantId });
        if (tenantConfig && tenantConfig.mongoUri) {
            try {
                const tClient = new MongoClient(tenantConfig.mongoUri, { maxPoolSize: 200 });
                await tClient.connect();
                tenantClients.set(tenantId, tClient);
                const db = tClient.db();
                tenantDbCache.set(tenantId, db);
                return db;
            } catch (err) { return central; }
        }
        tenantDbCache.set(tenantId, central);
        return central;
    })();
    
    tenantDbPromises.set(tenantId, p);
    try {
        const res = await p;
        return res;
    } finally {
        tenantDbPromises.delete(tenantId);
    }
}`;

content = content.replace(target, replacement);
fs.writeFileSync('server.js', content);
console.log('Fixed getTenantDb caching with promises');
