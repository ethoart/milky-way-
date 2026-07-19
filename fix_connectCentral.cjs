const fs = require('fs');
let content = fs.readFileSync('server.js', 'utf8');

const oldConnect = `let centralClient;
let centralDb;

async function connectCentral() {
    if (!centralClient) {
        if (!MONGODB_URI) throw new Error("MONGODB_URI is missing");
        try {
            centralClient = new MongoClient(MONGODB_URI, {
                serverApi: { version: ServerApiVersion.v1, strict: true, deprecationErrors: true },
                connectTimeoutMS: 15000
            });
            await centralClient.connect();
            centralDb = centralClient.db(CENTRAL_DB_NAME);
            console.log(">>> MW-OMS Master Node Active.");
        } catch (err) {
            centralClient = null;
            throw err;
        }
    }
    return centralDb;
}`;

const newConnect = `let centralDbPromise = null;

async function connectCentral() {
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

content = content.replace(oldConnect, newConnect);
fs.writeFileSync('server.js', content);
