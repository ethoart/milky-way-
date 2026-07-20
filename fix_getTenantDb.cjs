const fs = require('fs');
let content = fs.readFileSync('server.js', 'utf8');

const target = `async function getTenantDb(tenantId) {
    const db = await connectCentral();
    const tenantConfig = await db.collection('tenants').findOne({ id: tenantId });
    if (tenantConfig && tenantConfig.mongoUri) {
        if (tenantClients.has(tenantId)) return tenantClients.get(tenantId).db();
        try {
            const tClient = new MongoClient(tenantConfig.mongoUri);
            await tClient.connect();
            tenantClients.set(tenantId, tClient);
            return tClient.db();
        } catch (err) { return db; }
    }
    return db;
}`;

const replacement = `const tenantDbCache = new Map();
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
            const tClient = new MongoClient(tenantConfig.mongoUri, { maxPoolSize: 50 });
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

content = content.replace(target, replacement);
fs.writeFileSync('server.js', content);
console.log('Fixed getTenantDb caching');
