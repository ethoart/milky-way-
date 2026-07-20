const fs = require('fs');
let content = fs.readFileSync('pages/OrderDetail.tsx', 'utf8');

const targetRegex = /        if \(!isReload\) \{[\s\S]*?\} catch\(e\) \{\}\n            \}\n        \}/;
content = content.replace(targetRegex, '');

fs.writeFileSync('pages/OrderDetail.tsx', content);
console.log("Cleaned pre_order localStorage fallback");
