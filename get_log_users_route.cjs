const fs = require('fs');
let content = fs.readFileSync('server.js', 'utf8');

const route = `
app.get('/api/log-users', async (req, res) => {
    try {
        const { tenantId } = req.query;
        if (tenantId) {
            const db = await getTenantDb(tenantId);
            const col = db.collection('orders');
            
            // Get sample logs to see their case
            const orders = await col.find({"logs.user": { $regex: /Courier|OMS|System|DEV/i }}).limit(10).toArray();
            const users = new Set();
            orders.forEach(o => {
               o.logs.forEach(l => { if (l.user) users.add(l.user); });
            });
            return res.json({ users: Array.from(users) });
        }
        res.json({ error: 'tenantId missing' });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});
`;

if (!content.includes('/api/log-users')) {
    content = content.replace("app.get('/api/health'", route + "\napp.get('/api/health'");
    fs.writeFileSync('server.js', content);
    console.log("Added log-users route");
}
