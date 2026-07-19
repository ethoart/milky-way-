const fs = require('fs');
let content = fs.readFileSync('pages/Dashboard.tsx', 'utf8');

const t = `const scannedReturnManifest = Object.values(pStats)
              .filter((p: any) => p.returned > 0)
              .map((p: any) => [p.name, p.returned] as [string, number])
              .sort((a, b) => b[1] - a[1]);`;

const replacement = `const scannedReturnManifest = Object.values(pStats)
              .filter((p: any) => p.returned > 0)
              .map((p: any) => [p.name, { sku: p.sku, count: p.returned }] as [string, any])
              .sort((a, b) => b[1].count - a[1].count);`;

content = content.replace(t, replacement);
fs.writeFileSync('pages/Dashboard.tsx', content);
console.log("Fixed scannedReturnManifest structure!");
