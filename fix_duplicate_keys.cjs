const fs = require('fs');
let content = fs.readFileSync('pages/Dashboard.tsx', 'utf8');

content = content.replace(
  "inventory: { totalCount: 0, costValue: 0, retailValue: 0 }, manifest: [], scannedReturnManifest: [],",
  "inventory: { totalCount: 0, costValue: 0, retailValue: 0 },"
);

fs.writeFileSync('pages/Dashboard.tsx', content);
