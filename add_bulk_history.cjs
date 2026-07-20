const fs = require('fs');
let content = fs.readFileSync('server.js', 'utf8');

const route = `
app.post('/api/customer-history-bulk', async (req, res) => {
    try {
        const { tenantId } = req.query;
        const { phones } = req.body;
        if (!tenantId || !phones || !Array.isArray(phones)) return res.json({});
        const db = await getTenantDb(tenantId);
        const col = db.collection('orders');
        ensureTenantIndexes(col, tenantId);
        
        const history = await col.find({ tenantId, customerPhone: { $in: phones } }).project({ customerPhone: 1, status: 1 }).toArray();
        
        const results = {};
        phones.forEach(p => results[p] = { count: 0, returns: 0 });
        
        history.forEach(h => {
            if (h.customerPhone && results[h.customerPhone]) {
                results[h.customerPhone].count++;
                if (['RETURNED', 'RETURN_TRANSFER', 'RETURN_AS_ON_SYSTEM', 'RETURN_HANDOVER', 'RETURN_COMPLETED'].includes(h.status)) {
                    results[h.customerPhone].returns++;
                }
            }
        });
        
        res.json(results);
    } catch (e) { res.status(500).json({ error: e.message }); }
});
`;

if (!content.includes('/api/customer-history-bulk')) {
    content = content.replace("app.get('/api/customer-history'", route + "\napp.get('/api/customer-history'");
    fs.writeFileSync('server.js', content);
    console.log("Added bulk history route");
}
