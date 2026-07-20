const fs = require('fs');
let content = fs.readFileSync('pages/OrderDetail.tsx', 'utf8');

content = content.replace("      if (!order) {", "      if (!order && !hasPreload) {");

fs.writeFileSync('pages/OrderDetail.tsx', content);
console.log("Updated OrderDetail to use hasPreload for network skip");
