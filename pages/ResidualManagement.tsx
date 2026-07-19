
import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../services/mockBackend';
import { Order, OrderStatus, Product } from '../types';
import { OrderList } from './OrderList';
import { PhoneForwarded, ListFilter, Pause, RefreshCcw, RefreshCw, Box, ChevronDown, Calendar } from 'lucide-react';
import { getSLDateString } from '../utils/helpers';

interface ResidualManagementProps {
  tenantId: string;
  shopName: string;
  onSelectOrder: (id: string) => void;
}

export const ResidualManagement: React.FC<ResidualManagementProps> = ({ tenantId, shopName, onSelectOrder }) => {
  const [activeFilter, setActiveFilter] = useState<OrderStatus | 'RESIDUAL_ALL'>('RESIDUAL_ALL');
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<string>('ALL');
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [refreshKey, setRefreshKey] = useState(0);

  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  useEffect(() => {
    const fetchData = async () => {
        const fetchedProducts = await db.getProducts(tenantId);
        setProducts(fetchedProducts || []);
        db.getOrderCounts({ tenantId, productId: selectedProductId, startDate, endDate, dateField: "shippedAt" }).then(setCounts);
    };
    fetchData();
  }, [tenantId, refreshKey, selectedProductId, startDate, endDate]);

  const applyPreset = (preset: 'TODAY' | 'WEEK' | 'MONTH' | 'YEAR') => {
    const end = new Date();
    const start = new Date();
    if (preset === 'WEEK') start.setDate(end.getDate() - 7);
    if (preset === 'MONTH') {
        start.setDate(1);
        end.setMonth(end.getMonth() + 1);
        end.setDate(0);
    }
    if (preset === 'YEAR') start.setFullYear(end.getFullYear() - 1);
    
    setStartDate(getSLDateString(start));
    setEndDate(getSLDateString(end));
  };

  const filteredCounts = { 
    ALL: (counts[OrderStatus.RESIDUAL] || 0) + (counts[OrderStatus.REARRANGE] || 0) + (counts[OrderStatus.HOLD] || 0),
    RESIDUAL: counts[OrderStatus.RESIDUAL] || 0,
    REARRANGE: counts[OrderStatus.REARRANGE] || 0,
    HOLD: counts[OrderStatus.HOLD] || 0
  };

  const filters = [
    { label: 'ALL RESIDUALS', status: 'RESIDUAL_ALL', icon: <ListFilter size={14}/>, count: filteredCounts.ALL },
    { label: 'DELIVERY PENDING', status: OrderStatus.RESIDUAL, icon: <PhoneForwarded size={14}/>, count: filteredCounts.RESIDUAL, color: 'text-amber-500' },
    { label: 'REARRANGE', status: OrderStatus.REARRANGE, icon: <RefreshCcw size={14}/>, count: filteredCounts.REARRANGE, color: 'text-blue-500' },
    { label: 'HOLD', status: OrderStatus.HOLD, icon: <Pause size={14}/>, count: filteredCounts.HOLD, color: 'text-purple-500' },
  ];

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto animate-slide-in px-2">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="flex items-center gap-3">
            <div className="p-3 bg-amber-500 text-white rounded-2xl shadow-xl"><PhoneForwarded size={24} /></div>
            <div>
                <h2 className="text-3xl font-black text-black uppercase leading-none tracking-tight">{shopName} Residual</h2>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2">Delivery Re-Engagement</p>
            </div>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 bg-white px-4 py-2.5 rounded-2xl border border-slate-100 shadow-sm">
                <Calendar size={14} className="text-blue-600" />
                <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="text-[10px] font-bold outline-none bg-transparent uppercase" />
                <span className="text-[10px] font-black text-slate-300 mx-1">TO</span>
                <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="text-[10px] font-bold outline-none bg-transparent uppercase" />
            </div>

            <div className="bg-white px-4 py-2.5 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-3 relative min-w-[200px]">
                <Box size={14} className="text-blue-600" />
                <select value={selectedProductId} onChange={e => setSelectedProductId(e.target.value)} className="w-full text-[10px] font-black text-slate-900 outline-none uppercase bg-transparent cursor-pointer appearance-none">
                    <option value="ALL">ALL PRODUCTS</option>
                    {products.map(p => <option key={p.id} value={p.id}>{p.sku} - {p.name}</option>)}
                </select>
                <ChevronDown size={12} className="absolute right-4 text-slate-400 pointer-events-none" />
            </div>

            <button onClick={() => setRefreshKey(prev => prev + 1)} className="p-3 bg-white border border-slate-200 rounded-xl text-slate-400 hover:text-slate-900 shadow-sm transition-all">
                <RefreshCw size={18} />
            </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 bg-white p-2.5 rounded-[2.5rem] border border-slate-100 shadow-sm overflow-x-auto no-scrollbar">
        {filters.map((f) => (
          <button 
            key={f.status} 
            onClick={() => setActiveFilter(f.status as any)} 
            className={`flex items-center gap-2 px-5 py-3.5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${activeFilter === f.status ? 'bg-amber-500 text-white shadow-lg' : 'bg-slate-50 text-slate-400 hover:bg-slate-100'}`}
          >
            <span className={activeFilter === f.status ? 'text-white' : f.color}>{f.icon}</span> {f.label}
            <span className={`ml-2 px-2 py-0.5 rounded-full text-[9px] ${activeFilter === f.status ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-600'}`}>{f.count}</span>
          </button>
        ))}
      </div>

      <div className="bg-white rounded-[3rem] border border-slate-100 shadow-sm min-h-[600px] overflow-hidden">
        <OrderList 
          key={refreshKey}
          tenantId={tenantId} 
          onSelectOrder={onSelectOrder} 
          status={activeFilter}
          productId={selectedProductId === 'ALL' ? null : selectedProductId}
          startDate={startDate}
          endDate={endDate}
          onRefresh={() => setRefreshKey(prev => prev + 1)}
        />
      </div>
    </div>
  );
};

