const fs = require('fs');
let content = fs.readFileSync('server.js', 'utf8');
content = content.replace(
  "res.json({ status: 'connected', env: Object.keys(process.env).join(',') });",
  "res.json({ status: 'connected', env: Object.keys(process.env).join(','), dbUri: process.env.MONGODB_URI ? 'present' : 'missing' });"
);
fs.writeFileSync('server.js', content);
