
import React, { useEffect, useState, useMemo } from 'react';
import { Order, OrderStatus, Product, User } from '../types';
import { db } from '../services/mockBackend';
import { formatCurrency } from '../utils/helpers';
import { 
  RefreshCcw, DollarSign, Truck, CheckCircle, RotateCcw, 
  Archive, ListFilter, Users, Calendar, TrendingUp, BarChart3,
  PhoneOff, ShoppingBag, PhoneForwarded, Target
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

  // Helper to get local YYYY-MM-DD string
  const getLocalIsoDate = (date: Date = new Date()) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const [preset, setPreset] = useState<'TODAY' | 'WEEK' | 'MONTH' | 'YEAR' | 'CUSTOM'>('TODAY');
  const [startDate, setStartDate] = useState(getLocalIsoDate());
  const [endDate, setEndDate] = useState(getLocalIsoDate());

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
    
    if (type === 'TODAY') {
      // stays as now
    } else if (type === 'WEEK') {
      start.setDate(now.getDate() - 7);
    } else if (type === 'MONTH') {
      start.setMonth(now.getMonth() - 1);
    } else if (type === 'YEAR') {
      start.setFullYear(now.getFullYear() - 1);
    }
    
    setStartDate(getLocalIsoDate(start));
    setEndDate(getLocalIsoDate(now));
  };

  const dashboardData = useMemo(() => {
    const sDateStr = startDate;
    const eDateStr = endDate;

    // Initialize metrics
    let deliveredCount = 0;
    let returnedCount = 0;
    let restockedCount = 0;
    let confirmedCount = 0;
    let shippedCount = 0;
    let totalRevenue = 0;

    const teamStats: { [key: string]: { name: string; confirmed: number; rejected: number; opened: number; hold: number; noAnswer: number; residual: number } } = {};
    team.forEach(u => teamStats[u.username] = { name: u.username, confirmed: 0, rejected: 0, opened: 0, hold: 0, noAnswer: 0, residual: 0 });

    const shippedProductTally: { [key: string]: { name: string; sku: string; count: number } } = {};
    const confirmedProductTally: { [key: string]: { name: string; sku: string; count: number } } = {};

    // For Pulse Charts (Last 14 days)
    const dailyMap: { [key: string]: { date: string; shipped: number; sales: number } } = {};
    for (let i = 13; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const key = getLocalIsoDate(d);
        dailyMap[key] = { date: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), shipped: 0, sales: 0 };
    }

    orders.forEach(o => {
        const createDate = o.createdAt.split('T')[0];
        const shipDate = o.shippedAt ? o.shippedAt.split('T')[0] : null;
        
        const isInRange = createDate >= sDateStr && createDate <= eDateStr;
        const isShipInRange = shipDate && shipDate >= sDateStr && shipDate <= eDateStr;

        // 1. INBOUND METRICS (Based on createdAt)
        if (isInRange) {
            // Confirm count includes anything that moved past initial leads
            if ([OrderStatus.CONFIRMED, OrderStatus.SHIPPED, OrderStatus.DELIVERY, OrderStatus.DELIVERED].includes(o.status)) {
                confirmedCount++;
                
                // Track confirmed product manifest
                o.items.forEach(item => {
                  if (!confirmedProductTally[item.productId]) {
                      const p = products.find(prod => prod.id === item.productId);
                      confirmedProductTally[item.productId] = { name: item.name, sku: p?.sku || 'N/A', count: 0 };
                  }
                  confirmedProductTally[item.productId].count += item.quantity;
                });
            }

            if ([OrderStatus.RETURNED, OrderStatus.RETURN_TRANSFER, OrderStatus.RETURN_AS_ON_SYSTEM, OrderStatus.RETURN_HANDOVER].includes(o.status)) {
                returnedCount++;
            }
            if (o.status === OrderStatus.RETURN_COMPLETED) {
                restockedCount++;
            }

            // Team efficiency stats based on range
            const u = o.openedBy || 'System';
            if (!teamStats[u]) teamStats[u] = { name: u, confirmed: 0, rejected: 0, opened: 0, hold: 0, noAnswer: 0, residual: 0 };
            
            if ([OrderStatus.CONFIRMED, OrderStatus.SHIPPED, OrderStatus.DELIVERY, OrderStatus.DELIVERED].includes(o.status)) teamStats[u].confirmed++;
            if ([OrderStatus.REJECTED, OrderStatus.RETURNED, OrderStatus.RETURN_TRANSFER, OrderStatus.RETURN_AS_ON_SYSTEM, OrderStatus.RETURN_HANDOVER, OrderStatus.RETURN_COMPLETED].includes(o.status)) teamStats[u].rejected++;
            if (o.status === OrderStatus.OPEN_LEAD) teamStats[u].opened++;
            if (o.status === OrderStatus.HOLD) teamStats[u].hold++;
            if (o.status === OrderStatus.NO_ANSWER) teamStats[u].noAnswer++;
            if (o.status === OrderStatus.RESIDUAL || o.status === OrderStatus.REARRANGE) teamStats[u].residual++;
        }

        // 2. LOGISTICS METRICS (Based on shippedAt)
        // This is where "Today Shipped" logic is replicated
        if (isShipInRange) {
            shippedCount++;
            
            if (o.status === OrderStatus.DELIVERED) {
              deliveredCount++;
              totalRevenue += o.totalAmount;
            }

            // Track dispatched product manifest
            o.items.forEach(item => {
                if (!shippedProductTally[item.productId]) {
                    const p = products.find(prod => prod.id === item.productId);
                    shippedProductTally[item.productId] = { name: item.name, sku: p?.sku || 'N/A', count: 0 };
                }
                shippedProductTally[item.productId].count += item.quantity;
            });

            // Sales Velocity Trend (Daily Charts) - using ship date for settlements in charts
            if (o.status === OrderStatus.DELIVERED && shipDate && dailyMap[shipDate]) {
                dailyMap[shipDate].sales += o.totalAmount;
            }
        }

        // Historical Trend Overlay (Always 14 days)
        if (shipDate && dailyMap[shipDate]) {
            dailyMap[shipDate].shipped++;
        }
    });

    return {
        stats: { deliveredCount, returnedCount, restockedCount, confirmedCount, shippedCount, totalRevenue },
        shippedProducts: Object.values(shippedProductTally).sort((a, b) => b.count - a.count),
        confirmedProducts: Object.values(confirmedProductTally).sort((a, b) => b.count - a.count),
        team: Object.values(teamStats),
        trends: Object.values(dailyMap)
    };
  }, [orders, products, team, startDate, endDate]);

  const BigStat = ({ label, value, color, icon }: any) => (
    <div className="bg-white border border-slate-100 rounded-[2rem] p-6 shadow-sm flex flex-col items-center justify-center text-center hover:scale-105 transition-all">
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
                <Calendar size={14} className="text-blue-600" />
                <input type="date" value={startDate} onChange={e => { setStartDate(e.target.value); setPreset('CUSTOM'); }} className="text-[10px] font-bold outline-none bg-transparent uppercase" />
                <span className="text-[10px] font-black text-slate-300 mx-1">TO</span>
                <input type="date" value={endDate} onChange={e => { setEndDate(e.target.value); setPreset('CUSTOM'); }} className="text-[10px] font-bold outline-none bg-transparent uppercase" />
            </div>
            <button onClick={fetchData} className="p-2.5 bg-slate-900 text-white rounded-xl hover:bg-black transition-all shadow-lg">
                <RefreshCcw size={16} className={loading ? 'animate-spin' : ''} />
            </button>
        </div>
      </div>

      {/* Primary Metrics Grid */}
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
                  <h3 className="text-sm font-black uppercase tracking-widest text-slate-900">Logistics Pulse (14D)</h3>
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
                  <h3 className="text-sm font-black uppercase tracking-widest text-slate-900">Sales Velocity (14D)</h3>
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

      {/* Manifest Row: Dispatched vs Confirmed */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-[3rem] border border-slate-100 shadow-sm overflow-hidden flex flex-col">
              <div className="p-6 border-b border-slate-50 flex items-center justify-between bg-indigo-50/10">
                  <h3 className="text-[11px] font-black uppercase tracking-widest flex items-center gap-2">
                      <Truck size={16} className="text-indigo-600" /> Dispatch Manifest
                  </h3>
              </div>
              <div className="flex-1 overflow-auto max-h-[350px] no-scrollbar">
                  <table className="w-full text-left compact-table">
                      <thead><tr><th>SKU</th><th>Product</th><th className="text-right">Shipped Units</th></tr></thead>
                      <tbody className="divide-y divide-slate-50">
                          {dashboardData.shippedProducts.map((p, i) => (
                              <tr key={i} className="hover:bg-slate-50">
                                  <td><span className="font-mono text-[10px] font-bold text-indigo-600">{p.sku}</span></td>
                                  <td><span className="text-[13px] font-black text-slate-700 uppercase">{p.name}</span></td>
                                  <td className="text-right"><span className="px-4 py-1.5 bg-indigo-600 text-white rounded-xl text-xs font-black">{p.count}</span></td>
                              </tr>
                          ))}
                      </tbody>
                  </table>
                  {dashboardData.shippedProducts.length === 0 && (
                      <div className="p-20 text-center opacity-20 font-black uppercase text-[10px] tracking-widest">No logistics records in range</div>
                  )}
              </div>
          </div>

          <div className="bg-white rounded-[3rem] border border-slate-100 shadow-sm overflow-hidden flex flex-col">
              <div className="p-6 border-b border-slate-50 flex items-center justify-between bg-blue-50/10">
                  <h3 className="text-[11px] font-black uppercase tracking-widest flex items-center gap-2">
                      <Target size={16} className="text-blue-600" /> Confirmation Manifest
                  </h3>
              </div>
              <div className="flex-1 overflow-auto max-h-[350px] no-scrollbar">
                  <table className="w-full text-left compact-table">
                      <thead><tr><th>SKU</th><th>Product</th><th className="text-right">Confirmed Units</th></tr></thead>
                      <tbody className="divide-y divide-slate-50">
                          {dashboardData.confirmedProducts.map((p, i) => (
                              <tr key={i} className="hover:bg-slate-50">
                                  <td><span className="font-mono text-[10px] font-bold text-blue-600">{p.sku}</span></td>
                                  <td><span className="text-[13px] font-black text-slate-700 uppercase">{p.name}</span></td>
                                  <td className="text-right"><span className="px-4 py-1.5 bg-blue-600 text-white rounded-xl text-xs font-black">{p.count}</span></td>
                              </tr>
                          ))}
                      </tbody>
                  </table>
                  {dashboardData.confirmedProducts.length === 0 && (
                      <div className="p-20 text-center opacity-20 font-black uppercase text-[10px] tracking-widest">No confirmations in range</div>
                  )}
              </div>
          </div>
      </div>

      {/* Team Performance */}
      <div className="bg-white rounded-[3rem] border border-slate-100 shadow-sm overflow-hidden flex flex-col">
          <div className="p-6 border-b border-slate-50 flex items-center justify-between bg-slate-50/10">
              <h3 className="text-[11px] font-black uppercase tracking-widest flex items-center gap-2">
                  <Users size={16} className="text-slate-600" /> Team Efficiency Registry
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
                      <th className="text-center"><span className="flex items-center justify-center gap-1"><PhoneForwarded size={10}/> Residuals</span></th>
                      <th className="text-center"><span className="flex items-center justify-center gap-1"><CheckCircle size={10}/> Confirmed</span></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                      {dashboardData.team.map((u, i) => (
                          <tr key={i} className="hover:bg-slate-50">
                              <td>
                                  <div className="flex flex-col">
                                      <span className="text-[13px] font-black text-slate-900 uppercase leading-none">{u.name}</span>
                                      <span className="text-[8px] font-bold text-slate-400 mt-1 uppercase tracking-tighter">Node Cluster Active</span>
                                  </div>
                              </td>
                              <td className="text-center font-bold text-slate-600">{u.opened}</td>
                              <td className="text-center font-bold text-slate-500">{u.noAnswer}</td>
                              <td className="text-center font-bold text-rose-500">{u.rejected}</td>
                              <td className="text-center font-bold text-amber-500">{u.residual}</td>
                              <td className="text-center font-bold text-emerald-600">{u.confirmed}</td>
                          </tr>
                      ))}
                  </tbody>
              </table>
          </div>
      </div>
    </div>
  );
};
