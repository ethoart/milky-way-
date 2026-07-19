const fs = require('fs');
let content = fs.readFileSync('pages/Dashboard.tsx', 'utf8');
content = content.replace("<Loader2, RefreshCcw", "<RefreshCcw");
fs.writeFileSync('pages/Dashboard.tsx', content);
