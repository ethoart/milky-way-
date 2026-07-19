const fs = require('fs');
let content = fs.readFileSync('pages/Dashboard.tsx', 'utf8');

content = content.replace(
  "dashboardData.globalStats: fetchedStats.stats,",
  "globalStats: fetchedStats.stats,"
);

fs.writeFileSync('pages/Dashboard.tsx', content);
