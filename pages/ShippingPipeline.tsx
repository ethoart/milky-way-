
import React, { useState } from 'react';
import { OrderList } from './OrderList';
import { OrderStatus } from '../types';
import { Truck, MapPin, RotateCw, Archive, CheckCircle, Calendar, ListFilter } from 'lucide-react';

interface ShippingPipelineProps {
  tenantId: string;
  onSelectOrder: (id: string) => void;
}

export const ShippingPipeline: React.FC<ShippingPipelineProps> = ({ tenantId, onSelectOrder }) => {
  const [activeFilter, setActiveFilter] = useState<OrderStatus | 'ALL' | 'TODAY_SHIPPED'>('ALL');

  const filters = [
    { label: 'ALL LOGISTICS', status: 'ALL', icon: <ListFilter size={14} /> },
    { label: 'TODAY DISPATCHED', status: 'TODAY_SHIPPED', icon: <Calendar size={14} /> },
    { label: 'SHIPPED', status: OrderStatus.SHIPPED, icon: <Truck size={14} /> },
    { label: 'DELIVERY', status: OrderStatus.DELIVERY, icon: <MapPin size={14} /> },
    { label: 'DELIVERED', status: OrderStatus.DELIVERED, icon: <CheckCircle size={14} /> },
    { label: 'RESIDUAL', status: OrderStatus.RESIDUAL, icon: <RotateCw size={14} /> },
    { label: 'RETURNED', status: OrderStatus.RETURNED, icon: <Archive size={14} /> },
    { label: 'RETURN COMPLETED', status: OrderStatus.RETURN_COMPLETED, icon: <CheckCircle size={14} /> },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-6">
        <div className="flex items-center gap-3">
            <div className="p-3 bg-black text-white rounded-2xl shadow-xl">
                <Truck size={24} />
            </div>
            <div>
                <h2 className="text-3xl font-black text-black tracking-tighter uppercase">Shipping Terminal</h2>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Courier & delivery logistics control</p>
            </div>
        </div>

        <div className="flex flex-wrap gap-2 bg-white p-2 rounded-[2.5rem] border border-slate-100 shadow-sm overflow-x-auto no-scrollbar">
          {filters.map((f) => (
            <button
              key={f.status}
              onClick={() => setActiveFilter(f.status as any)}
              className={`flex items-center gap-2 px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${
                activeFilter === f.status 
                ? 'bg-black text-white shadow-lg scale-[1.05]' 
                : 'text-slate-400 hover:bg-slate-50 hover:text-black'
              }`}
            >
              {f.icon}
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-[3rem] border border-slate-100 shadow-sm min-h-[600px]">
        <OrderList 
          tenantId={tenantId} 
          onSelectOrder={onSelectOrder} 
          defaultFilter={activeFilter as any} 
        />
      </div>
    </div>
  );
};
