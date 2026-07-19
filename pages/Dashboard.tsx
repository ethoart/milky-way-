
import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { Order, OrderStatus, Product, User } from '../types';
import { db } from '../services/mockBackend';
import { formatCurrency, formatFullNumber, getSLDateString, getReturnCompletionDate } from '../utils/helpers';
import { 
  Loader2, RefreshCcw, DollarSign, Truck, RotateCcw, 
  Archive, Calendar, Star, Activity, Box,
  Award, ListChecks, ArrowUpRight, LayoutDashboard,
  Target, ClipboardList, RotateCw, PackageCheck,
  Coins, ShieldCheck, Layers, TrendingUp, Wallet
} from 'lucide-react';
import { 
  XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer, AreaChart, Area
} from 'recharts';

interface DashboardProps {
  tenantId: string;
  shopName: string;
}

export const Dashboard: React.FC<DashboardProps> = ({ tenantId, shopName }) => {
  
  
  
  
  const [loading, setLoading] = useState(true);

  const [preset, setPreset] = useState<'TODAY' | 'WEEK' | 'MONTH' | 'YEAR' | 'ALL'>('MONTH');
  const [startDate, setStartDate] = useState('2020-01-01');
  const [endDate, setEndDate] = useState(getSLDateString());

  const applyPreset = useCallback((p: 'TODAY' | 'WEEK' | 'MONTH' | 'YEAR' | 'ALL') => {
    setPreset(p);
    const d = new Date();
    if (p === 'TODAY') {
        // Just use current SL date
    } else if (p === 'WEEK') d.setDate(d.getDate() - 7);
    else if (p === 'MONTH') d.setMonth(d.getMonth() - 1);
    else if (p === 'YEAR') d.setFullYear(d.getFullYear() - 1);
    
    setStartDate(p === 'ALL' ? '2020-01-01' : getSLDateString(d));
    setEndDate(getSLDateString(new Date()));
  }, []);

  useEffect(() => { applyPreset('MONTH'); }, [applyPreset]);


  const [dashboardData, setDashboardData] = useState({
    globalStats: null,
    today: { todayOrders: 0, todayRevenue: 0, todayShippedCount: 0, todayReturnsCount: 0, todayDeliveredCount: 0 },
    inventory: { totalCount: 0, costValue: 0, retailValue: 0 },
    trends: [],
    products: [],
    teamLeaderboard: [], manifest: [], scannedReturnManifest: []
  });

  const fetchData = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    try {
      const fetchedStats = await db.getDashboardStats({ tenantId, startDate, endDate });
      if (fetchedStats) {
          const pStats = fetchedStats.productStats || {};
          const tStats = fetchedStats.teamStats || {};
          const dMap = fetchedStats.dailyMap || {};
          
          const trends = Object.values(dMap);
          const products = Object.values(pStats).map((p: any) => ({
              ...p,
              profit: p.revenue - (p.delivered * (p.buyingPrice || 0)) // simplistic profit
          })).sort((a: any, b: any) => b.salesCount - a.salesCount);
          
          const teamLeaderboard = Object.values(tStats).sort((a: any, b: any) => b.interactions - a.interactions);
          
          setDashboardData({ manifest: [], scannedReturnManifest: [],
              globalStats: fetchedStats.stats,
              today: {
                  todayOrders: fetchedStats.todayOrders || 0,
                  todayRevenue: fetchedStats.todayRevenue || 0,
                  todayShippedCount: fetchedStats.todayShippedCount || 0,
                  todayReturnsCount: fetchedStats.todayReturnsCount || 0,
                  todayDeliveredCount: fetchedStats.todayDeliveredCount || 0
              },
              inventory: fetchedStats.inventory || { totalCount: 0, costValue: 0, retailValue: 0 },
              trends,
              products,
              teamLeaderboard
          });
      }
    } finally { setLoading(false); }
  }, [tenantId, startDate, endDate]);

  useEffect(() => { fetchData(); }, [fetchData]);


  if (!dashboardData.globalStats) return <div className='p-10 flex justify-center items-center h-full'><Loader2 className='animate-spin text-blue-500' size={40}/></div>;
  const statsCards = [
    { label: 'Delivered', count: dashboardData.globalStats.deliveredCount, value: dashboardData.globalStats.deliveredValue, sub: 'Orders Settled', icon: <PackageCheck/>, col: 'bg-emerald-50 text-emerald-600', trend: 'Value Realized' },
    { label: 'Confirmed', count: dashboardData.globalStats.confirmedCount, value: dashboardData.globalStats.confirmedValue, sub: 'In Pipeline', icon: <ShieldCheck/>, col: 'bg-blue-50 text-blue-600', trend: 'Value Committed' },
    { label: 'Shipped', count: dashboardData.globalStats.shippedCount, value: dashboardData.globalStats.shippedValue, sub: 'Dispatched', icon: <Truck/>, col: 'bg-indigo-50 text-indigo-600', trend: 'Value in Transit' },
    { label: 'Returned', count: dashboardData.globalStats.returnedCount, value: dashboardData.globalStats.returnedValue, sub: 'Failed Leads', icon: <RotateCcw/>, col: 'bg-rose-50 text-rose-600', trend: 'Value Lost' },
    { label: 'Restocked', count: dashboardData.globalStats.restockCount, value: dashboardData.globalStats.restockValue, sub: 'Back to Stock', icon: <Archive/>, col: 'bg-amber-50 text-amber-600', trend: 'Value Recovered' },
    { label: 'Cashflow', count: dashboardData.globalStats.deliveredCount, value: dashboardData.globalStats.deliveredValue, sub: 'Total Cash Settled', icon: <Coins/>, col: 'bg-slate-950 text-white', trend: 'Master Balance' },
  ];

  return (
    <div className="space-y-6 animate-slide-in max-w-[1600px] mx-auto pb-20 px-2">
      <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-wrap items-center justify-between gap-6">
        <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-600 text-white rounded-2xl shadow-lg"><LayoutDashboard size={20} /></div>
            <div>
                <h2 className="text-xl font-black uppercase text-slate-900 leading-none">{shopName} Intelligence</h2>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Milky Way Data Terminal</p>
            </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
            <div className="flex p-1 bg-slate-100 rounded-2xl border border-slate-200">
                {(['TODAY', 'WEEK', 'MONTH', 'YEAR', 'ALL'] as const).map(p => (
                    <button key={p} onClick={() => applyPreset(p)} className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all ${preset === p ? 'bg-blue-600 text-white shadow-xl' : 'text-slate-500 hover:text-slate-900'}`}>{p}</button>
                ))}
            </div>
            <div className="flex items-center gap-2 bg-slate-50 px-4 py-2.5 rounded-xl border border-slate-100">
                <Calendar size={14} className="text-blue-600" />
                <input type="date" value={startDate} onChange={e => { setStartDate(e.target.value); setPreset('MONTH' as any); }} className="text-[10px] font-bold outline-none bg-transparent" />
                <span className="text-[10px] font-black text-slate-300 mx-1">TO</span>
                <input type="date" value={endDate} onChange={e => { setEndDate(e.target.value); setPreset('MONTH' as any); }} className="text-[10px] font-bold outline-none bg-transparent" />
            </div>
            <button onClick={fetchData} className="p-3 bg-slate-900 text-white rounded-xl hover:bg-black transition-all shadow-lg active:scale-95">
                <RefreshCcw size={16} className={loading ? 'animate-spin' : ''} />
            </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {statsCards.map((s, i) => (
            <div key={i} className="p-6 rounded-[2.5rem] border border-slate-100 shadow-sm bg-white hover:border-blue-200 transition-all group relative overflow-hidden flex flex-col justify-between min-h-[160px]">
                <div className="absolute top-0 right-0 w-24 h-24 bg-slate-50 rounded-full -translate-y-1/2 translate-x-1/2 opacity-50 group-hover:bg-blue-50 transition-colors"></div>
                <div>
                    <div className={`w-10 h-10 ${s.col} rounded-xl flex items-center justify-center mb-4 shadow-sm group-hover:scale-110 transition-transform relative z-10`}>
                      {React.cloneElement(s.icon as any, { size: 18 })}
                    </div>
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 relative z-10">{s.label}</p>
                    <p className="text-4xl font-black text-slate-900 tracking-tighter relative z-10">{formatFullNumber(s.count, 0)}</p>
                </div>
                <div className="relative z-10 mt-2">
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-tight">{formatCurrency(s.value)}</p>
                    <p className="text-[8px] font-bold text-blue-600 uppercase mt-0.5 tracking-widest">{s.sub}</p>
                </div>
            </div>
          ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-slate-900 text-white p-8 rounded-[2.5rem] shadow-2xl relative overflow-hidden border border-white/5 group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-blue-600/20 blur-[60px] -translate-y-1/2 translate-x-1/2"></div>
              <div className="relative z-10">
                  <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center mb-6">
                      <Layers size={24} className="text-blue-400" />
                  </div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">Total Remaining Stock</p>
                  <h3 className="text-5xl font-black tracking-tighter text-white">{formatFullNumber(dashboardData.inventory.count, 0)}</h3>
                  <p className="text-[10px] font-bold text-blue-400 uppercase mt-2 tracking-widest">Units Available</p>
              </div>
          </div>

          <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm relative overflow-hidden group hover:border-blue-200 transition-all">
              <div className="relative z-10">
                  <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mb-6">
                      <TrendingUp size={24} />
                  </div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">Potential Retail Value</p>
                  <h3 className="text-4xl font-black tracking-tighter text-slate-900">{formatCurrency(dashboardData.inventory.retail)}</h3>
                  <p className="text-[10px] font-bold text-emerald-600 uppercase mt-2 tracking-widest">Projected Revenue</p>
              </div>
          </div>

          <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm relative overflow-hidden group hover:border-blue-200 transition-all">
              <div className="relative z-10">
                  <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mb-6">
                      <Wallet size={24} />
                  </div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">Inventory Asset Value</p>
                  <h3 className="text-4xl font-black tracking-tighter text-slate-900">{formatCurrency(dashboardData.inventory.cost)}</h3>
                  <p className="text-[10px] font-bold text-indigo-600 uppercase mt-2 tracking-widest">Capital Invested</p>
              </div>
          </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 bg-white p-8 rounded-[3rem] border border-slate-100 shadow-sm flex flex-col">
            <h3 className="text-xs font-black uppercase tracking-widest flex items-center gap-3 mb-6">
                <ClipboardList size={18} className="text-blue-600"/> Dispatch Manifest Registry
            </h3>
            <div className="flex-1 space-y-3 overflow-y-auto no-scrollbar max-h-[400px]">
                {dashboardData.manifest.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center py-10 opacity-30 text-center">
                    <Box size={40} className="mb-3" />
                    <p className="text-[10px] font-black uppercase tracking-widest">No Logged Dispatches</p>
                  </div>
                ) : (
                  dashboardData.manifest.map(([name, count], i) => (
                    <div key={i} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100 group hover:bg-blue-50 transition-all">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-white border border-slate-200 rounded-lg flex items-center justify-center text-[10px] font-black text-slate-900 group-hover:border-blue-200">{i+1}</div>
                        <span className="text-[11px] font-black text-slate-900 uppercase tracking-tight truncate max-w-[150px]">{name}</span>
                      </div>
                      <span className="bg-blue-600 text-white px-3 py-1 rounded-full text-[10px] font-black">×{formatFullNumber(count)}</span>
                    </div>
                  ))
                )}
            </div>
        </div>

        <div className="lg:col-span-4 bg-white p-8 rounded-[3rem] border border-slate-100 shadow-sm flex flex-col border-t-rose-600 border-t-4">
            <h3 className="text-xs font-black uppercase tracking-widest flex items-center gap-3 mb-6">
                <RotateCcw size={18} className="text-rose-600"/> Returned Stock Intelligence
            </h3>
            <div className="flex-1 space-y-3 overflow-y-auto no-scrollbar max-h-[400px]">
                {dashboardData.scannedReturnManifest.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center py-10 opacity-30 text-center">
                    <RotateCw size={40} className="mb-3" />
                    <p className="text-[10px] font-black uppercase tracking-widest">No Scanned Parcel Returns</p>
                  </div>
                ) : (
                  dashboardData.scannedReturnManifest.map(([name, data]: any, i) => (
                    <div key={i} className="flex items-center justify-between p-4 bg-rose-50/50 rounded-2xl border border-rose-100 group hover:bg-rose-50 transition-all">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-white border border-rose-200 rounded-lg flex items-center justify-center text-[10px] font-black text-rose-600 group-hover:border-rose-400">{i+1}</div>
                        <div className="flex flex-col">
                            <span className="text-[11px] font-black text-slate-900 uppercase tracking-tight truncate max-w-[150px]">{name}</span>
                            <span className="text-[8px] font-mono text-rose-500 font-bold uppercase">{data.sku}</span>
                        </div>
                      </div>
                      <span className="bg-rose-600 text-white px-3 py-1 rounded-full text-[10px] font-black shadow-lg shadow-rose-200">×{formatFullNumber(data.count)}</span>
                    </div>
                  ))
                )}
            </div>
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-[0.2em] mt-4 text-center">Data filtered by terminal scan status</p>
        </div>

        <div className="lg:col-span-4 bg-slate-950 text-white p-8 rounded-[3rem] shadow-2xl relative overflow-hidden flex flex-col min-h-[400px]">
            <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600/10 blur-[100px] -translate-y-1/2 translate-x-1/2"></div>
            <h3 className="text-xs font-black uppercase tracking-widest flex items-center gap-3 mb-8 relative z-10">
                <Target size={18} className="text-blue-400"/> Operational Velocity
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 relative z-10">
              {[
                  { label: "Today's Inbound", val: formatFullNumber(dashboardData.today.todayOrders, 0), icon: <Target className="text-blue-400" /> },
                  { label: "Today's Dispatch", val: formatFullNumber(dashboardData.today.todayShippedCount, 0), icon: <Truck className="text-amber-400" /> },
                  { label: "Today's Delivered", val: formatFullNumber(dashboardData.today.todayDeliveredCount, 0), icon: <PackageCheck className="text-emerald-400" /> },
                  { label: "Today's Revenue", val: formatCurrency(dashboardData.today.todayRevenue), icon: <DollarSign className="text-emerald-400" /> },
                  { label: "Today's Returns", val: formatFullNumber(dashboardData.today.todayReturnsCount, 0), icon: <RotateCcw className="text-rose-400" /> },
              ].map((stat, i) => (
                  <div key={i} className={`bg-white/5 border border-white/10 p-5 rounded-[2rem] hover:bg-white/10 transition-all group ${i >= 3 ? 'md:col-span-1.5' : ''}`}>
                      <div className="flex items-center gap-3 mb-2">
                          {React.cloneElement(stat.icon as any, { size: 14 })}
                          <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">{stat.label}</p>
                      </div>
                      <p className="text-lg font-black text-white truncate group-hover:text-blue-400 transition-colors">{stat.val}</p>
                  </div>
              ))}
            </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 bg-white p-8 rounded-[3.5rem] border border-slate-100 shadow-sm">
            <h3 className="text-xs font-black uppercase tracking-widest flex items-center gap-3 mb-8">
                <Activity size={18} className="text-blue-600"/> Financial & Logistic Trends
            </h3>
            <div className="h-[350px]">
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={dashboardData.trends}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 700, fill: '#94a3b8'}} dy={10} />
                        <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 700, fill: '#94a3b8'}} />
                        <Tooltip formatter={(v: any) => formatFullNumber(v)} />
                        <Area type="monotone" dataKey="sales" stroke="#10b981" strokeWidth={3} fill="#10b981" fillOpacity={0.05} name="Revenue" />
                        <Area type="monotone" dataKey="shipped" stroke="#3b82f6" strokeWidth={3} fill="#3b82f6" fillOpacity={0.05} name="Dispatch" />
                    </AreaChart>
                </ResponsiveContainer>
            </div>
        </div>

        <div className="lg:col-span-4 bg-slate-950 text-white p-8 rounded-[3.5rem] shadow-2xl relative overflow-hidden flex flex-col">
            <h3 className="text-xs font-black uppercase tracking-widest flex items-center gap-3 mb-8">
                <Award size={18} className="text-blue-400"/> Staff Performance Matrix
            </h3>
            <div className="space-y-4 overflow-y-auto no-scrollbar flex-1">
                {dashboardData.teamLeaderboard.map((user, i) => (
                    <div key={i} className="p-5 bg-white/5 rounded-[2.5rem] border border-white/10 flex flex-col gap-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-xs font-black">{user.name.slice(0, 2).toUpperCase()}</div>
                                <div>
                                    <p className="text-xs font-black uppercase leading-none">{user.name}</p>
                                    <p className="text-[8px] font-black text-slate-500 uppercase mt-1">{formatFullNumber(user.interactions)} Interacts</p>
                                </div>
                            </div>
                            <div className="text-right">
                                <p className="text-sm font-black text-emerald-400">+{formatFullNumber(user.confirms)}</p>
                                <p className="text-[8px] font-black text-slate-500 uppercase">Confirmed</p>
                            </div>
                        </div>
                        <div className="grid grid-cols-3 gap-2 pt-2 border-t border-white/5">
                            <div className="text-center">
                                <p className="text-[8px] font-black text-rose-500 uppercase mb-1">Rejects</p>
                                <p className="text-xs font-black text-white">{formatFullNumber(user.rejects)}</p>
                            </div>
                            <div className="text-center">
                                <p className="text-[8px] font-black text-amber-500 uppercase mb-1">No Ans</p>
                                <p className="text-xs font-black text-white">{formatFullNumber(user.noAnswers)}</p>
                            </div>
                            <div className="text-center">
                                <p className="text-[8px] font-black text-blue-400 uppercase mb-1">Open</p>
                                <p className="text-xs font-black text-white">{formatFullNumber(user.openLeads)}</p>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2 pt-2 border-t border-white/5">
                            <div className="text-center bg-emerald-500/10 rounded-xl p-2 border border-emerald-500/20">
                                <p className="text-[8px] font-black text-emerald-500 uppercase mb-1">Resched. DLV</p>
                                <p className="text-xs font-black text-emerald-400">{formatFullNumber(user.rescheduledDelivered)}</p>
                            </div>
                            <div className="text-center bg-rose-500/10 rounded-xl p-2 border border-rose-500/20">
                                <p className="text-[8px] font-black text-rose-500 uppercase mb-1">Resched. RTN</p>
                                <p className="text-xs font-black text-rose-400">{formatFullNumber(user.rescheduledReturned)}</p>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>

        <div className="lg:col-span-12 bg-white p-10 rounded-[4rem] border border-slate-100 shadow-sm">
            <h3 className="text-lg font-black uppercase tracking-tighter mb-10 flex items-center gap-4">
                <ListChecks size={24} className="text-emerald-500"/> Product Performance Summary
            </h3>
            <div className="overflow-x-auto no-scrollbar">
                {dashboardData.products.length === 0 ? (
                  <div className="py-20 text-center flex flex-col items-center opacity-20">
                    <Box size={60} className="mb-4" />
                    <p className="text-[12px] font-black uppercase tracking-[0.4em]">No Products in Catalog</p>
                  </div>
                ) : (
                  <table className="w-full text-left compact-table">
                    <thead>
                        <tr className="bg-slate-50/50">
                            <th className="rounded-l-3xl">Product SKU</th>
                            <th className="text-center">Total Leads</th>
                            <th className="text-center">Confirmed</th>
                            <th className="text-center">Delivered</th>
                            <th className="text-center">Restocked (Qty)</th>
                            <th className="text-center">Upcoming Returns</th>
                            <th className="text-right rounded-r-3xl pr-10">Net Profit (Est.)</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                        {dashboardData.products.map((p, i) => (
                            <tr key={i} className="hover:bg-slate-50/80 transition-all">
                                <td className="py-6">
                                    <div className="flex flex-col">
                                        <span className="text-sm font-black text-slate-900 uppercase tracking-tight">{p.name}</span>
                                        <span className="text-[9px] font-mono font-bold text-blue-500 mt-1">ID: {p.sku}</span>
                                    </div>
                                </td>
                                <td className="text-center"><span className="text-xs font-black text-slate-900 bg-slate-100 px-3 py-1.5 rounded-lg">{formatFullNumber(p.salesCount)}</span></td>
                                <td className="text-center"><span className="text-xs font-black text-blue-600 bg-blue-50 px-3 py-1.5 rounded-lg">{formatFullNumber(p.confirmed)}</span></td>
                                <td className="text-center"><span className="text-xs font-black text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-lg">{formatFullNumber(p.delivered)}</span></td>
                                <td className="text-center"><span className="text-xs font-black text-rose-600 bg-rose-50 px-3 py-1.5 rounded-lg">{formatFullNumber(p.returned)}</span></td>
                                <td className="text-center"><span className="text-xs font-black text-amber-600 bg-amber-50 px-3 py-1.5 rounded-lg">{formatFullNumber(p.upcomingReturn)}</span></td>
                                <td className="text-right pr-10">
                                    <div className="flex flex-col items-end">
                                        <span className="text-sm font-black text-slate-950">{formatCurrency(p.profit)}</span>
                                        <div className={`flex items-center gap-1 text-[8px] font-black uppercase mt-1 ${p.profit > 0 ? 'text-emerald-500' : 'text-slate-400'}`}>
                                            <ArrowUpRight size={10}/> Margin Status
                                        </div>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                  </table>
                )}
            </div>
        </div>
      </div>
    </div>
  );
};
