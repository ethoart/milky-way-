const fs = require('fs');
let content = fs.readFileSync('pages/Dashboard.tsx', 'utf8');

content = content.replace(
  "dashboardData.globalStats: null,",
  "globalStats: null,"
);

fs.writeFileSync('pages/Dashboard.tsx', content);
