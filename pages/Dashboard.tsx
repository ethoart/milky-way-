
import React, { useEffect, useState, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Order, OrderStatus, Product, UserRole } from '../types';
import { db } from '../services/mockBackend';
import { formatCurrency } from '../utils/helpers';
import { RefreshCcw, Package, DollarSign, Activity, Truck, Calendar, CheckCircle, RotateCcw, UserCheck, Users, Info, ShoppingCart, BarChart3, ListFilter } from 'lucide-react';

interface DashboardProps {
  tenantId: string;
}

export const Dashboard: React.FC<DashboardProps> = ({ tenantId }) => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    const [fetchedOrders, fetchedProducts] = await Promise.all([
        db.getOrders(tenantId),
        db.getProducts(tenantId)
    ]);
    setOrders(fetchedOrders);
    setProducts(fetchedProducts);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 60000); 
    return () => clearInterval(interval);
  }, [tenantId]);

  const stats = useMemo(() => {
    const todayStr = new Date().toDateString();
    
    // Daily counts based on status and timestamp
    const dailyConfirmed = orders.filter(o => o.status === OrderStatus.CONFIRMED && new Date(o.createdAt).toDateString() === todayStr).length;
    const dailyShipped = orders.filter(o => o.shippedAt && new Date(o.shippedAt).toDateString() === todayStr).length;
    const dailyDelivered = orders.filter(o => o.status === OrderStatus.DELIVERED && (o.logs?.some(l => l.message.includes('DELIVERED') && new Date(l.timestamp).toDateString() === todayStr) || new Date(o.createdAt).toDateString() === todayStr)).length;
    const dailyReturned = orders.filter(o => o.status === OrderStatus.RETURNED && (o.logs?.some(l => l.message.includes('RETURNED') && new Date(l.timestamp).toDateString() === todayStr))).length;
    const dailyReturnCompleted = orders.filter(o => o.status === OrderStatus.RETURN_COMPLETED && (o.logs?.some(l => l.message.includes('Completed') && new Date(l.timestamp).toDateString() === todayStr))).length;

    const totalRevenue = orders.filter(o => o.status === OrderStatus.DELIVERED).reduce((s, o) => s + o.totalAmount, 0);

    // Grouping for "Open Leads" by user
    const userStats = orders.reduce((acc: any, o) => {
        const user = o.openedBy || 'System';
        if (!acc[user]) acc[user] = { open: 0, confirmed: 0 };
        if (o.status === OrderStatus.OPEN_LEAD) acc[user].open += 1;
        const isConfirmedByUser = o.status === OrderStatus.CONFIRMED && o.logs?.some(l => l.user === user && l.message.includes('CONFIRMED'));
        if (isConfirmedByUser) acc[user].confirmed += 1;
        return acc;
    }, {});

    const staffPerformance = Object.keys(userStats).map(name => ({
        name,
        open: userStats[name].open,
        confirmed: userStats[name].confirmed
    })).sort((a, b) => b.open - a.open);

    // Product Performance Metrics
    const productPerformance = products.map(p => {
        const pOrders = orders.filter(o => o.items.some(item => item.productId === p.id));
        
        const sellCount = pOrders.filter(o => o.status !== OrderStatus.REJECTED && o.status !== OrderStatus.OPEN_LEAD).reduce((acc, o) => {
            const item = o.items.find(i => i.productId === p.id);
            return acc + (item?.quantity || 0);
        }, 0);

        const deliveredCount = pOrders.filter(o => o.status === OrderStatus.DELIVERED).reduce((acc, o) => {
            const item = o.items.find(i => i.productId === p.id);
            return acc + (item?.quantity || 0);
        }, 0);

        const returnCount = pOrders.filter(o => o.status === OrderStatus.RETURNED || o.status === OrderStatus.RETURN_COMPLETED).reduce((acc, o) => {
            const item = o.items.find(i => i.productId === p.id);
            return acc + (item?.quantity || 0);
        }, 0);

        return {
            ...p,
            sellCount,
            deliveredCount,
            returnCount
        };
    }).sort((a, b) => b.sellCount - a.sellCount);

    // New: Daily Product Tally
    const tally: { [key: string]: { name: string; sku: string; count: number } } = {};
    orders.forEach(o => {
        if (new Date(o.createdAt).toDateString() === todayStr && o.status !== OrderStatus.REJECTED) {
            o.items.forEach(item => {
                if (!tally[item.productId]) {
                    const prod = products.find(p => p.id === item.productId);
                    tally[item.productId] = { 
                        name: item.name, 
                        sku: prod?.sku || 'N/A', 
                        count: 0 
                    };
                }
                tally[item.productId].count += item.quantity;
            });
        }
    });
    const dailyProductCounts = Object.values(tally).sort((a, b) => b.count - a.count);

    return { 
        dailyConfirmed, 
        dailyShipped, 
        dailyDelivered, 
        dailyReturned, 
        dailyReturnCompleted, 
        totalRevenue,
        staffPerformance,
        productPerformance,
        dailyProductCounts
    };
  }, [orders, products]);

  const chartData = useMemo(() => {
      const months = ['Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov'];
      return months.map(m => ({
          name: m,
          amount: Math.floor(Math.random() * 20000) + 5000,
          active: m === 'Jun'
      }));
  }, []);

  const SmallStat = ({ label, value, color, icon }: any) => (
    <div className="bg-white border border-slate-100 rounded-2xl p-4 flex flex-col items-center justify-center shadow-sm">
        <div className={`p-2 rounded-lg ${color} mb-2`}>
            {React.cloneElement(icon, { size: 14 })}
        </div>
        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{label}</span>
        <span className="text-lg font-black text-slate-900">{value}</span>
    </div>
  );

  return (
    <div className="space-y-6 animate-slide-in max-w-[1400px] mx-auto pb-10">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900">Milky Way Dashboard</h2>
          <p className="text-xs text-slate-500 font-medium">Enterprise Operation Analytics for <span className="text-blue-600">Milky Way OMS</span></p>
        </div>
        <button onClick={fetchData} className="p-2.5 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors shadow-sm">
            <RefreshCcw size={16} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Daily Pipeline Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <SmallStat label="Confirmed" value={stats.dailyConfirmed} color="bg-blue-50 text-blue-600" icon={<CheckCircle/>} />
        <SmallStat label="Shipped" value={stats.dailyShipped} color="bg-indigo-50 text-indigo-600" icon={<Truck/>} />
        <SmallStat label="Delivered" value={stats.dailyDelivered} color="bg-emerald-50 text-emerald-600" icon={<DollarSign/>} />
        <SmallStat label="Returned" value={stats.dailyReturned} color="bg-orange-50 text-orange-600" icon={<RotateCcw/>} />
        <SmallStat label="R. Complete" value={stats.dailyReturnCompleted} color="bg-rose-50 text-rose-600" icon={<Package/>} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 space-y-6">
            {/* Daily Product Count Section */}
            <div className="modern-card overflow-hidden">
                <div className="p-4 border-b border-slate-100 bg-blue-50/20 flex items-center justify-between">
                    <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                        <ListFilter size={14} className="text-blue-600" />
                        Today's Product Tally
                    </h3>
                    <span className="text-[9px] font-bold text-blue-600 uppercase">Live Entry Stream</span>
                </div>
                <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {stats.dailyProductCounts.map((item, idx) => (
                        <div key={idx} className="bg-slate-50 border border-slate-100 rounded-xl p-3 flex items-center justify-between">
                            <div className="flex flex-col">
                                <span className="text-[11px] font-bold text-slate-900 truncate max-w-[120px]">{item.name}</span>
                                <span className="text-[9px] font-mono text-slate-400 uppercase tracking-tighter">{item.sku}</span>
                            </div>
                            <div className="bg-white border border-slate-200 rounded-lg px-2 py-1 flex flex-col items-center min-w-[40px]">
                                <span className="text-sm font-black text-blue-600 leading-none">{item.count}</span>
                                <span className="text-[8px] font-bold text-slate-400 uppercase">Qty</span>
                            </div>
                        </div>
                    ))}
                    {stats.dailyProductCounts.length === 0 && (
                        <div className="col-span-full py-6 text-center text-slate-300">
                             <p className="text-[10px] font-black uppercase tracking-widest">No orders logged today</p>
                        </div>
                    )}
                </div>
            </div>

            <div className="modern-card p-6 h-[380px] flex flex-col">
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <p className="text-xs font-bold text-slate-400">Yield Growth</p>
                        <h3 className="text-2xl font-black text-slate-900">{formatCurrency(stats.totalRevenue)}</h3>
                    </div>
                    <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400">
                        <span className="w-2 h-2 rounded-full bg-blue-600"></span> Active Period
                    </div>
                </div>
                <div className="flex-1">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData} margin={{ top: 20, right: 0, left: -20, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                            <XAxis dataKey="name" stroke="#94a3b8" fontSize={10} axisLine={false} tickLine={false} dy={10} />
                            <YAxis stroke="#94a3b8" fontSize={10} axisLine={false} tickLine={false} />
                            <Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)'}} />
                            <Bar dataKey="amount" radius={[6, 6, 6, 6]} barSize={32}>
                                {chartData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.active ? '#2563eb' : '#e2e8f0'} />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>

            <div className="modern-card overflow-hidden">
                <div className="p-4 border-b border-slate-100 bg-slate-50/30 flex items-center justify-between">
                    <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                        <BarChart3 size={14} className="text-blue-600" />
                        Product Performance Analysis
                    </h3>
                    <span className="text-[9px] font-bold text-slate-400 uppercase">Global Lifecycle</span>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left compact-table">
                        <thead>
                            <tr className="bg-slate-50/50">
                                <th>Product Identity</th>
                                <th className="text-center">Sold</th>
                                <th className="text-center">Delivered</th>
                                <th className="text-center">Returns</th>
                                <th className="text-right">Stock</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {stats.productPerformance.map((p) => (
                                <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                                    <td>
                                        <div className="flex flex-col">
                                            <span className="font-bold text-slate-900 text-[13px]">{p.name}</span>
                                            <span className="text-[10px] font-mono text-slate-400 uppercase">{p.sku}</span>
                                        </div>
                                    </td>
                                    <td className="text-center">
                                        <div className="flex flex-col items-center">
                                            <span className="font-black text-indigo-600 text-sm">{p.sellCount}</span>
                                            <span className="text-[8px] font-bold text-slate-400 uppercase">Units</span>
                                        </div>
                                    </td>
                                    <td className="text-center">
                                        <div className="flex flex-col items-center">
                                            <span className="font-black text-emerald-600 text-sm">{p.deliveredCount}</span>
                                            <span className="text-[8px] font-bold text-slate-400 uppercase">Settled</span>
                                        </div>
                                    </td>
                                    <td className="text-center">
                                        <div className="flex flex-col items-center">
                                            <span className="font-black text-rose-500 text-sm">{p.returnCount}</span>
                                            <span className="text-[8px] font-bold text-slate-400 uppercase">Rejects</span>
                                        </div>
                                    </td>
                                    <td className="text-right">
                                        <div className="flex flex-col items-end">
                                            <span className={`text-[12px] font-black ${p.stock < 10 ? 'text-rose-600' : 'text-slate-900'}`}>{p.stock}</span>
                                            <span className="text-[8px] font-bold text-slate-400 uppercase">Available</span>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>

        {/* Right Column: Staff Performance / Lead Funnel */}
        <div className="lg:col-span-4 space-y-6">
            <div className="modern-card p-6 flex flex-col h-full bg-slate-900 text-white border-none shadow-xl shadow-slate-200">
                <div className="flex items-center gap-3 mb-8">
                    <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                        <UserCheck size={18} />
                    </div>
                    <h3 className="text-sm font-bold uppercase tracking-widest">Staff Pipeline</h3>
                </div>
                
                <div className="space-y-4 flex-1">
                    {stats.staffPerformance.map((user, i) => (
                        <div key={i} className="bg-white/5 border border-white/10 rounded-2xl p-4 flex items-center justify-between hover:bg-white/10 transition-colors">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-[10px] font-bold text-blue-400 border border-white/5">
                                    {user.name.slice(0, 2).toUpperCase()}
                                </div>
                                <div>
                                    <p className="text-xs font-black uppercase tracking-tight">{user.name}</p>
                                    <p className="text-[9px] text-slate-400 font-bold">Inbound Desk</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-4 text-right">
                                <div className="flex flex-col">
                                    <span className="text-[9px] font-bold text-slate-400 uppercase">Open</span>
                                    <span className="text-sm font-black text-white">{user.open}</span>
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-[9px] font-bold text-slate-400 uppercase">Conv.</span>
                                    <span className="text-sm font-black text-blue-400">{user.confirmed}</span>
                                </div>
                            </div>
                        </div>
                    ))}
                    {stats.staffPerformance.length === 0 && (
                        <div className="p-10 text-center opacity-20 flex flex-col items-center gap-4">
                            <Users size={40} />
                            <p className="text-[10px] font-black uppercase tracking-[0.3em]">Grid Idle</p>
                        </div>
                    )}
                </div>

                <div className="mt-8 pt-6 border-t border-white/10">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Info size={14} className="text-slate-500" />
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Global Status</span>
                        </div>
                        <span className="text-[10px] font-black text-green-400 uppercase bg-green-400/10 px-2 py-0.5 rounded-full">Active</span>
                    </div>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};
