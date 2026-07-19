const fs = require('fs');
let content = fs.readFileSync('pages/Dashboard.tsx', 'utf8');

const target = `const teamLeaderboard = Object.values(tStats).sort((a: any, b: any) => b.interactions - a.interactions);
                    
          setDashboardData({ manifest: [], scannedReturnManifest: [],
              globalStats: fetchedStats.stats,`;

const replacement = `const teamLeaderboard = Object.values(tStats).sort((a: any, b: any) => b.interactions - a.interactions);

          const manifest = Object.values(pStats)
              .filter((p: any) => p.shipped > 0)
              .map((p: any) => [p.name, p.shipped] as [string, number])
              .sort((a, b) => b[1] - a[1]);
              
          const scannedReturnManifest = Object.values(pStats)
              .filter((p: any) => p.returned > 0)
              .map((p: any) => [p.name, p.returned] as [string, number])
              .sort((a, b) => b[1] - a[1]);
              
          setDashboardData({ manifest, scannedReturnManifest,
              globalStats: fetchedStats.stats,`;

content = content.replace(target, replacement);
fs.writeFileSync('pages/Dashboard.tsx', content);
console.log("Fixed!");
