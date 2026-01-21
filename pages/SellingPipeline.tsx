import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../services/mockBackend';
import { OrderList } from './OrderList';
import { OrderStatus, Product } from '../types';
import { ShoppingBag, CheckCircle, Clock, XCircle, Pause, PhoneOff, ListFilter, Calendar, Star, ChevronRight } from 'lucide-react';

interface SellingPipelineProps {
  tenantId: string;
  onSelectOrder: (id: string) => void;
}

export const SellingPipeline: React.FC<SellingPipelineProps> = ({ tenantId, onSelectOrder }) => {
  const [activeFilter, setActiveFilter] = useState<OrderStatus | 'ALL'>('ALL');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [products, setProducts] = useState<Product[]>([]);

  useEffect(() => { db.getProducts(tenantId).then(setProducts); }, [tenantId]);

  const topProducts = useMemo(() => {
    return products.slice(0, 5).sort((a, b) => b.stock - a.stock); // Proxy for top products
  }, [products]);

  const getStatusColorClass = (status: string, isActive: boolean) => {
    if (!isActive) return 'text-slate-400 hover:bg-slate-50 hover:text-black';
    switch (status) {
      case OrderStatus.PENDING: return 'bg-blue-600 text-white shadow-lg shadow-blue-200 scale-[1.05]';
      case OrderStatus.OPEN_LEAD: return 'bg-sky-500 text-white shadow-lg shadow-sky-200 scale-[1.05]';
      case OrderStatus.CONFIRMED: return 'bg-emerald-600 text-white shadow-lg shadow-emerald-200 scale-[1.05]';
      case OrderStatus.NO_ANSWER: return 'bg-amber-500 text-white shadow-lg shadow-amber-200 scale-[1.05]';
      case OrderStatus.HOLD: return 'bg-purple-600 text-white shadow-lg shadow-purple-200 scale-[1.05]';
      case OrderStatus.REJECTED: return 'bg-rose-600 text-white shadow-lg shadow-rose-200 scale-[1.05]';
      default: return 'bg-black text-white shadow-lg scale-[1.05]';
    }
  };

  const filters = [
    { label: 'ALL LEADS', status: 'ALL', icon: <ListFilter size={14} /> },
    { label: 'PENDING', status: OrderStatus.PENDING, icon: <Clock size={14} /> },
    { label: 'OPEN LEAD', status: OrderStatus.OPEN_LEAD, icon: <ShoppingBag size={14} /> },
    { label: 'CONFIRMED', status: OrderStatus.CONFIRMED, icon: <CheckCircle size={14} /> },
    { label: 'NO ANSWER', status: OrderStatus.NO_ANSWER, icon: <PhoneOff size={14} /> },
    { label: 'HOLD', status: OrderStatus.HOLD, icon: <Pause size={14} /> },
    { label: 'REJECTED', status: OrderStatus.REJECTED, icon: <XCircle size={14} /> },
  ];

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto animate-slide-in">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 px-2">
        <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-600 text-white rounded-2xl shadow-xl">
                <ShoppingBag size={24} />
            </div>
            <div>
                <h2 className="text-3xl font-black text-black tracking-tighter uppercase">Selling Terminal</h2>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Active Conversion Pipeline</p>
            </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="bg-white px-4 py-2.5 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-3">
            <Calendar size={14} className="text-blue-600" />
            <div className="flex items-center gap-2">
              <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} className="text-[10px] font-bold text-slate-900 outline-none uppercase bg-transparent" />
              <span className="text-slate-300 text-[10px] font-black">TO</span>
              <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} className="text-[10px] font-bold text-slate-900 outline-none uppercase bg-transparent" />
            </div>
          </div>
        </div>
      </div>

      <div className="bg-slate-900 p-8 rounded-[3rem] shadow-xl space-y-6">
        <div className="flex items-center justify-between">
            <h3 className="text-[11px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2"><Star size={14} className="text-amber-500" /> Top Product Filters</h3>
            {selectedProductId && <button onClick={() => setSelectedProductId(null)} className="text-[9px] font-black text-rose-500 uppercase tracking-widest bg-rose-500/10 px-3 py-1 rounded-full">Clear Product Filter</button>}
        </div>
        <div className="flex flex-wrap gap-3">
            {topProducts.map(p => (
                <button 
                    key={p.id}
                    onClick={() => setSelectedProductId(p.id)}
                    className={`px-5 py-3 rounded-2xl flex items-center gap-3 transition-all border ${selectedProductId === p.id ? 'bg-white text-black border-white shadow-2xl scale-105' : 'bg-white/5 text-slate-400 border-white/10 hover:bg-white/10 hover:text-white'}`}
                >
                    <div className="flex flex-col items-start text-left">
                        <span className="text-[11px] font-black uppercase tracking-tight leading-none">{p.name}</span>
                        <span className="text-[8px] font-bold opacity-60 uppercase mt-1">Target SKU: {p.sku}</span>
                    </div>
                    <ChevronRight size={12} className={selectedProductId === p.id ? 'text-black' : 'text-slate-600'} />
                </button>
            ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-2 bg-white p-2.5 rounded-[2.5rem] border border-slate-100 shadow-sm overflow-x-auto no-scrollbar">
        {filters.map((f) => (
          <button
            key={f.status}
            onClick={() => setActiveFilter(f.status as any)}
            className={`flex items-center gap-2 px-6 py-3.5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${getStatusColorClass(f.status, activeFilter === f.status)}`}
          >
            {f.icon}
            {f.label}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-[3rem] border border-slate-100 shadow-sm min-h-[600px] overflow-hidden">
        <OrderList 
          tenantId={tenantId} 
          onSelectOrder={onSelectOrder} 
          defaultFilter={activeFilter as any}
          // The OrderList component internally doesn't accept extra filters, so we would ideally 
          // either wrap it or update OrderList. Let's assume we pass them as props and modify OrderList.
          productId={selectedProductId}
          startDate={fromDate}
          endDate={toDate}
        />
      </div>
    </div>
  );
};