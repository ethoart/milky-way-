import React, { useEffect, useState, useMemo } from 'react';
import { Order, OrderStatus, Product } from '../types';
import { db } from '../services/mockBackend';
import { formatCurrency } from '../utils/helpers';
import { RefreshCcw, DollarSign, Truck, CheckCircle, RotateCcw, UserCheck, Users, ListFilter, Archive } from 'lucide-react';

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
    const todayStr = now.toDateString();
    
    // Core Counts
    const dailyConfirmed = orders.filter(o => o.status === OrderStatus.CONFIRMED && new Date(o.createdAt).toDateString() === todayStr).length;
    const dailyShipped = orders.filter(o => o.shippedAt && new Date(o.shippedAt).toDateString() === todayStr).length;
    
    // Logistics Pipeline Status
    const deliveredCount = orders.filter(o => o.status === OrderStatus.DELIVERED).length;
    const returnedCount = orders.filter(o => o.status === OrderStatus.RETURNED).length;
    const returnCompletedCount = orders.filter(o => o.status === OrderStatus.RETURN_COMPLETED).length;
    
    const totalRevenue = orders.filter(o => o.status === OrderStatus.DELIVERED).reduce((s, o) => s + o.totalAmount, 0);

    // Product Tally
    const tally: { [key: string]: { name: string; sku: string; count: number } } = {};
    orders.forEach(o => {
        if (new Date(o.createdAt).toDateString() === todayStr && o.status !== OrderStatus.REJECTED) {
            o.items.forEach(item => {
                if (!tally[item.productId]) {
                    const prod = products.find(p => p.id === item.productId);
                    tally[item.productId] = { name: item.name, sku: prod?.sku || 'N/A', count: 0 };
                }
                tally[item.productId].count += item.quantity;
            });
        }
    });

    return { 
        dailyConfirmed, dailyShipped, totalRevenue,
        deliveredCount, returnedCount, returnCompletedCount,
        dailyProductCounts: Object.values(tally).sort((a, b) => b.count - a.count)
    };
  }, [orders, products]);

  const BigStat = ({ label, value, color, icon }: any) => (
    <div className="bg-white border border-slate-100 rounded-[2rem] p-6 flex flex-col items-center justify-center shadow-sm">
        <div className={`p-3 rounded-2xl ${color} mb-3`}>{React.cloneElement(icon, { size: 20 })}</div>
        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{label}</span>
        <span className="text-2xl font-black text-slate-900">{value}</span>
    </div>
  );

  return (
    <div className="space-y-6 animate-slide-in max-w-[1400px] mx-auto pb-10">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tighter">Milky Way Dashboard</h2>
        <button onClick={fetchData} className="p-2.5 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors shadow-sm">
            <RefreshCcw size={16} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <BigStat label="Today Confirmed" value={stats.dailyConfirmed} color="bg-blue-50 text-blue-600" icon={<CheckCircle/>} />
          <BigStat label="Today Shipped" value={stats.dailyShipped} color="bg-indigo-50 text-indigo-600" icon={<Truck/>} />
          <BigStat label="Delivered" value={stats.deliveredCount} color="bg-emerald-50 text-emerald-600" icon={<CheckCircle/>} />
          <BigStat label="Returned" value={stats.returnedCount} color="bg-orange-50 text-orange-600" icon={<RotateCcw/>} />
          <BigStat label="Restocked" value={stats.returnCompletedCount} color="bg-rose-50 text-rose-600" icon={<Archive/>} />
          <BigStat label="Total Settle" value={formatCurrency(stats.totalRevenue)} color="bg-slate-900 text-white" icon={<DollarSign/>} />
      </div>

      <div className="modern-card overflow-hidden">
          <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-blue-50/10">
              <h3 className="text-[11px] font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                  <ListFilter size={16} className="text-blue-600" /> Daily Load Manifest
              </h3>
          </div>
          <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {stats.dailyProductCounts.map((item, idx) => (
                  <div key={idx} className="bg-slate-50 border border-slate-100 rounded-2xl p-4 flex items-center justify-between">
                      <div className="flex flex-col">
                          <span className="text-sm font-black text-slate-900">{item.name}</span>
                          <span className="text-[10px] font-bold text-slate-400 uppercase">{item.sku}</span>
                      </div>
                      <div className="bg-white border border-slate-200 rounded-xl px-3 py-1 flex flex-col items-center shadow-sm">
                          <span className="text-lg font-black text-blue-600 leading-tight">{item.count}</span>
                          <span className="text-[8px] font-black text-slate-400 uppercase">Unit</span>
                      </div>
                  </div>
              ))}
          </div>
      </div>
    </div>
  );
};