const fs = require('fs');
let content = fs.readFileSync('pages/OrderList.tsx', 'utf8');

const targetStr = `        const uniquePhones = [...new Set(finalOrders.map(o => o.customerPhone))];
        const historyResults = await Promise.all(uniquePhones.map(async (phone) => {
          const h = await db.getCustomerHistory(phone, tenantId);
          return { phone, h };
        }));
        
        const historyMap: any = {};
        historyResults.forEach(res => { 
          historyMap[res.phone.slice(-8)] = res.h; 
        });
        setCustomerHistories(historyMap);`;

const replaceStr = `        const uniquePhones = [...new Set(finalOrders.map(o => o.customerPhone).filter(Boolean))];
        let historyMap: any = {};
        if (uniquePhones.length > 0) {
            const bulkResults = await (db as any).getCustomerHistoryBulk(uniquePhones, tenantId);
            Object.keys(bulkResults).forEach(phone => {
                historyMap[phone.slice(-8)] = bulkResults[phone];
            });
        }
        setCustomerHistories(historyMap);`;

content = content.replace(targetStr, replaceStr);
fs.writeFileSync('pages/OrderList.tsx', content);
console.log("Updated OrderList for bulk history");
