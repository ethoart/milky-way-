const fs = require('fs');
let content = fs.readFileSync('server.js', 'utf8');

const target = `app.get('/api/orders/dashboard-stats', async (req, res) => {
    try {
        const { tenantId, startDate, endDate } = req.query;
        if (!tenantId) return res.status(400).json({ error: 'Context Required' });`;

const replacement = `const statsCache = new Map();
app.get('/api/orders/dashboard-stats', async (req, res) => {
    try {
        const { tenantId, startDate, endDate } = req.query;
        if (!tenantId) return res.status(400).json({ error: 'Context Required' });
        const cacheKey = \`\${tenantId}_\${startDate}_\${endDate}\`;
        if (statsCache.has(cacheKey)) {
            const cached = statsCache.get(cacheKey);
            if (Date.now() - cached.timestamp < 60000) { // 1 min cache
                return res.json(cached.data);
            }
        }`;

const sendTarget = `        res.json(payload);
    } catch (e) { res.status(500).json({ error: e.message }); }
});`;

const sendReplacement = `        statsCache.set(cacheKey, { timestamp: Date.now(), data: payload });
        res.json(payload);
    } catch (e) { res.status(500).json({ error: e.message }); }
});`;

content = content.replace(target, replacement);
if (!content.includes('statsCache.set')) {
    content = content.replace(sendTarget, sendReplacement);
}

fs.writeFileSync('server.js', content);
console.log("Added backend cache for dashboard");
