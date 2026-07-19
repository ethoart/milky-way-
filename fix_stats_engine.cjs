const fs = require('fs');
let content = fs.readFileSync('server.js', 'utf8');

const oldProductStatsInit = `        const productStats = {};
        products.forEach(p => {
            let pStock = 0;
            (p.batches || []).forEach(b => {
                pStock += b.quantity;
                inventoryCostValue += (b.quantity * (b.buyingPrice || 0));
            });
            inventoryTotalCount += pStock;
            inventoryRetailValue += (pStock * (p.price || 0));
            productStats[p.id] = { 
                sku: p.sku, name: p.name, salesCount: 0, confirmed: 0, 
                shipped: 0, delivered: 0, returned: 0, upcomingReturn: 0, revenue: 0, profit: 0, buyingPrice: (p.batches && p.batches.length > 0) ? p.batches[0].buyingPrice : 0 
            };
        });`;

const newProductStatsInit = `        const productStats = {};
        products.forEach(p => {
            let pStock = 0;
            if (p.batches && p.batches.length > 0) {
                p.batches.forEach(b => {
                    pStock += (b.quantity || 0);
                    inventoryCostValue += ((b.quantity || 0) * (b.buyingPrice || 0));
                });
            } else {
                pStock = p.stock || 0;
                // fallback to 0 cost if no batches
            }
            inventoryTotalCount += pStock;
            inventoryRetailValue += (pStock * (p.price || 0));
            productStats[p.id] = { 
                sku: p.sku || 'Unknown', name: p.name || 'Unknown', salesCount: 0, confirmed: 0, 
                shipped: 0, delivered: 0, returned: 0, upcomingReturn: 0, revenue: 0, profit: 0, buyingPrice: (p.batches && p.batches.length > 0) ? p.batches[0].buyingPrice : 0 
            };
        });`;

content = content.replace(oldProductStatsInit, newProductStatsInit);

// Now fix the dynamic product stats fallback inside the allOrders loop
const getProductStatLine = `if (!productStats[item.productId]) {
                        productStats[item.productId] = {
                            sku: 'Unknown', name: item.productName || 'Unknown Product', salesCount: 0, confirmed: 0, 
                            shipped: 0, delivered: 0, returned: 0, upcomingReturn: 0, revenue: 0, profit: 0, buyingPrice: 0 
                        };
                    }`;

content = content.replace(/\(o\.items \|\| \[\]\)\.forEach\(item => \{/g, `(o.items || []).forEach(item => {\n                    ${getProductStatLine}`);

// Fix the undefined checks for productStats
content = content.replace(/if \(productStats\[item\.productId\]\) productStats\[item\.productId\]/g, `productStats[item.productId]`);
content = content.replace(/if \(productStats\[item\.productId\]\) \{/g, `{`);

fs.writeFileSync('server.js', content);
console.log("Stats engine updated");
