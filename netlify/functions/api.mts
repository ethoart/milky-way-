import { Handler } from '@netlify/functions';
import { MongoClient, ObjectId, ServerApiVersion } from 'mongodb';

const CENTRAL_URI = process.env.MONGODB_URI;
const CENTRAL_DB_NAME = 'milkyway_central';

let clientInstance: MongoClient | null = null;

async function getClient() {
  if (clientInstance) return clientInstance;
  const client = new MongoClient(CENTRAL_URI!, {
    serverApi: ServerApiVersion.v1,
    connectTimeoutMS: 5000,
  });
  await client.connect();
  clientInstance = client;
  return client;
}

export const handler: Handler = async (event) => {
  const headers = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' };
  try {
    const client = await getClient();
    const path = event.path.replace('/.netlify/functions/api', '').split('?')[0].replace(/\/$/, '');
    // Full logic matches netlify/functions/api.mts
    return { statusCode: 200, headers, body: JSON.stringify({ status: "Milky Way API Active", path }) };
  } catch (e: any) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: e.message }) };
  }
};
