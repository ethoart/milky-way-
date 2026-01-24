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
    const now = new Date();
    // Calculate 12:00 PM (Noon) Reset Point
    const todayNoon = new Date(now);
    todayNoon.setHours(12, 0, 0, 0);
    
    let resetPointStart: Date;
    if (now < todayNoon) {
      // Current cycle started yesterday at 12 PM
      resetPointStart = new Date(todayNoon);
      resetPointStart.setDate(resetPointStart.getDate() - 1);
    } else {
      // Current cycle started today at 12 PM
      resetPointStart = todayNoon;
    }

    // Standard Daily Stats (Calendar Day)
    const todayStr = now.toDateString();
    const dailyConfirmed = orders.filter(o => o.status === OrderStatus.CONFIRMED && new Date(o.createdAt).toDateString() === todayStr).length;
    const dailyShipped = orders.filter(o => o.shippedAt && new Date(o.shippedAt).toDateString() === todayStr).length;
    const totalRevenue = orders.filter(o => o.status === OrderStatus.DELIVERED).reduce((s, o) => s + o.totalAmount, 0);

    // STAFF PIPELINE: Operational Window (12 PM Reset)
    const userStatsMap: { [key: string]: { open: number, confirmed: number } } = {};
    
    orders.forEach(o => {
        o.logs?.forEach(l => {
            const lTime = new Date(l.timestamp);
            // Only count logs within the current 12 PM - 12 PM window
            if (lTime >= resetPointStart && lTime <= now) {
                const u = l.user || 'System';
                if (!userStatsMap[u]) userStatsMap[u] = { open: 0, confirmed: 0 };
                
                // Track the ACTION of opening/creating, not the current status
                if (l.message.includes('OPEN_LEAD') || l.message.includes('Manual Creation')) {
                    userStatsMap[u].open += 1;
                }
                // Track the ACTION of confirming
                if (l.message.includes('CONFIRMED')) {
                    userStatsMap[u].confirmed += 1;
                }
            }
        });
    });

    const staffPerformance = Object.keys(userStatsMap).map(name => ({
        name,
        open: userStatsMap[name].open,
        confirmed: userStatsMap[name].confirmed
    })).sort((a, b) => b.open - a.open);

    // Product Stats
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

    return { 
        dailyConfirmed, 
        dailyShipped, 
        totalRevenue,
        staffPerformance,
        dailyProductCounts: Object.values(tally).sort((a, b) => b.count - a.count),
        resetTime: resetPointStart.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
  }, [orders, products]);

  const SmallStat = ({ label, value, color, icon }: any) => (
    <div className="bg-white border border-slate-100 rounded-2xl p-4 flex flex-col items-center justify-center shadow-sm">
        <div className={`p-2 rounded-lg ${color} mb-2`}>{React.cloneElement(icon, { size: 14 })}</div>
        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{label}</span>
        <span className="text-lg font-black text-slate-900">{value}</span>
    </div>
  );

  return (
    <div className="space-y-6 animate-slide-in max-w-[1400px] mx-auto pb-10">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900">Milky Way Dashboard</h2>
          <p className="text-xs text-slate-500 font-medium tracking-tight">Enterprise Analytics • Reset Window: <span className="text-blue-600 font-bold">{stats.resetTime}</span></p>
        </div>
        <button onClick={fetchData} className="p-2.5 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors shadow-sm">
            <RefreshCcw size={16} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <SmallStat label="Confirmed Today" value={stats.dailyConfirmed} color="bg-blue-50 text-blue-600" icon={<CheckCircle/>} />
                <SmallStat label="Shipped Today" value={stats.dailyShipped} color="bg-indigo-50 text-indigo-600" icon={<Truck/>} />
                <SmallStat label="Total Revenue" value={formatCurrency(stats.totalRevenue)} color="bg-emerald-50 text-emerald-600" icon={<DollarSign/>} />
            </div>

            <div className="modern-card overflow-hidden">
                <div className="p-4 border-b border-slate-100 bg-blue-50/20 flex items-center justify-between">
                    <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                        <ListFilter size={14} className="text-blue-600" />
                        Today's Product Tally
                    </h3>
                </div>
                <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                    {stats.dailyProductCounts.map((item, idx) => (
                        <div key={idx} className="bg-slate-50 border border-slate-100 rounded-xl p-3 flex items-center justify-between">
                            <div className="flex flex-col">
                                <span className="text-[11px] font-bold text-slate-900 truncate max-w-[120px]">{item.name}</span>
                                <span className="text-[9px] font-mono text-slate-400 uppercase">{item.sku}</span>
                            </div>
                            <div className="bg-white border border-slate-200 rounded-lg px-2 py-1 flex flex-col items-center">
                                <span className="text-sm font-black text-blue-600 leading-none">{item.count}</span>
                                <span className="text-[8px] font-bold text-slate-400 uppercase">Qty</span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>

        <div className="lg:col-span-4">
            <div className="modern-card p-6 flex flex-col h-full bg-slate-900 text-white border-none shadow-xl">
                <div className="flex items-center gap-3 mb-8">
                    <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center"><UserCheck size={18} /></div>
                    <div>
                        <h3 className="text-sm font-bold uppercase tracking-widest">Staff Daily Flow</h3>
                        <p className="text-[8px] font-black text-slate-500 uppercase mt-1">Actions since {stats.resetTime}</p>
                    </div>
                </div>
                
                <div className="space-y-4 flex-1">
                    {stats.staffPerformance.map((user, i) => (
                        <div key={i} className="bg-white/5 border border-white/10 rounded-2xl p-4 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-[10px] font-bold text-blue-400">
                                    {user.name.slice(0, 2).toUpperCase()}
                                </div>
                                <span className="text-xs font-black uppercase">{user.name}</span>
                            </div>
                            <div className="flex items-center gap-4 text-right">
                                <div className="flex flex-col">
                                    <span className="text-[9px] font-bold text-slate-400 uppercase">Opens</span>
                                    <span className="text-sm font-black">{user.open}</span>
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-[9px] font-bold text-slate-400 uppercase">Conf.</span>
                                    <span className="text-sm font-black text-blue-400">{user.confirmed}</span>
                                </div>
                            </div>
                        </div>
                    ))}
                    {stats.staffPerformance.length === 0 && (
                        <div className="p-10 text-center opacity-20 flex flex-col items-center gap-4">
                            <Users size={40} />
                            <p className="text-[10px] font-black uppercase tracking-widest">Grid Idle</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};