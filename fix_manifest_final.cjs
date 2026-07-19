const fs = require('fs');
let content = fs.readFileSync('pages/Dashboard.tsx', 'utf8');

const t = 'const teamLeaderboard = Object.values(tStats).sort((a: any, b: any) => b.interactions - a.interactions);';
const t2 = 'setDashboardData({ manifest: [], scannedReturnManifest: [],';

const replacement = `const teamLeaderboard = Object.values(tStats).sort((a: any, b: any) => b.interactions - a.interactions);
          
          const manifest = Object.values(pStats)
              .filter((p: any) => p.shipped > 0)
              .map((p: any) => [p.name, p.shipped] as [string, number])
              .sort((a, b) => b[1] - a[1]);
              
          const scannedReturnManifest = Object.values(pStats)
              .filter((p: any) => p.returned > 0)
              .map((p: any) => [p.name, p.returned] as [string, number])
              .sort((a, b) => b[1] - a[1]);

          setDashboardData({ manifest, scannedReturnManifest,`;

const idx1 = content.indexOf(t);
const idx2 = content.indexOf(t2);

if (idx1 !== -1 && idx2 !== -1) {
    content = content.substring(0, idx1) + replacement + content.substring(idx2 + t2.length);
    fs.writeFileSync('pages/Dashboard.tsx', content);
    console.log("Successfully patched manifest computation!");
} else {
    console.log("Failed to find target substrings", idx1, idx2);
}
