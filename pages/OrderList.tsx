
import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../services/mockBackend';
import { Order, OrderStatus } from '../types';
import { formatCurrency } from '../utils/helpers';
import { Search, Calendar, Filter, User, Package, Clock, ChevronRight, Layers, AlertCircle, ShieldCheck } from 'lucide-react';

interface OrderListProps {
  tenantId: string;
  onSelectOrder: (orderId: string) => void;
  defaultFilter?: OrderStatus | 'ALL' | 'TODAY_SHIPPED';
}

export const OrderList: React.FC<OrderListProps> = ({ tenantId, onSelectOrder, defaultFilter = 'ALL' }) => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [customerHistories, setCustomerHistories] = useState<{[key: string]: any}>({});
  const [activeStatus, setActiveStatus] = useState<OrderStatus | 'ALL' | 'TODAY_SHIPPED'>(defaultFilter);
  const [search, setSearch] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  useEffect(() => { setActiveStatus(defaultFilter); }, [defaultFilter]);

  const loadData = async () => {
    const fetchedOrders = await db.getOrders(tenantId);
    setOrders(fetchedOrders);
    
    // Batch load history using last 9 digits of phone
    const uniquePhones = [...new Set(fetchedOrders.map(o => o.customerPhone))];
    const histories: any = {};
    for (const phone of uniquePhones) {
       const h = await db.getCustomerHistory(phone, tenantId);
       histories[phone] = h;
    }
    setCustomerHistories(histories);
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
  }, [tenantId]);

  const filteredOrders = useMemo(() => {
    return [...orders]
      .filter(o => {
        let matchesStatus = activeStatus === 'ALL' || (activeStatus === 'TODAY_SHIPPED' ? (o.shippedAt && new Date(o.shippedAt).toDateString() === new Date().toDateString()) : o.status === activeStatus);
        const orderDate = new Date(o.createdAt);
        if (fromDate && orderDate < new Date(fromDate)) return false;
        if (toDate && orderDate > new Date(toDate + 'T23:59:59')) return false;
        const normalizedSearch = search.toLowerCase();
        const matchesSearch = o.customerName.toLowerCase().includes(normalizedSearch) || o.id.includes(normalizedSearch) || o.customerPhone.includes(normalizedSearch);
        return matchesStatus && matchesSearch;
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [orders, activeStatus, search, fromDate, toDate]);

  return (
    <div className="flex flex-col h-full bg-white animate-slide-in">
      <div className="p-5 border-b border-slate-100 flex flex-col md:flex-row items-center justify-between gap-4 bg-slate-50/20">
        <div className="flex items-center gap-4 w-full md:w-auto">
            <div className="relative flex-1 md:w-80">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input 
                    placeholder="Search by name, ID or phone..." 
                    value={search} 
                    onChange={(e) => setSearch(e.target.value)} 
                    className="w-full bg-white border border-slate-200 pl-11 pr-4 py-3 rounded-2xl outline-none text-[13px] font-bold focus:ring-2 focus:ring-blue-500 transition-all shadow-sm" 
                />
            </div>
            <div className="hidden md:flex items-center gap-2 px-4 py-2 bg-blue-50 rounded-xl border border-blue-100">
                <Layers size={14} className="text-blue-600" />
                <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest">{filteredOrders.length} Records</span>
            </div>
        </div>
        
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar w-full md:w-auto">
          <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-xl border border-slate-200 shadow-sm">
            <Calendar size={14} className="text-slate-400" />
            <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} className="bg-transparent text-[10px] font-bold outline-none uppercase text-slate-600" />
          </div>
          <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-xl border border-slate-200 shadow-sm">
            <Calendar size={14} className="text-slate-400" />
            <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} className="bg-transparent text-[10px] font-bold outline-none uppercase text-slate-600" />
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto no-scrollbar">
        <table className="w-full text-left compact-table">
          <thead className="sticky top-0 bg-white/95 backdrop-blur-sm z-10 border-b border-slate-100 shadow-sm">
            <tr>
              <th className="w-24">Invoice</th>
              <th>Client Profile</th>
              <th className="text-center">History</th>
              <th className="text-center">Qty</th>
              <th>Total</th>
              <th className="text-center">Status</th>
              <th className="text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredOrders.map((order) => {
              const history = customerHistories[order.customerPhone];
              const isHighRisk = history?.returns > 0;
              const isLoyal = history?.count > 3 && history?.returns === 0;

              return (
                <tr 
                  key={order.id} 
                  className={`hover:bg-slate-50 transition-colors cursor-pointer group ${isHighRisk ? 'bg-rose-50/20' : ''}`} 
                  onClick={() => onSelectOrder(order.id)}
                >
                  <td>
                    <span className="font-mono text-[10px] font-bold text-slate-400 uppercase tracking-tighter">#{order.id.slice(-6)}</span>
                  </td>
                  <td>
                    <div className="flex flex-col">
                      <span className={`text-[13px] font-black tracking-tight group-hover:text-blue-600 transition-colors ${isHighRisk ? 'text-rose-600' : 'text-slate-900'}`}>{order.customerName}</span>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{order.customerPhone}</span>
                    </div>
                  </td>
                  <td className="text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        {isHighRisk && (
                          <div className="flex items-center gap-1 bg-rose-100 text-rose-700 px-2 py-0.5 rounded text-[8px] font-black uppercase shadow-sm">
                            <AlertCircle size={10} /> {history.returns} REJ
                          </div>
                        )}
                        {isLoyal && (
                          <div className="flex items-center gap-1 bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded text-[8px] font-black uppercase shadow-sm">
                            <ShieldCheck size={10} /> VIP
                          </div>
                        )}
                        {history?.count > 0 && !isHighRisk && !isLoyal && (
                            <span className="text-[8px] font-black text-blue-600 bg-blue-50 px-2 py-0.5 rounded uppercase">ORDERED {history.count}x</span>
                        )}
                        {!history?.count && <span className="text-[8px] font-bold text-slate-300 uppercase">NEW</span>}
                      </div>
                  </td>
                  <td className="text-center">
                    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-100 text-[10px] font-black text-slate-600">
                      {order.items.reduce((s, i) => s + i.quantity, 0)}
                    </span>
                  </td>
                  <td>
                    <span className="text-sm font-black text-slate-900">{formatCurrency(order.totalAmount)}</span>
                  </td>
                  <td className="text-center">
                    <span className={`px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest shadow-sm ${
                      order.status === OrderStatus.DELIVERED ? 'bg-emerald-600 text-white' :
                      order.status === OrderStatus.CONFIRMED ? 'bg-emerald-600 text-white' :
                      order.status === OrderStatus.PENDING ? 'bg-blue-600 text-white' :
                      order.status === OrderStatus.OPEN_LEAD ? 'bg-sky-500 text-white' :
                      order.status === OrderStatus.NO_ANSWER ? 'bg-amber-500 text-white' :
                      order.status === OrderStatus.HOLD ? 'bg-purple-600 text-white' :
                      order.status === OrderStatus.REJECTED ? 'bg-rose-600 text-white' :
                      'bg-slate-100 text-slate-600 border border-slate-200'
                    }`}>
                      {order.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="text-right">
                    <div className="flex items-center justify-end text-slate-300 group-hover:text-blue-600 transition-all transform group-hover:translate-x-1">
                      <ChevronRight size={18} />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filteredOrders.length === 0 && (
          <div className="p-32 flex flex-col items-center justify-center text-slate-300">
            <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-6">
                <Package size={32} className="opacity-20" />
            </div>
            <p className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-400">Empty Segment Log</p>
          </div>
        )}
      </div>
    </div>
  );
};
