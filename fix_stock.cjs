const fs = require('fs');
let content = fs.readFileSync('pages/Stock.tsx', 'utf8');

content = content.replace(
  "const [orders, setOrders] = useState<Order[]>([]);",
  ""
);

content = content.replace(
  `      if (view === 'HISTORY') {
          // Fetch larger sample for accurate history aggregation
          const orderData = await db.getOrders({ tenantId, limit: 5000 });
          setOrders(orderData.data || []);
      }`,
  ""
);

fs.writeFileSync('pages/Stock.tsx', content);
