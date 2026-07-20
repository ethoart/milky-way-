const fs = require('fs');
let content = fs.readFileSync('server.js', 'utf8');
content = content.replace(
    "const MONGODB_URI = process.env.MONGODB_URI;",
    "const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://oms_dev:Fw5bXQ3L9D1rP0Xw@cluster0.xyj8j.mongodb.net/milky_way_oms?retryWrites=true&w=majority&appName=Cluster0';"
);
fs.writeFileSync('server.js', content);
console.log("Fixed MONGODB_URI fallback in server.js");
