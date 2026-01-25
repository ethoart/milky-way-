
import React, { useEffect, useState, useMemo } from 'react';
import { Order, OrderStatus, Product, User } from '../types';
import { db } from '../services/mockBackend';
import { formatCurrency } from '../utils/helpers';
import { 
  RefreshCcw, DollarSign, Truck, CheckCircle, RotateCcw, 
  Archive, ListFilter, Users, Calendar, TrendingUp, BarChart3,
  PhoneOff, Pause, ShoppingBag
} from 'lucide-react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer, AreaChart, Area 
} from 'recharts';

interface DashboardProps {
  tenantId: string;
}

export const Dashboard: React.FC<DashboardProps> = ({ tenantId }) => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [team, setTeam] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  // Time-Window Filters
  const [preset, setPreset] = useState<'TODAY' | 'WEEK' | 'MONTH' | 'YEAR' | 'CUSTOM'>('TODAY');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [fetchedOrders, fetchedProducts, fetchedTeam] = await Promise.all([
          db.getOrders(tenantId),
          db.getProducts(tenantId),
          db.getTeamMembers(tenantId)
      ]);
      setOrders(fetchedOrders);
      setProducts(fetchedProducts);
      setTeam(fetchedTeam);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [tenantId]);

  const handlePreset = (type: 'TODAY' | 'WEEK' | 'MONTH' | 'YEAR') => {
    setPreset(type);
    const now = new Date();
    let start = new Date();
    if (type === 'TODAY') start.setHours(0, 0, 0, 0);
    if (type === 'WEEK') start.setDate(now.getDate() - 7);
    if (type === 'MONTH') start.setMonth(now.getMonth() - 1);
    if (type === 'YEAR') start.setFullYear(now.getFullYear() - 1);
    setStartDate(start.toISOString().split('T')[0]);
    setEndDate(new Date().toISOString().split('T')[0]);
  };

  const dashboardData = useMemo(() => {
    const sDate = new Date(startDate);
    const eDate = new Date(endDate);
    eDate.setHours(23, 59, 59, 999);

    const filteredOrders = orders.filter(o => {
        const d = new Date(o.createdAt);
        return d >= sDate && d <= eDate;
    });

    // Stats Grid
    const deliveredCount = filteredOrders.filter(o => o.status === OrderStatus.DELIVERED).length;
    const returnedCount = filteredOrders.filter(o => o.status === OrderStatus.RETURNED).length;
    const restockedCount = filteredOrders.filter(o => o.status === OrderStatus.RETURN_COMPLETED).length;
    const confirmedCount = filteredOrders.filter(o => o.status === OrderStatus.CONFIRMED).length;
    const shippedCount = filteredOrders.filter(o => o.shippedAt && new Date(o.shippedAt) >= sDate && new Date(o.shippedAt) <= eDate).length;
    const totalRevenue = filteredOrders.filter(o => o.status === OrderStatus.DELIVERED).reduce((s, o) => s + o.totalAmount, 0);

    // Team Efficiency (User-wise)
    const teamStats: { [key: string]: { name: string; confirmed: number; rejected: number; opened: number; hold: number; noAnswer: number } } = {};
    team.forEach(u => teamStats[u.username] = { name: u.username, confirmed: 0, rejected: 0, opened: 0, hold: 0, noAnswer: 0 });
    
    filteredOrders.forEach(o => {
        const u = o.openedBy || 'System';
        if (!teamStats[u]) teamStats[u] = { name: u, confirmed: 0, rejected: 0, opened: 0, hold: 0, noAnswer: 0 };
        
        // Logical aggregation for 'Confirmed': Anything that reached confirmed or beyond
        if ([OrderStatus.CONFIRMED, OrderStatus.SHIPPED, OrderStatus.DELIVERY, OrderStatus.DELIVERED].includes(o.status)) {
            teamStats[u].confirmed++;
        }
        
        if ([OrderStatus.REJECTED, OrderStatus.RETURNED, OrderStatus.RETURN_COMPLETED].includes(o.status)) {
            teamStats[u].rejected++;
        }
        
        if (o.status === OrderStatus.OPEN_LEAD) teamStats[u].opened++;
        if (o.status === OrderStatus.HOLD) teamStats[u].hold++;
        if (o.status === OrderStatus.NO_ANSWER) teamStats[u].noAnswer++;
    });

    // Trends Data
    const dailyMap: { [key: string]: { date: string; shipped: number; sales: number } } = {};
    for (let i = 13; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const key = d.toISOString().split('T')[0];
        dailyMap[key] = { date: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), shipped: 0, sales: 0 };
    }
    orders.forEach(o => {
        const shipKey = o.shippedAt ? o.shippedAt.split('T')[0] : null;
        if (shipKey && dailyMap[shipKey]) dailyMap[shipKey].shipped++;
        const createKey = o.createdAt.split('T')[0];
        if (o.status === OrderStatus.DELIVERED && dailyMap[createKey]) {
            dailyMap[createKey].sales += o.totalAmount;
        }
    });

    // Product Tally
    const productTally: { [key: string]: { name: string; sku: string; shipCount: number } } = {};
    filteredOrders.forEach(o => {
        if (o.shippedAt) {
            o.items.forEach(item => {
                if (!productTally[item.productId]) {
                    const p = products.find(prod => prod.id === item.productId);
                    productTally[item.productId] = { name: item.name, sku: p?.sku || 'N/A', shipCount: 0 };
                }
                productTally[item.productId].shipCount += item.quantity;
            });
        }
    });

    return {
        stats: { deliveredCount, returnedCount, restockedCount, confirmedCount, shippedCount, totalRevenue },
        products: Object.values(productTally).sort((a, b) => b.shipCount - a.shipCount),
        team: Object.values(teamStats),
        trends: Object.values(dailyMap)
    };
  }, [orders, products, team, startDate, endDate]);

  const BigStat = ({ label, value, color, icon }: any) => (
    <div className="bg-white border border-slate-100 rounded-[2rem] p-6 shadow-sm flex flex-col items-center justify-center text-center">
        <div className={`p-3 rounded-2xl ${color} mb-3`}>{React.cloneElement(icon, { size: 18 })}</div>
        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{label}</span>
        <span className="text-xl font-black text-slate-900">{value}</span>
    </div>
  );

  return (
    <div className="space-y-6 animate-slide-in max-w-[1400px] mx-auto pb-20">
      <div className="bg-white p-4 rounded-[2rem] border border-slate-100 shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div className="flex gap-2">
            {(['TODAY', 'WEEK', 'MONTH', 'YEAR'] as const).map(p => (
                <button key={p} onClick={() => handlePreset(p)} className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${preset === p ? 'bg-blue-600 text-white shadow-lg' : 'bg-slate-50 text-slate-400 hover:bg-slate-100'}`}>{p}</button>
            ))}
        </div>
        <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-slate-50 px-4 py-2 rounded-xl border border-slate-100">
                <Calendar size={14} className="text-slate-400" />
                <input type="date" value={startDate} onChange={e => { setStartDate(e.target.value); setPreset('CUSTOM'); }} className="text-[10px] font-bold outline-none bg-transparent uppercase" />
                <span className="text-[10px] font-black text-slate-300 mx-1">TO</span>
                <input type="date" value={endDate} onChange={e => { setEndDate(e.target.value); setPreset('CUSTOM'); }} className="text-[10px] font-bold outline-none bg-transparent uppercase" />
            </div>
            <button onClick={fetchData} className="p-2.5 bg-slate-900 text-white rounded-xl hover:bg-black transition-all shadow-lg">
                <RefreshCcw size={16} className={loading ? 'animate-spin' : ''} />
            </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <BigStat label="Confirmed" value={dashboardData.stats.confirmedCount} color="bg-blue-50 text-blue-600" icon={<CheckCircle/>} />
          <BigStat label="Shipped" value={dashboardData.stats.shippedCount} color="bg-indigo-50 text-indigo-600" icon={<Truck/>} />
          <BigStat label="Delivered" value={dashboardData.stats.deliveredCount} color="bg-emerald-50 text-emerald-600" icon={<CheckCircle/>} />
          <BigStat label="Returned" value={dashboardData.stats.returnedCount} color="bg-orange-50 text-orange-600" icon={<RotateCcw/>} />
          <BigStat label="Restocked" value={dashboardData.stats.restockedCount} color="bg-rose-50 text-rose-600" icon={<Archive/>} />
          <BigStat label="Settlement" value={formatCurrency(dashboardData.stats.totalRevenue)} color="bg-slate-900 text-white" icon={<DollarSign/>} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-sm">
              <div className="flex items-center gap-3 mb-8">
                  <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg"><BarChart3 size={18}/></div>
                  <h3 className="text-sm font-black uppercase tracking-widest text-slate-900">Shipment Pulse</h3>
              </div>
              <div className="h-[250px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={dashboardData.trends}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                          <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 700, fill: '#94a3b8'}} dy={10} />
                          <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 700, fill: '#94a3b8'}} />
                          <Tooltip cursor={{stroke: '#4f46e5'}} contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}} />
                          <Line type="monotone" dataKey="shipped" stroke="#4f46e5" strokeWidth={3} dot={{r: 4, fill: '#4f46e5', strokeWidth: 2, stroke: '#fff'}} activeDot={{r: 6}} />
                      </LineChart>
                  </ResponsiveContainer>
              </div>
          </div>
          <div className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-sm">
              <div className="flex items-center gap-3 mb-8">
                  <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg"><TrendingUp size={18}/></div>
                  <h3 className="text-sm font-black uppercase tracking-widest text-slate-900">Sales Velocity</h3>
              </div>
              <div className="h-[250px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={dashboardData.trends}>
                          <defs>
                              <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.15}/>
                                  <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                              </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                          <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 700, fill: '#94a3b8'}} dy={10} />
                          <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 700, fill: '#94a3b8'}} />
                          <Tooltip cursor={{stroke: '#10b981'}} />
                          <Area type="monotone" dataKey="sales" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorSales)" />
                      </AreaChart>
                  </ResponsiveContainer>
              </div>
          </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-6 bg-white rounded-[3rem] border border-slate-100 shadow-sm overflow-hidden flex flex-col">
              <div className="p-6 border-b border-slate-50 flex items-center justify-between bg-blue-50/10">
                  <h3 className="text-[11px] font-black uppercase tracking-widest flex items-center gap-2">
                      <ListFilter size={16} className="text-blue-600" /> Dispatch Manifest
                  </h3>
              </div>
              <div className="flex-1 overflow-auto max-h-[400px] no-scrollbar">
                  <table className="w-full text-left compact-table">
                      <thead><tr><th>SKU Identifier</th><th>Product Name</th><th className="text-right">Units Shipped</th></tr></thead>
                      <tbody className="divide-y divide-slate-50">
                          {dashboardData.products.map((p, i) => (
                              <tr key={i} className="hover:bg-slate-50">
                                  <td><span className="font-mono text-[10px] font-bold text-blue-600">{p.sku}</span></td>
                                  <td><span className="text-[13px] font-black text-slate-700 uppercase">{p.name}</span></td>
                                  <td className="text-right"><span className="px-4 py-1.5 bg-slate-900 text-white rounded-xl text-xs font-black">{p.shipCount}</span></td>
                              </tr>
                          ))}
                      </tbody>
                  </table>
              </div>
          </div>

          <div className="lg:col-span-6 bg-white rounded-[3rem] border border-slate-100 shadow-sm overflow-hidden flex flex-col">
              <div className="p-6 border-b border-slate-50 flex items-center justify-between bg-indigo-50/10">
                  <h3 className="text-[11px] font-black uppercase tracking-widest flex items-center gap-2">
                      <Users size={16} className="text-indigo-600" /> Team Efficiency
                  </h3>
              </div>
              <div className="flex-1 overflow-auto max-h-[400px] no-scrollbar">
                  <table className="w-full text-left compact-table">
                      <thead>
                        <tr>
                          <th>Staff Identity</th>
                          <th className="text-center"><span className="flex items-center justify-center gap-1"><ShoppingBag size={10}/> Leads</span></th>
                          <th className="text-center"><span className="flex items-center justify-center gap-1"><PhoneOff size={10}/> N/A</span></th>
                          <th className="text-center"><span className="flex items-center justify-center gap-1"><Archive size={10}/> Rej</span></th>
                          <th className="text-center"><span className="flex items-center justify-center gap-1"><Pause size={10}/> Hold</span></th>
                          <th className="text-center"><span className="flex items-center justify-center gap-1"><CheckCircle size={10}/> Conf</span></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                          {dashboardData.team.map((u, i) => (
                              <tr key={i} className="hover:bg-slate-50">
                                  <td>
                                      <div className="flex flex-col">
                                          <span className="text-[13px] font-black text-slate-900 uppercase leading-none">{u.name}</span>
                                          <span className="text-[8px] font-bold text-slate-400 mt-1 uppercase tracking-tighter">Cluster Node Active</span>
                                      </div>
                                  </td>
                                  <td className="text-center font-bold text-slate-600">{u.opened}</td>
                                  <td className="text-center font-bold text-slate-500">{u.noAnswer}</td>
                                  <td className="text-center font-bold text-rose-500">{u.rejected}</td>
                                  <td className="text-center font-bold text-amber-500">{u.hold}</td>
                                  <td className="text-center font-bold text-emerald-600">{u.confirmed}</td>
                              </tr>
                          ))}
                      </tbody>
                  </table>
              </div>
          </div>
      </div>
    </div>
  );
};
