const fs = require('fs');
let content = fs.readFileSync('pages/FinancialCenter.tsx', 'utf8');

content = content.replace(
  "db.getOrders({ tenantId, limit: 5000 })",
  "db.getOrders({ tenantId, limit: 10000, startDate, endDate })"
);

content = content.replace(
  "}, [tenantId]);",
  "}, [tenantId, startDate, endDate]);"
);

fs.writeFileSync('pages/FinancialCenter.tsx', content);
