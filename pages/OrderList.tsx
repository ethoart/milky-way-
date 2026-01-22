import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../services/mockBackend';
import { Order, OrderStatus } from '../types';
import { formatCurrency } from '../utils/helpers';
import { Search, ChevronRight, Layers, AlertCircle, Zap, ExternalLink, Trash2 } from 'lucide-react';

interface OrderListProps {
  tenantId: string;
  onSelectOrder: (orderId: string) => void;
  defaultFilter?: OrderStatus | 'ALL' | 'TODAY_SHIPPED';
  productId?: string | null;
  startDate?: string;
  endDate?: string;
  logisticsOnly?: boolean; 
}

export const OrderList: React.FC<OrderListProps> = ({ tenantId, onSelectOrder, defaultFilter = 'ALL', productId, startDate, endDate, logisticsOnly = false }) => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [customerHistories, setCustomerHistories] = useState<{[key: string]: any}>({});
  const [activeStatus, setActiveStatus] = useState<OrderStatus | 'ALL' | 'TODAY_SHIPPED'>(defaultFilter);
  const [search, setSearch] = useState('');

  useEffect(() => { setActiveStatus(defaultFilter); }, [defaultFilter]);

  const loadData = async () => {
    const fetchedOrders = await db.getOrders(tenantId);
    setOrders(fetchedOrders);
    const uniquePhones = [...new Set(fetchedOrders.slice(0, 30).map(o => o.customerPhone))];
    const histories: any = {};
    for (const phone of uniquePhones) { histories[phone] = await db.getCustomerHistory(phone, tenantId); }
    setCustomerHistories(prev => ({ ...prev, ...histories }));
  };

  useEffect(() => { loadData(); }, [tenantId]);

  const handleDelete = async (e: React.MouseEvent, orderId: string) => {
    e.stopPropagation();
    if (!confirm("Milky Way: Are you sure you want to permanently delete this lead?")) return;
    await db.deleteOrder(orderId, tenantId);
    loadData();
  };

  const handleAction = async (e: React.MouseEvent, order: Order) => {
    e.stopPropagation();
    
    if (e.ctrlKey) {
      window.open(`/?orderId=${order.id}`, '_blank');
      return;
    }

    if (order.status === OrderStatus.PENDING) {
      const updated = { 
        ...order, 
        status: OrderStatus.OPEN_LEAD, 
        logs: [...(order.logs || []), { 
          id: `l-${Date.now()}`, 
          message: 'Milky Way: Activated Pending Lead', 
          timestamp: new Date().toISOString(), 
          user: 'System' 
        }] 
      };
      await db.updateOrder(updated);
      loadData();
      return;
    }
    
    onSelectOrder(order.id);
  };

  const filteredOrders = useMemo(() => {
    let result = [...orders];

    // LOGISTIC ISOLATION: Only show orders with SHIPPED or later status
    if (logisticsOnly) {
      const logisticStatuses = [
        OrderStatus.SHIPPED, 
        OrderStatus.DELIVERY, 
        OrderStatus.RESIDUAL, 
        OrderStatus.RETURNED, 
        OrderStatus.DELIVERED, 
        OrderStatus.RETURN_COMPLETED
      ];
      result = result.filter(o => logisticStatuses.includes(o.status));
    } else {
      // If not in logistics mode, we might want to hide SHIPPED+ orders in the Selling Pipeline
      // Depending on workflow preference. For now, we allow them in "ALL" but the user requested 
      // logistics section only show after shipping status.
    }

    return result.filter(o => {
      let matchesStatus = activeStatus === 'ALL' || (activeStatus === 'TODAY_SHIPPED' ? (o.shippedAt && new Date(o.shippedAt).toDateString() === new Date().toDateString()) : o.status === activeStatus);
      if (productId && !o.items.some(item => item.productId === productId)) return false;
      const orderDate = new Date(o.createdAt);
      if (startDate && orderDate < new Date(startDate)) return false;
      if (endDate && orderDate > new Date(endDate + 'T23:59:59')) return false;
      const normalizedSearch = search.toLowerCase();
      return matchesStatus && (o.customerName.toLowerCase().includes(normalizedSearch) || o.id.includes(normalizedSearch) || o.customerPhone.includes(normalizedSearch));
    }).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [orders, activeStatus, search, startDate, endDate, productId, logisticsOnly]);

  return (
    <div className="flex flex-col h-full bg-white animate-slide-in">
      <div className="p-5 border-b border-slate-100 flex flex-col md:flex-row items-center justify-between gap-4 bg-slate-50/20">
        <div className="relative flex-1 md:w-80">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input placeholder="Search records..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full bg-white border border-slate-200 pl-11 pr-4 py-3 rounded-2xl outline-none text-[13px] font-bold focus:ring-2 focus:ring-blue-500 transition-all shadow-sm" />
        </div>
        <div className="hidden md:flex items-center gap-2 px-4 py-2 bg-blue-50 rounded-xl border border-blue-100">
            <Layers size={14} className="text-blue-600" />
            <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest">{filteredOrders.length} Records</span>
        </div>
      </div>

      <div className="flex-1 overflow-auto no-scrollbar">
        <table className="w-full text-left compact-table">
          <thead className="sticky top-0 bg-white/95 backdrop-blur-sm z-10 border-b border-slate-100">
            <tr>
              <th className="w-24">Ref</th>
              <th>Client Profile</th>
              <th className="text-center">Intel</th>
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
                <tr key={order.id} className={`hover:bg-slate-50 transition-colors cursor-pointer group ${isHighRisk ? 'bg-rose-50/20' : ''}`} onClick={(e) => handleAction(e, order)}>
                  <td><span className="font-mono text-[10px] font-bold text-slate-400">#{order.id.slice(-6)}</span></td>
                  <td>
                    <div className="flex flex-col">
                      <span className={`text-[13px] font-black tracking-tight ${isHighRisk ? 'text-rose-600' : 'text-slate-900'}`}>{order.customerName}</span>
                      <span className="text-[10px] font-bold text-slate-400 uppercase">{order.customerPhone}</span>
                    </div>
                  </td>
                  <td className="text-center">
                      {isHighRisk ? <div className="bg-rose-100 text-rose-700 px-2 py-0.5 rounded text-[8px] font-black uppercase inline-flex items-center gap-1"><AlertCircle size={10} /> {history.returns} REJ</div> : <span className="text-[10px] font-bold text-slate-300">-</span>}
                  </td>
                  <td><span className="text-sm font-black text-slate-900">{formatCurrency(order.totalAmount)}</span></td>
                  <td className="text-center">
                    <span className={`px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest ${
                      order.status === OrderStatus.PENDING ? 'bg-slate-200 text-slate-600' :
                      order.status === OrderStatus.OPEN_LEAD ? 'bg-sky-500 text-white shadow-sm' :
                      order.status === OrderStatus.CONFIRMED ? 'bg-emerald-600 text-white shadow-sm border border-emerald-500' :
                      order.status === OrderStatus.SHIPPED ? 'bg-indigo-600 text-white shadow-sm' :
                      'bg-slate-100 text-slate-600 border border-slate-200'
                    }`}>{order.status.replace('_', ' ')}</span>
                  </td>
                  <td className="text-right">
                    <div className="flex items-center justify-end gap-2">
                        <button 
                            onClick={(e) => handleDelete(e, order.id)}
                            className="p-2.5 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-all opacity-0 group-hover:opacity-100"
                            title="Delete Registry"
                        >
                            <Trash2 size={16} />
                        </button>
                        <button 
                            onClick={(e) => handleAction(e, order)}
                            className={`p-2.5 rounded-xl transition-all shadow-sm ${order.status === OrderStatus.PENDING ? 'bg-blue-600 text-white' : 'bg-slate-50 text-slate-400 group-hover:text-blue-600 group-hover:bg-blue-50'}`}
                        >
                            {order.status === OrderStatus.PENDING ? <Zap size={16}/> : <ChevronRight size={16}/>}
                        </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};