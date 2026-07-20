const fs = require('fs');
let content = fs.readFileSync('pages/OrderList.tsx', 'utf8');

const targetStr = `      setOrders(finalOrders);
      setTotalCount(total);
      
      if (finalOrders.length > 0) {`;

const replaceStr = `      setOrders(finalOrders);
      setTotalCount(total);
      
      // Pre-cache for instant new tab load
      try {
          finalOrders.forEach(o => {
              localStorage.setItem('pre_order_' + o.id, JSON.stringify(o));
          });
      } catch(e) {}
      
      if (finalOrders.length > 0) {`;

content = content.replace(targetStr, replaceStr);
fs.writeFileSync('pages/OrderList.tsx', content);
console.log("Updated OrderList to pre-cache all loaded orders");
