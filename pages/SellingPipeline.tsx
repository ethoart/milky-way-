import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../services/mockBackend';
import { OrderList } from './OrderList';
import { OrderStatus, Product } from '../types';
import { ShoppingBag, CheckCircle, Clock, XCircle, Pause, PhoneOff, ListFilter, Calendar, Star } from 'lucide-react';

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
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => { db.getProducts(tenantId).then(setProducts); }, [tenantId]);

  const handleBulkShip = async (ids: string[]) => {
    if (!confirm(`Execute Bulk Dispatch for ${ids.length} orders?`)) return;
    for (const id of ids) {
      const order = await db.getOrder(id, tenantId);
      if (order) await db.shipOrder(order, tenantId);
    }
    alert("Bulk Handshake Complete: Records updated.");
    setRefreshKey(prev => prev + 1);
  };

  const filters = [
    { label: 'ALL LEADS', status: 'ALL', icon: <ListFilter size={14} /> },
    { label: 'PENDING', status: OrderStatus.PENDING, icon: <Clock size={14} /> },
    { label: 'OPEN LEAD', status: OrderStatus.OPEN_LEAD, icon: <ShoppingBag size={14} /> },
    { label: 'CONFIRMED', status: OrderStatus.CONFIRMED, icon: <CheckCircle size={14} /> },
    { label: 'HOLD', status: OrderStatus.HOLD, icon: <Pause size={14} /> },
    { label: 'NO ANSWER', status: OrderStatus.NO_ANSWER, icon: <PhoneOff size={14} /> },
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
                <h2 className="text-3xl font-black text-black tracking-tighter uppercase leading-none">Selling Terminal</h2>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2">Active Conversion Pipeline</p>
            </div>
        </div>
        <div className="bg-white px-4 py-2.5 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-3">
          <Calendar size={14} className="text-blue-600" />
          <div className="flex items-center gap-2">
            <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} className="text-[10px] font-bold text-slate-900 outline-none uppercase bg-transparent" />
            <span className="text-slate-300 text-[10px] font-black">TO</span>
            <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} className="text-[10px] font-bold text-slate-900 outline-none uppercase bg-transparent" />
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 bg-white p-2.5 rounded-[2.5rem] border border-slate-100 shadow-sm overflow-x-auto no-scrollbar">
        {filters.map((f) => (
          <button
            key={f.status}
            onClick={() => setActiveFilter(f.status as any)}
            className={`flex items-center gap-2 px-6 py-3.5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${
              activeFilter === f.status 
              ? 'bg-black text-white shadow-lg scale-[1.05]' 
              : 'text-slate-400 hover:bg-slate-50 hover:text-black'
            }`}
          >
            {f.icon} {f.label}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-[3rem] border border-slate-100 shadow-sm min-h-[600px] overflow-hidden">
        <OrderList 
          key={`${refreshKey}-${activeFilter}`}
          tenantId={tenantId} 
          onSelectOrder={onSelectOrder} 
          defaultFilter={activeFilter as any}
          productId={selectedProductId}
          startDate={fromDate}
          endDate={toDate}
          onBulkAction={handleBulkShip}
        />
      </div>
    </div>
  );
};