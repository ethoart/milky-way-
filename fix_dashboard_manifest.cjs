const fs = require('fs');
let content = fs.readFileSync('pages/Dashboard.tsx', 'utf8');

content = content.replace(
  "inventory: { totalCount: 0, costValue: 0, retailValue: 0 },",
  "inventory: { totalCount: 0, costValue: 0, retailValue: 0 }, manifest: [], scannedReturnManifest: [],"
);

content = content.replace(
  "teamLeaderboard: []\n  });",
  "teamLeaderboard: [], manifest: [], scannedReturnManifest: []\n  });"
);

content = content.replace(
  "setDashboardData({",
  "setDashboardData({ manifest: [], scannedReturnManifest: [],"
);

fs.writeFileSync('pages/Dashboard.tsx', content);
