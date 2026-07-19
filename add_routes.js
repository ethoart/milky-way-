const fs = require('fs');
let code = fs.readFileSync('server.js', 'utf8');

const additionalRoutes = `
app.get('/api/products', async (req, res) => {
    try {
        const { tenantId } = req.query;
        if (!tenantId) return res.status(400).json({ error: 'Context Required' });
        const db = await getTenantDb(tenantId);
        const products = await db.collection('products').find({ tenantId }).toArray();
        res.json(products.map(clean));
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/products', async (req, res) => {
    try {
        const { tenantId } = req.query;
        const { product } = req.body;
        if (!tenantId) return res.status(400).json({ error: 'Context Required' });
        const db = await getTenantDb(tenantId);
        await db.collection('products').updateOne({ id: product.id }, { $set: { ...clean(product), tenantId } }, { upsert: true });
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/products', async (req, res) => {
    try {
        const { tenantId, id } = req.query;
        if (!tenantId || !id) return res.status(400).json({ error: 'Context Required' });
        const db = await getTenantDb(tenantId);
        await db.collection('products').deleteOne({ id, tenantId });
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/tenants', async (req, res) => {
    try {
        if (!centralDb) return res.status(500).json({ error: 'Central DB not connected' });
        const tenants = await centralDb.collection('tenants').find({}).toArray();
        res.json(tenants.map(clean));
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/tenants', async (req, res) => {
    try {
        const { tenant, adminUser } = req.body;
        if (!centralDb) return res.status(500).json({ error: 'Central DB not connected' });
        await centralDb.collection('tenants').updateOne({ id: tenant.id }, { $set: clean(tenant) }, { upsert: true });
        if (adminUser) {
            await centralDb.collection('users').updateOne({ id: adminUser.id }, { $set: clean(adminUser) }, { upsert: true });
        }
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/tenants', async (req, res) => {
    try {
        const { id, settings } = req.body;
        if (!centralDb) return res.status(500).json({ error: 'Central DB not connected' });
        await centralDb.collection('tenants').updateOne({ id }, { $set: { settings } });
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/tenants', async (req, res) => {
    try {
        const { id } = req.query;
        if (!centralDb) return res.status(500).json({ error: 'Central DB not connected' });
        await centralDb.collection('tenants').deleteOne({ id });
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/ship-order', async (req, res) => {
    try {
        const { tenantId } = req.query;
        const { order } = req.body;
        if (!tenantId) return res.status(400).json({ error: 'Context Required' });
        const db = await getTenantDb(tenantId);
        await db.collection('orders').updateOne({ id: order.id }, { $set: { ...clean(order), tenantId } }, { upsert: true });
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/customer-history-detailed', async (req, res) => {
    try {
        const { tenantId, phone } = req.query;
        if (!phone) return res.json([]);
        const db = await getTenantDb(tenantId);
        const history = await db.collection('orders').find({ tenantId, customerPhone: phone }).sort({ createdAt: -1 }).toArray();
        res.json(history.map(clean));
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/process-return', async (req, res) => {
    try {
        const { tenantId } = req.query;
        const { trackingOrId } = req.body;
        if (!tenantId) return res.status(400).json({ error: 'Context Required' });
        const db = await getTenantDb(tenantId);
        // Find order
        const order = await db.collection('orders').findOne({ tenantId, $or: [{ id: trackingOrId }, { trackingNumber: trackingOrId }] });
        if (!order) return res.status(404).json({ error: 'Not Found' });
        order.status = 'RETURN_COMPLETED'; // simplified
        await db.collection('orders').updateOne({ id: order.id }, { $set: { ...clean(order), tenantId } });
        res.json(clean(order));
    } catch (e) { res.status(500).json({ error: e.message }); }
});
`;

if (!code.includes("app.get('/api/products'")) {
    const insertPos = code.indexOf('if (process.env.NODE_ENV !== "production") {');
    if (insertPos !== -1) {
        code = code.slice(0, insertPos) + additionalRoutes + '\n' + code.slice(insertPos);
        fs.writeFileSync('server.js', code);
        console.log("Routes added.");
    } else {
        console.log("Could not find insertion point.");
    }
} else {
    console.log("Routes already exist.");
}
