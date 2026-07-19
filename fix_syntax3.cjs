const fs = require('fs');
let content = fs.readFileSync('pages/Dashboard.tsx', 'utf8');

content = content.replace(
  "  }, [orders, products, team, startDate, endDate, preset, dashboardData.globalStats]);\n",
  ""
);

content = content.replace(/dashboardData\.stats\./g, 'dashboardData.globalStats.');

// ensure we don't error out if globalStats is null
content = content.replace(
  "const statsCards = [",
  "if (!dashboardData.globalStats) return <div className='p-10 flex justify-center items-center h-full'><Loader2 className='animate-spin text-blue-500' size={40}/></div>;\n  const statsCards = ["
);
// Import Loader2 if needed
if (!content.includes('Loader2')) {
  content = content.replace(
    "import { ",
    "import { Loader2, "
  );
}

fs.writeFileSync('pages/Dashboard.tsx', content);
