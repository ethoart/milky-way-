
import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../services/mockBackend';
import { OrderList } from './OrderList';
import { Order, OrderStatus, Product } from '../types';
import { ShoppingBag, CheckCircle, Clock, XCircle, Pause, PhoneOff, ListFilter, Calendar, Box, ChevronDown } from 'lucide-react';

interface SellingPipelineProps {
  tenantId: string;
  shopName: string;
  onSelectOrder: (id: string) => void;
}

export const SellingPipeline: React.FC<SellingPipelineProps> = ({ tenantId, shopName, onSelectOrder }) => {
  const [activeFilter, setActiveFilter] = useState<OrderStatus | 'ALL'>('ALL');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [selectedProductId, setSelectedProductId] = useState<string>('ALL');
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => { 
    db.getProducts(tenantId).then(setProducts); 
    db.getOrders(tenantId).then(setOrders);
  }, [tenantId, refreshKey]);

  const handleBulkShip = async (ids: string[]) => {
    if (!confirm(`Execute Bulk Dispatch for ${ids.length} orders?`)) return;
    for (const id of ids) {
      const order = await db.getOrder(id, tenantId);
      if (order) await db.shipOrder(order, tenantId);
    }
    alert("Bulk Handshake Complete: Records updated.");
    setRefreshKey(prev => prev + 1);
  };

  const getFilterColor = (status: string) => {
    if (activeFilter !== status) return 'bg-slate-50 text-slate-400 hover:bg-slate-100 hover:text-black';
    switch(status) {
      case OrderStatus.PENDING: return 'bg-blue-600 text-white shadow-lg scale-105';
      case OrderStatus.OPEN_LEAD: return 'bg-sky-400 text-white shadow-lg scale-105';
      case OrderStatus.CONFIRMED: return 'bg-emerald-600 text-white shadow-lg scale-105';
      case OrderStatus.HOLD: return 'bg-purple-600 text-white shadow-lg scale-105';
      case OrderStatus.NO_ANSWER: return 'bg-yellow-500 text-white shadow-lg scale-105';
      case OrderStatus.REJECTED: return 'bg-rose-600 text-white shadow-lg scale-105';
      default: return 'bg-black text-white shadow-lg scale-105';
    }
  };

  const counts = useMemo(() => {
    const stats = {
      ALL: 0,
      PENDING: 0,
      OPEN_LEAD: 0,
      CONFIRMED: 0,
      HOLD: 0,
      NO_ANSWER: 0,
      REJECTED: 0
    };
    
    orders.forEach(o => {
        if (selectedProductId !== 'ALL' && !o.items.some(i => i.productId === selectedProductId)) return;
        
        const s = o.status as keyof typeof stats;
        if (stats[s] !== undefined) {
            stats[s]++;
            stats.ALL++;
        }
    });
    return stats;
  }, [orders, selectedProductId]);

  const filters = [
    { label: 'ALL LEADS', status: 'ALL', icon: <ListFilter size={14} />, count: counts.ALL },
    { label: 'PENDING', status: OrderStatus.PENDING, icon: <Clock size={14} />, count: counts.PENDING },
    { label: 'OPEN LEAD', status: OrderStatus.OPEN_LEAD, icon: <ShoppingBag size={14} />, count: counts.OPEN_LEAD },
    { label: 'CONFIRMED', status: OrderStatus.CONFIRMED, icon: <CheckCircle size={14} />, count: counts.CONFIRMED },
    { label: 'HOLD', status: OrderStatus.HOLD, icon: <Pause size={14} />, count: counts.HOLD },
    { label: 'NO ANSWER', status: OrderStatus.NO_ANSWER, icon: <PhoneOff size={14} />, count: counts.NO_ANSWER },
    { label: 'REJECTED', status: OrderStatus.REJECTED, icon: <XCircle size={14} />, count: counts.REJECTED },
  ];

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto animate-slide-in">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 px-2">
        <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-600 text-white rounded-2xl shadow-xl">
                <ShoppingBag size={24} />
            </div>
            <div>
                <h2 className="text-3xl font-black text-black tracking-tighter uppercase leading-none">{shopName} Selling</h2>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2">Active Conversion Pipeline</p>
            </div>
        </div>
        
        <div className="flex items-center gap-3 flex-wrap">
            <div className="bg-white px-4 py-2.5 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-3 relative">
                <Box size={14} className="text-blue-600" />
                <select 
                    value={selectedProductId}
                    onChange={(e) => setSelectedProductId(e.target.value)}
                    className="text-[10px] font-black text-slate-900 outline-none uppercase bg-transparent appearance-none pr-6 cursor-pointer"
                >
                    <option value="ALL">ALL PRODUCTS</option>
                    {products.map(p => <option key={p.id} value={p.id}>{p.sku} - {p.name}</option>)}
                </select>
                <ChevronDown size={12} className="absolute right-4 text-slate-400 pointer-events-none" />
            </div>

            <div className="bg-white px-4 py-2.5 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-3">
                <Calendar size={14} className="text-blue-600" />
                <div className="flex items-center gap-2">
                    <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} className="text-[11px] font-bold text-slate-900 outline-none uppercase bg-transparent" />
                    <span className="text-slate-300 text-[10px] font-black">TO</span>
                    <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} className="text-[11px] font-bold text-slate-900 outline-none uppercase bg-transparent" />
                </div>
            </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 bg-white p-2.5 rounded-[2.5rem] border border-slate-100 shadow-sm overflow-x-auto no-scrollbar">
        {filters.map((f) => (
          <button
            key={f.status}
            onClick={() => setActiveFilter(f.status as any)}
            className={`flex items-center gap-2 px-5 py-3.5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${getFilterColor(f.status)}`}
          >
            {f.icon} 
            {f.label}
            <span className={`ml-2 px-2 py-0.5 rounded-full text-[9px] ${activeFilter === f.status ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-600'}`}>
                {f.count}
            </span>
          </button>
        ))}
      </div>

      <div className="bg-white rounded-[3rem] border border-slate-100 shadow-sm min-h-[600px] overflow-hidden">
        <OrderList 
          key={`${refreshKey}-${activeFilter}-${selectedProductId}`}
          tenantId={tenantId} 
          onSelectOrder={onSelectOrder} 
          defaultFilter={activeFilter as any}
          productId={selectedProductId === 'ALL' ? null : selectedProductId}
          startDate={fromDate}
          endDate={toDate}
          onBulkAction={handleBulkShip}
        />
      </div>
    </div>
  );
};
