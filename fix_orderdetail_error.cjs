const fs = require('fs');
let content = fs.readFileSync('pages/OrderDetail.tsx', 'utf8');

const regex = /if \(loading\) return <div className="p-10 flex justify-center"><div className="animate-spin text-blue-600"><RefreshCcw size=\{32\} \/><\/div><\/div>;/;
const replacementStr = `if (loading) return <div className="p-10 flex justify-center"><div className="animate-spin text-blue-600"><RefreshCcw size={32} /></div></div>;
  if (!order && !loading) return <div className="p-10 flex flex-col justify-center items-center text-center gap-4 h-[60vh]"><div className="p-4 bg-rose-50 text-rose-600 rounded-2xl"><AlertCircle size={32} /></div><h2 className="text-xl font-black text-slate-900">Order Not Found or Database Offline</h2><p className="text-sm font-bold text-slate-500 max-w-sm">We couldn't load this order's data. If you opened this in a new tab, the database connection might be failing.</p><button onClick={() => loadData(true)} className="px-6 py-3 bg-slate-900 text-white rounded-xl text-xs font-black uppercase tracking-wider hover:bg-slate-800 flex items-center gap-2"><RefreshCw size={16} /> Retry Fetch</button></div>;`;

content = content.replace(regex, replacementStr);
fs.writeFileSync('pages/OrderDetail.tsx', content);
console.log("Fixed OrderDetail error state");
