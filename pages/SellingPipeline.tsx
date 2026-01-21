
import React, { useState } from 'react';
import { OrderList } from './OrderList';
import { OrderStatus } from '../types';
import { ShoppingBag, CheckCircle, Clock, XCircle, Pause, PhoneOff, ListFilter } from 'lucide-react';

interface SellingPipelineProps {
  tenantId: string;
  onSelectOrder: (id: string) => void;
}

export const SellingPipeline: React.FC<SellingPipelineProps> = ({ tenantId, onSelectOrder }) => {
  const [activeFilter, setActiveFilter] = useState<OrderStatus | 'ALL'>('ALL');

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
    <div className="space-y-6">
      <div className="flex flex-col gap-6">
        <div className="flex items-center gap-3 px-2">
            <div className="p-3 bg-blue-600 text-white rounded-2xl shadow-xl shadow-blue-200">
                <ShoppingBag size={24} />
            </div>
            <div>
                <h2 className="text-3xl font-black text-black tracking-tighter uppercase">Selling Terminal</h2>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Active Conversion Pipeline</p>
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
      </div>

      <div className="bg-white rounded-[3rem] border border-slate-100 shadow-sm min-h-[600px] overflow-hidden">
        <OrderList 
          tenantId={tenantId} 
          onSelectOrder={onSelectOrder} 
          defaultFilter={activeFilter as any} 
        />
      </div>
    </div>
  );
};
