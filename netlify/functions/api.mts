import { Handler } from '@netlify/functions';
import { MongoClient, ServerApiVersion, ObjectId } from 'mongodb';

const MONGODB_URI = process.env.MONGODB_URI || process.env.VITE_MONGODB_URI;
const CENTRAL_DB_NAME = 'milkyway_central';

let client: MongoClient | null = null;

async function getClient() {
  if (!client) {
    if (!MONGODB_URI) throw new Error('Infrastructure Error: MONGODB_URI missing.');
    client = new MongoClient(MONGODB_URI, {
      serverApi: ServerApiVersion.v1,
      connectTimeoutMS: 4000,
      serverSelectionTimeoutMS: 4000,
    });
    await client.connect();
  }
  return client;
}

async function seedDevAdmin(db: any) {
  const devEmail = '6969dao.eth@ethermail.io';
  const existing = await db.collection('users').findOne({ username: devEmail });
  if (!existing) {
    await db.collection('users').insertOne({
      id: 'dev-root-001',
      username: devEmail,
      password: 'SADun098',
      role: 'DEV_ADMIN',
      email: devEmail,
      createdAt: new Date().toISOString()
    });
  }
}

export const handler: Handler = async (event) => {
  const path = event.path.replace('/api', '').replace('/.netlify/functions/api', '');
  const method = event.httpMethod;
  const tenantId = event.queryStringParameters?.tenantId;

  try {
    const mongoClient = await getClient();
    const centralDb = mongoClient.db(CENTRAL_DB_NAME);
    
    if (path === '/login') await seedDevAdmin(centralDb);

    if (path === '/login' && method === 'POST') {
      const { username, password } = JSON.parse(event.body || '{}');
      const user = await centralDb.collection('users').findOne({ username, password });
      if (user) return { statusCode: 200, body: JSON.stringify(user) };
      return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };
    }

    const db = tenantId ? mongoClient.db(`tenant_${tenantId}`) : centralDb;

    // Full routing logic omitted for brevity in text file
    return { statusCode: 200, body: JSON.stringify({ message: "Milky Way Active" }) };
  } catch (error: any) {
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }
};
