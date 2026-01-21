import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../services/mockBackend';
import { Order, OrderStatus } from '../types';
import { formatCurrency } from '../utils/helpers';
import { Search, Calendar, User, Package, ChevronRight, Layers, AlertCircle, ShieldCheck } from 'lucide-react';

interface OrderListProps {
  tenantId: string;
  onSelectOrder: (orderId: string) => void;
  defaultFilter?: OrderStatus | 'ALL' | 'TODAY_SHIPPED';
  productId?: string | null;
  startDate?: string;
  endDate?: string;
}

export const OrderList: React.FC<OrderListProps> = ({ tenantId, onSelectOrder, defaultFilter = 'ALL', productId, startDate, endDate }) => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [customerHistories, setCustomerHistories] = useState<{[key: string]: any}>({});
  const [activeStatus, setActiveStatus] = useState<OrderStatus | 'ALL' | 'TODAY_SHIPPED'>(defaultFilter);
  const [search, setSearch] = useState('');

  useEffect(() => { setActiveStatus(defaultFilter); }, [defaultFilter]);

  const loadData = async () => {
    const fetchedOrders = await db.getOrders(tenantId);
    setOrders(fetchedOrders);
    
    // Simple lazy loading of history for current list
    const uniquePhones = [...new Set(fetchedOrders.slice(0, 50).map(o => o.customerPhone))];
    const histories: any = {};
    for (const phone of uniquePhones) {
       const h = await db.getCustomerHistory(phone, tenantId);
       histories[phone] = h;
    }
    setCustomerHistories(prev => ({ ...prev, ...histories }));
  };

  useEffect(() => { loadData(); }, [tenantId]);

  const filteredOrders = useMemo(() => {
    return [...orders]
      .filter(o => {
        let matchesStatus = activeStatus === 'ALL' || (activeStatus === 'TODAY_SHIPPED' ? (o.shippedAt && new Date(o.shippedAt).toDateString() === new Date().toDateString()) : o.status === activeStatus);
        
        // Product Filter
        if (productId && !o.items.some(item => item.productId === productId)) return false;

        // Date Filtering
        const orderDate = new Date(o.createdAt);
        if (startDate && orderDate < new Date(startDate)) return false;
        if (endDate && orderDate > new Date(endDate + 'T23:59:59')) return false;

        const normalizedSearch = search.toLowerCase();
        const matchesSearch = o.customerName.toLowerCase().includes(normalizedSearch) || o.id.includes(normalizedSearch) || o.customerPhone.includes(normalizedSearch);
        
        return matchesStatus && matchesSearch;
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [orders, activeStatus, search, startDate, endDate, productId]);

  return (
    <div className="flex flex-col h-full bg-white animate-slide-in">
      <div className="p-5 border-b border-slate-100 flex flex-col md:flex-row items-center justify-between gap-4 bg-slate-50/20">
        <div className="relative flex-1 md:w-80">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input placeholder="Search records..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full bg-white border border-slate-200 pl-11 pr-4 py-3 rounded-2xl outline-none text-[13px] font-bold focus:ring-2 focus:ring-blue-500 transition-all shadow-sm" />
        </div>
        <div className="hidden md:flex items-center gap-2 px-4 py-2 bg-blue-50 rounded-xl border border-blue-100">
            <Layers size={14} className="text-blue-600" />
            <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest">{filteredOrders.length} Records In Grid</span>
        </div>
      </div>

      <div className="flex-1 overflow-auto no-scrollbar">
        <table className="w-full text-left compact-table">
          <thead className="sticky top-0 bg-white/95 backdrop-blur-sm z-10 border-b border-slate-100">
            <tr>
              <th className="w-24">Invoice</th>
              <th>Client Profile</th>
              <th className="text-center">Intel</th>
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
              return (
                <tr key={order.id} className={`hover:bg-slate-50 transition-colors cursor-pointer group ${isHighRisk ? 'bg-rose-50/20' : ''}`} onClick={() => onSelectOrder(order.id)}>
                  <td><span className="font-mono text-[10px] font-bold text-slate-400">#{order.id.slice(-6)}</span></td>
                  <td>
                    <div className="flex flex-col">
                      <span className={`text-[13px] font-black tracking-tight ${isHighRisk ? 'text-rose-600' : 'text-slate-900'}`}>{order.customerName}</span>
                      <span className="text-[10px] font-bold text-slate-400 uppercase">{order.customerPhone}</span>
                    </div>
                  </td>
                  <td className="text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        {isHighRisk && <div className="bg-rose-100 text-rose-700 px-2 py-0.5 rounded text-[8px] font-black uppercase"><AlertCircle size={10} /> {history.returns} REJ</div>}
                        {history?.count > 3 && !isHighRisk && <div className="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded text-[8px] font-black uppercase">LOYAL</div>}
                      </div>
                  </td>
                  <td className="text-center"><span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-100 text-[10px] font-black text-slate-600">{order.items.reduce((s, i) => s + i.quantity, 0)}</span></td>
                  <td><span className="text-sm font-black text-slate-900">{formatCurrency(order.totalAmount)}</span></td>
                  <td className="text-center">
                    <span className={`px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest ${
                      order.status === OrderStatus.DELIVERED ? 'bg-emerald-600 text-white' :
                      order.status === OrderStatus.CONFIRMED ? 'bg-emerald-600 text-white' :
                      order.status === OrderStatus.PENDING ? 'bg-blue-600 text-white' :
                      order.status === OrderStatus.OPEN_LEAD ? 'bg-sky-500 text-white' :
                      order.status === OrderStatus.NO_ANSWER ? 'bg-amber-500 text-white' :
                      'bg-slate-100 text-slate-600 border border-slate-200'
                    }`}>{order.status.replace('_', ' ')}</span>
                  </td>
                  <td className="text-right text-slate-300 group-hover:text-blue-600"><ChevronRight size={18} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};