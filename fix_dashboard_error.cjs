const fs = require('fs');
let content = fs.readFileSync('pages/Dashboard.tsx', 'utf8');

const targetStr = "if (!dashboardData.globalStats) return <div className='p-10 flex justify-center items-center h-full'><Loader2 className='animate-spin text-blue-500' size={40}/></div>;";
const replacementStr = `  if (loading) return <div className='p-10 flex justify-center items-center h-full'><Loader2 className='animate-spin text-blue-500' size={40}/></div>;
  if (!dashboardData.globalStats) return <div className='p-10 flex justify-center items-center h-full flex-col gap-4 text-center'><div className="p-4 bg-rose-50 text-rose-600 rounded-2xl"><ShieldCheck size={32} /></div><h2 className="text-xl font-black text-slate-900">Database Connection Error</h2><p className="text-sm font-bold text-slate-500 max-w-sm">The dashboard failed to load. Your MongoDB database cluster appears to be offline, paused, or unreachable.</p><button onClick={fetchData} className="px-6 py-3 bg-slate-900 text-white rounded-xl text-xs font-black uppercase tracking-wider hover:bg-slate-800">Retry Connection</button></div>;`;

content = content.replace(targetStr, replacementStr);
fs.writeFileSync('pages/Dashboard.tsx', content);
console.log("Fixed dashboard error state");
