const fs = require('fs');
let content = fs.readFileSync('server.js', 'utf8');

const t_ship = `app.post('/api/ship-order', async (req, res) => {
    try {
        const { tenantId } = req.query;
        const { order } = req.body;
        if (!tenantId) return res.status(400).json({ error: 'Context Required' });
        const db = await getTenantDb(tenantId);
        await db.collection('orders').updateOne({ id: order.id }, { $set: { ...clean(order), tenantId } }, { upsert: true });`;

const rep_ship = `app.post('/api/ship-order', async (req, res) => {
    try {
        const { tenantId } = req.query;
        const { order, user } = req.body;
        if (!tenantId) return res.status(400).json({ error: 'Context Required' });
        const db = await getTenantDb(tenantId);
        const existing = await db.collection('orders').findOne({ id: order.id, tenantId });
        let updatedOrder = { ...order };
        if (existing) {
            updatedOrder = { ...existing, ...order, status: 'SHIPPED', shippedAt: new Date().toISOString() };
            if (!updatedOrder.logs) updatedOrder.logs = [];
            updatedOrder.logs.push({ id: \`l-\${Date.now()}\`, message: \`Status Protocol: Order transitioned to SHIPPED\`, timestamp: new Date().toISOString(), user: user || 'System' });
        }
        await db.collection('orders').updateOne({ id: order.id }, { $set: { ...clean(updatedOrder), tenantId } }, { upsert: true });`;

content = content.replace(t_ship, rep_ship);

const t_ret = `app.post('/api/process-return', async (req, res) => {
    try {
        const { tenantId } = req.query;
        const { trackingOrId } = req.body;
        if (!tenantId) return res.status(400).json({ error: 'Context Required' });
        const db = await getTenantDb(tenantId);
        const order = await db.collection('orders').findOne({ tenantId, $or: [{ id: trackingOrId }, { trackingNumber: trackingOrId }] });
        if (!order) return res.status(404).json({ error: 'Not Found' });
        order.status = 'RETURN_COMPLETED';
        order.returnCompletedAt = new Date().toISOString();
        await db.collection('orders').updateOne({ id: order.id }, { $set: { ...clean(order), tenantId } });`;

const rep_ret = `app.post('/api/process-return', async (req, res) => {
    try {
        const { tenantId } = req.query;
        const { trackingOrId, user } = req.body;
        if (!tenantId) return res.status(400).json({ error: 'Context Required' });
        const db = await getTenantDb(tenantId);
        const order = await db.collection('orders').findOne({ tenantId, $or: [{ id: trackingOrId }, { trackingNumber: trackingOrId }] });
        if (!order) return res.status(404).json({ error: 'Not Found' });
        order.status = 'RETURN_COMPLETED';
        order.returnCompletedAt = new Date().toISOString();
        if (!order.logs) order.logs = [];
        order.logs.push({ id: \`l-\${Date.now()}\`, message: \`Status Protocol: Order transitioned to RETURN_COMPLETED\`, timestamp: order.returnCompletedAt, user: user || 'System' });
        await db.collection('orders').updateOne({ id: order.id }, { $set: { ...clean(order), tenantId } });`;

content = content.replace(t_ret, rep_ret);

fs.writeFileSync('server.js', content);
console.log("Fixed server.js for APIs");
