const fs = require('fs');
let content = fs.readFileSync('pages/Dashboard.tsx', 'utf8');

// Fix inventory properties
content = content.replace(/dashboardData\.inventory\.count/g, "dashboardData.inventory.totalCount");
content = content.replace(/dashboardData\.inventory\.retail/g, "dashboardData.inventory.retailValue");
content = content.replace(/dashboardData\.inventory\.cost/g, "dashboardData.inventory.costValue");

// Add manifest computation inside fetchData
const fetchStatsReplacement = `
          const teamLeaderboard = Object.values(tStats).sort((a: any, b: any) => b.interactions - a.interactions);
          
          const manifest = Object.values(pStats)
              .filter((p: any) => p.shipped > 0)
              .map((p: any) => [p.name, p.shipped] as [string, number])
              .sort((a, b) => b[1] - a[1]);
              
          const scannedReturnManifest = Object.values(pStats)
              .filter((p: any) => p.returned > 0)
              .map((p: any) => [p.name, p.returned] as [string, number])
              .sort((a, b) => b[1] - a[1]);

          setDashboardData({
              manifest,
              scannedReturnManifest,
              globalStats: fetchedStats.stats,`;

content = content.replace(
    "const teamLeaderboard = Object.values(tStats).sort((a: any, b: any) => b.interactions - a.interactions);\n\n          setDashboardData({\n              globalStats: fetchedStats.stats,",
    fetchStatsReplacement
);

fs.writeFileSync('pages/Dashboard.tsx', content);
console.log("Dashboard updated");
