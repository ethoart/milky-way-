import React, { useEffect, useState, useMemo } from 'react';
import { Order, OrderStatus, Product, User } from '../types';
import { db } from '../services/mockBackend';
import { formatCurrency } from '../utils/helpers';
import { 
  RefreshCcw, DollarSign, Truck, CheckCircle, RotateCcw, 
  Archive, ListFilter, Users, Calendar, TrendingUp, BarChart3 
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

  // Advanced Filtering
  const [filterType, setFilterType] = useState<'TODAY' | 'WEEK' | 'MONTH' | 'YEAR' | 'CUSTOM'>('TODAY');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);

  const fetchData = async () => {
    setLoading(true);
    const [fetchedOrders, fetchedProducts, fetchedTeam] = await Promise.all([
        db.getOrders(tenantId),
        db.getProducts(tenantId),
        db.getTeamMembers(tenantId)
    ]);
    setOrders(fetchedOrders);
    setProducts(fetchedProducts);
    setTeam(fetchedTeam);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [tenantId]);

  const handlePreset = (type: 'TODAY' | 'WEEK' | 'MONTH' | 'YEAR') => {
    setFilterType(type);
    const now = new Date();
    let start = new Date();
    if (type === 'TODAY') start = new Date(now.setHours(0, 0, 0, 0));
    if (type === 'WEEK') start.setDate(now.getDate() - 7);
    if (type === 'MONTH') start.setMonth(now.getMonth() - 1);
    if (type === 'YEAR') start.setFullYear(now.getFullYear() - 1);
    setStartDate(start.toISOString().split('T')[0]);
    setEndDate(new Date().toISOString().split('T')[0]);
  };

  const dashboardData = useMemo(() => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59);

    const filteredOrders = orders.filter(o => {
        const d = new Date(o.createdAt);
        return d >= start && d <= end;
    });

    // 1. Core Stats
    const deliveredCount = filteredOrders.filter(o => o.status === OrderStatus.DELIVERED).length;
    const returnCount = filteredOrders.filter(o => o.status === OrderStatus.RETURNED).length;
    const restockedCount = filteredOrders.filter(o => o.status === OrderStatus.RETURN_COMPLETED).length;
    const confirmedCount = filteredOrders.filter(o => o.status === OrderStatus.CONFIRMED).length;
    const shippedCount = filteredOrders.filter(o => o.shippedAt && new Date(o.shippedAt) >= start && new Date(o.shippedAt) <= end).length;
    const totalSettle = filteredOrders.filter(o => o.status === OrderStatus.DELIVERED).reduce((s, o) => s + o.totalAmount, 0);

    // 2. Product Shipping Manifest
    const productManifest: { [key: string]: { name: string; sku: string; shipCount: number } } = {};
    filteredOrders.filter(o => o.status === OrderStatus.SHIPPED || o.status === OrderStatus.DELIVERY || o.status === OrderStatus.DELIVERED).forEach(o => {
        o.items.forEach(item => {
            if (!productManifest[item.productId]) {
                const p = products.find(prod => prod.id === item.productId);
                productManifest[item.productId] = { name: item.name, sku: p?.sku || 'N/A', shipCount: 0 };
            }
            productManifest[item.productId].shipCount += item.quantity;
        });
    });

    // 3. User Performance Grid
    const userStats: { [key: string]: { name: string; confirmed: number; rejected: number; opened: number } } = {};
    team.forEach(u => userStats[u.username] = { name: u.username, confirmed: 0, rejected: 0, opened: 0 });
    
    filteredOrders.forEach(o => {
        const user = o.openedBy || 'System';
        if (!userStats[user]) userStats[user] = { name: user, confirmed: 0, rejected: 0, opened: 0 };
        if (o.status === OrderStatus.CONFIRMED) userStats[user].confirmed++;
        if (o.status === OrderStatus.REJECTED) userStats[user].rejected++;
        if (o.status === OrderStatus.OPEN_LEAD) userStats[user].opened++;
    });

    // 4. Graph Data (Last 14 days)
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

    return {
        counts: { deliveredCount, returnCount, restockedCount, confirmedCount, shippedCount, totalSettle },
        products: Object.values(productManifest).sort((a, b) => b.shipCount - a.shipCount),
        team: Object.values(userStats),
        trends: Object.values(dailyMap)
    };
  }, [orders, products, team, startDate, endDate]);

  const StatBox = ({ label, value, color, icon }: any) => (
    <div className="bg-white border border-slate-100 rounded-[2rem] p-6 shadow-sm flex flex-col items-center justify-center">
        <div className={`p-3 rounded-2xl ${color} mb-3`}>{React.cloneElement(icon, { size: 18 })}</div>
        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{label}</span>
        <span className="text-xl font-black text-slate-900">{value}</span>
    </div>
  );

  return (
    <div className="space-y-6 animate-slide-in max-w-[1400px] mx-auto pb-20">
      {/* Top Filter Bar */}
      <div className="bg-white p-4 rounded-[2rem] border border-slate-100 shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div className="flex gap-2">
            {(['TODAY', 'WEEK', 'MONTH', 'YEAR'] as const).map(p => (
                <button key={p} onClick={() => handlePreset(p)} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${filterType === p ? 'bg-blue-600 text-white shadow-lg' : 'bg-slate-50 text-slate-400 hover:bg-slate-100'}`}>{p}</button>
            ))}
        </div>
        <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-100">
                <Calendar size={14} className="text-slate-400" />
                <input type="date" value={startDate} onChange={e => { setStartDate(e.target.value); setFilterType('CUSTOM'); }} className="text-[10px] font-bold outline-none bg-transparent uppercase" />
                <span className="text-[10px] font-black text-slate-300">TO</span>
                <input type="date" value={endDate} onChange={e => { setEndDate(e.target.value); setFilterType('CUSTOM'); }} className="text-[10px] font-bold outline-none bg-transparent uppercase" />
            </div>
            <button onClick={fetchData} className="p-2.5 bg-slate-900 text-white rounded-xl hover:bg-black transition-all shadow-lg">
                <RefreshCcw size={16} className={loading ? 'animate-spin' : ''} />
            </button>
        </div>
      </div>

      {/* Hero Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <StatBox label="Confirmed" value={dashboardData.counts.confirmedCount} color="bg-blue-50 text-blue-600" icon={<CheckCircle/>} />
          <StatBox label="Shipped" value={dashboardData.counts.shippedCount} color="bg-indigo-50 text-indigo-600" icon={<Truck/>} />
          <StatBox label="Delivered" value={dashboardData.counts.deliveredCount} color="bg-emerald-50 text-emerald-600" icon={<CheckCircle/>} />
          <StatBox label="Returned" value={dashboardData.counts.returnCount} color="bg-orange-50 text-orange-600" icon={<RotateCcw/>} />
          <StatBox label="Restocked" value={dashboardData.counts.restockedCount} color="bg-rose-50 text-rose-600" icon={<Archive/>} />
          <StatBox label="Net Revenue" value={formatCurrency(dashboardData.counts.totalSettle)} color="bg-slate-900 text-white" icon={<DollarSign/>} />
      </div>

      {/* Trends Graph Section */}
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
                        <Tooltip contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}} />
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
                                <stop offset="5%" stopColor="#10b981" stopOpacity={0.1}/>
                                <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 700, fill: '#94a3b8'}} dy={10} />
                        <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 700, fill: '#94a3b8'}} />
                        <Tooltip />
                        <Area type="monotone" dataKey="sales" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorSales)" />
                    </AreaChart>
                </ResponsiveContainer>
            </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Shipping Manifest */}
          <div className="lg:col-span-7 bg-white rounded-[3rem] border border-slate-100 shadow-sm overflow-hidden flex flex-col">
              <div className="p-6 border-b border-slate-50 flex items-center justify-between bg-blue-50/10">
                  <h3 className="text-[11px] font-black uppercase tracking-widest flex items-center gap-2">
                      <ListFilter size={16} className="text-blue-600" /> Shipping Manifest
                  </h3>
              </div>
              <div className="flex-1 overflow-auto max-h-[400px] no-scrollbar">
                  <table className="w-full text-left compact-table">
                      <thead><tr><th>SKU Identity</th><th>Product</th><th className="text-right">Units Shipped</th></tr></thead>
                      <tbody className="divide-y divide-slate-50">
                          {dashboardData.products.map((p, i) => (
                              <tr key={i} className="hover:bg-slate-50">
                                  <td><span className="font-mono text-[10px] font-bold text-blue-600">{p.sku}</span></td>
                                  <td><span className="text-[13px] font-black text-slate-700 uppercase">{p.name}</span></td>
                                  <td className="text-right"><span className="px-3 py-1 bg-slate-900 text-white rounded-lg text-xs font-black">{p.shipCount}</span></td>
                              </tr>
                          ))}
                      </tbody>
                  </table>
              </div>
          </div>

          {/* Team Efficiency */}
          <div className="lg:col-span-5 bg-white rounded-[3rem] border border-slate-100 shadow-sm overflow-hidden flex flex-col">
              <div className="p-6 border-b border-slate-50 flex items-center justify-between bg-indigo-50/10">
                  <h3 className="text-[11px] font-black uppercase tracking-widest flex items-center gap-2">
                      <Users size={16} className="text-indigo-600" /> Team Performance
                  </h3>
              </div>
              <div className="flex-1 overflow-auto max-h-[400px] no-scrollbar">
                  <table className="w-full text-left compact-table">
                      <thead><tr><th>Identity</th><th className="text-center">Confirmed</th><th className="text-center">Rejected</th></tr></thead>
                      <tbody className="divide-y divide-slate-50">
                          {dashboardData.team.map((u, i) => (
                              <tr key={i} className="hover:bg-slate-50">
                                  <td>
                                      <div className="flex flex-col">
                                          <span className="text-[13px] font-black text-slate-900 uppercase leading-none">{u.name}</span>
                                          <span className="text-[8px] font-bold text-slate-400 mt-1 uppercase tracking-tighter">{u.opened} Opened</span>
                                      </div>
                                  </td>
                                  <td className="text-center"><span className="text-emerald-600 font-black">{u.confirmed}</span></td>
                                  <td className="text-center"><span className="text-rose-500 font-black">{u.rejected}</span></td>
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