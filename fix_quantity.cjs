const fs = require('fs');
let content = fs.readFileSync('server.js', 'utf8');

content = content.replace(/productStats\[item\.productId\]\.salesCount \+= item\.quantity;/g, 'productStats[item.productId].salesCount += (Number(item.quantity) || 1);');
content = content.replace(/productStats\[item\.productId\]\.confirmed \+= item\.quantity;/g, 'productStats[item.productId].confirmed += (Number(item.quantity) || 1);');
content = content.replace(/productStats\[item\.productId\]\.shipped \+= item\.quantity;/g, 'productStats[item.productId].shipped += (Number(item.quantity) || 1);');
content = content.replace(/productStats\[item\.productId\]\.delivered \+= item\.quantity;/g, 'productStats[item.productId].delivered += (Number(item.quantity) || 1);');
content = content.replace(/productStats\[item\.productId\]\.returned \+= item\.quantity;/g, 'productStats[item.productId].returned += (Number(item.quantity) || 1);');
content = content.replace(/productStats\[item\.productId\]\.upcomingReturn \+= item\.quantity;/g, 'productStats[item.productId].upcomingReturn += (Number(item.quantity) || 1);');

content = content.replace(/productStats\[item\.productId\]\.revenue \+= \(\(item\.quantity \* \(item\.price \|\| 0\)\) \|\| 0\);/g, 'productStats[item.productId].revenue += (((Number(item.quantity)||1) * (Number(item.price) || 0)) || 0);');

fs.writeFileSync('server.js', content);
console.log("Fixed quantity additions");
