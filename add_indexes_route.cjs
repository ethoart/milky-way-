const fs = require('fs');
let content = fs.readFileSync('server.js', 'utf8');

const route = `
app.get('/api/setup-indexes', async (req, res) => {
    try {
        const { tenantId } = req.query;
        const centralDb = await connectCentral();
        await centralDb.collection('tenants').createIndex({ id: 1 }, { unique: true });
        
        if (tenantId) {
            const db = await getTenantDb(tenantId);
            const col = db.collection('orders');
            await col.createIndex({ tenantId: 1 });
            await col.createIndex({ status: 1 });
            await col.createIndex({ createdAt: 1 });
            await col.createIndex({ shippedAt: 1 });
            await col.createIndex({ tenantId: 1, createdAt: -1 });
            await col.createIndex({ tenantId: 1, status: 1 });
            return res.json({ success: true, message: 'Indexes created for tenant ' + tenantId });
        }
        res.json({ success: true, message: 'Central indexes created' });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});
`;

if (!content.includes('/api/setup-indexes')) {
    content = content.replace("app.get('/api/health'", route + "\napp.get('/api/health'");
    fs.writeFileSync('server.js', content);
    console.log("Added index setup route");
}
