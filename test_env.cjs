const fs = require('fs');
let content = fs.readFileSync('server.js', 'utf8');
content = content.replace(
  "app.get('/api/health', (req, res) => res.json({ status: 'connected' }));",
  "app.get('/api/health', (req, res) => res.json({ status: 'connected', env: Object.keys(process.env).join(',') }));"
);
fs.writeFileSync('server.js', content);
