const fs = require('fs');
let content = fs.readFileSync('server.js', 'utf8');

content = content.replace("connectTimeoutMS: 15000", "connectTimeoutMS: 5000, serverSelectionTimeoutMS: 5000");

fs.writeFileSync('server.js', content);
console.log("Fixed server timeout");
