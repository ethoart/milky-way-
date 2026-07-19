const fs = require('fs');
let content = fs.readFileSync('pages/ReturnManagement.tsx', 'utf8');

content = content.replace(
  "          data={displayOrders}",
  "          status={activeFilter}\n          productId={selectedProductId === 'ALL' ? null : selectedProductId}\n          startDate={startDate}\n          endDate={endDate}"
);

// also remove `const [orders, setOrders] = useState<Order[]>([]);` if we aren't fetching them
content = content.replace("const [orders, setOrders] = useState<Order[]>([]);", "");

fs.writeFileSync('pages/ReturnManagement.tsx', content);
