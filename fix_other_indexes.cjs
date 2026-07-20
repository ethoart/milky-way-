const fs = require('fs');
let content = fs.readFileSync('server.js', 'utf8');

const targetStr = `async function connectCentral() {
    if (!centralDbPromise) {
        if (!MONGODB_URI) {
            return Promise.reject(new Error("MONGODB_URI is missing"));
        }
        centralDbPromise = (async () => {
            const client = new MongoClient(MONGODB_URI, {
                serverApi: { version: ServerApiVersion.v1, strict: true, deprecationErrors: true },
                connectTimeoutMS: 15000
            });
            await client.connect();
            console.log(">>> MW-OMS Master Node Active.");
            return client.db(CENTRAL_DB_NAME);
        })();
        centralDbPromise.catch(err => {
            centralDbPromise = null;
        });
    }
    return centralDbPromise;
}`;

const replaceStr = `async function connectCentral() {
    if (!centralDbPromise) {
        if (!MONGODB_URI) {
            return Promise.reject(new Error("MONGODB_URI is missing"));
        }
        centralDbPromise = (async () => {
            const client = new MongoClient(MONGODB_URI, {
                serverApi: { version: ServerApiVersion.v1, strict: true, deprecationErrors: true },
                connectTimeoutMS: 15000
            });
            await client.connect();
            console.log(">>> MW-OMS Master Node Active.");
            const db = client.db(CENTRAL_DB_NAME);
            db.collection('users').createIndex({ tenantId: 1 }).catch(()=>{});
            db.collection('tenants').createIndex({ id: 1 }, { unique: true }).catch(()=>{});
            return db;
        })();
        centralDbPromise.catch(err => {
            centralDbPromise = null;
        });
    }
    return centralDbPromise;
}`;

content = content.replace(targetStr, replaceStr);

const funcTargetStr = `function ensureTenantIndexes(col, tenantId) {`;
const funcReplaceStr = `function ensureTenantIndexes(col, tenantId) {
    if (!ensuredIndexes.has(tenantId + "_products")) {
        col.s.db.collection('products').createIndex({ tenantId: 1 }).catch(() => {});
        ensuredIndexes.add(tenantId + "_products");
    }`;

content = content.replace(funcTargetStr, funcReplaceStr);

fs.writeFileSync('server.js', content);
console.log("Added products and users indexes");
