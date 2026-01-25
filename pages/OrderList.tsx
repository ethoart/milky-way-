
import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../services/mockBackend';
import { Order, OrderStatus } from '../types';
import { formatCurrency } from '../utils/helpers';
import { Search, ChevronRight, Layers, AlertCircle, Zap, Trash2, CheckSquare, Square, Truck, Loader2, Printer } from 'lucide-react';

interface OrderListProps {
  tenantId: string;
  onSelectOrder: (orderId: string) => void;
  defaultFilter?: OrderStatus | 'ALL' | 'TODAY_SHIPPED';
  productId?: string | null;
  startDate?: string;
  endDate?: string;
  logisticsOnly?: boolean;
  onBulkAction?: (orderIds: string[]) => void;
}

export const OrderList: React.FC<OrderListProps> = ({ 
  tenantId, onSelectOrder, defaultFilter = 'ALL', productId, startDate, endDate, logisticsOnly = false, onBulkAction 
}) => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [customerHistories, setCustomerHistories] = useState<{[key: string]: any}>({});
  const [activeStatus, setActiveStatus] = useState<OrderStatus | 'ALL' | 'TODAY_SHIPPED'>(defaultFilter);
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => { 
    setActiveStatus(defaultFilter); 
    setSelectedIds([]); 
  }, [defaultFilter]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const fetchedOrders = await db.getOrders(tenantId);
      setOrders(fetchedOrders);
      
      const uniquePhones = [...new Set(fetchedOrders.slice(0, 30).map(o => o.customerPhone))];
      const historyPromises = uniquePhones.map(async (phone) => {
        const h = await db.getCustomerHistory(phone, tenantId);
        return { phone, h };
      });
      
      const results = await Promise.all(historyPromises);
      const historyMap: any = {};
      results.forEach(res => historyMap[res.phone] = res.h);
      setCustomerHistories(historyMap);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { loadData(); }, [tenantId]);

  const filteredOrders = useMemo(() => {
    let result = [...orders];
    if (logisticsOnly) {
      const logicSts = [OrderStatus.SHIPPED, OrderStatus.DELIVERY, OrderStatus.RESIDUAL, OrderStatus.RETURNED, OrderStatus.DELIVERED, OrderStatus.RETURN_COMPLETED];
      result = result.filter(o => logicSts.includes(o.status));
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

  const handleOrderClick = async (order: Order) => {
    if (order.status === OrderStatus.PENDING) {
        const currentUser = localStorage.getItem('mw_user') ? JSON.parse(localStorage.getItem('mw_user')!).username : 'System';
        const updated: Order = {
            ...order,
            status: OrderStatus.OPEN_LEAD,
            openedBy: currentUser,
            logs: [...(order.logs || []), { id: `log-view-${Date.now()}`, message: `Node Opened for Processing by ${currentUser}`, timestamp: new Date().toISOString(), user: currentUser }]
        };
        await db.updateOrder(updated);
    }
    onSelectOrder(order.id);
  };

  const toggleSelect = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const toggleAll = () => {
    setSelectedIds(selectedIds.length === filteredOrders.length ? [] : filteredOrders.map(o => o.id));
  };

  const handleDelete = async (e: React.MouseEvent, orderId: string) => {
    e.stopPropagation();
    if (!confirm("Confirm Record Destruction?")) return;
    await db.deleteOrder(orderId, tenantId);
    loadData();
  };

  const getStatusColor = (status: OrderStatus) => {
    switch(status) {
      case OrderStatus.PENDING: return 'bg-blue-600 text-white';
      case OrderStatus.OPEN_LEAD: return 'bg-sky-400 text-white';
      case OrderStatus.CONFIRMED: return 'bg-emerald-600 text-white';
      case OrderStatus.HOLD: return 'bg-purple-600 text-white';
      case OrderStatus.NO_ANSWER: return 'bg-yellow-500 text-white';
      case OrderStatus.REJECTED: return 'bg-rose-600 text-white';
      case OrderStatus.SHIPPED: return 'bg-indigo-600 text-white';
      default: return 'bg-slate-200 text-slate-600';
    }
  };

  return (
    <div className="flex flex-col h-full bg-white animate-slide-in relative">
      {selectedIds.length > 0 && (
        <div className="absolute top-0 left-0 right-0 z-20 bg-slate-900 text-white p-4 flex items-center justify-between animate-slide-in shadow-2xl rounded-b-2xl">
          <div className="flex items-center gap-4 pl-4">
            <span className="text-xs font-black uppercase tracking-widest">{selectedIds.length} Records Locked</span>
          </div>
          <div className="flex gap-2">
            {onBulkAction && (
              <button 
                onClick={() => { onBulkAction(selectedIds); setSelectedIds([]); }} 
                className="bg-blue-600 px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 hover:bg-blue-700 transition-all shadow-lg"
              >
                {activeStatus === OrderStatus.CONFIRMED ? <Truck size={14} /> : <Printer size={14} />} 
                {activeStatus === OrderStatus.CONFIRMED ? 'Dispatch Selection' : 'Print Selection'}
              </button>
            )}
            <button 
              onClick={async () => {
                if (!confirm(`Purge ${selectedIds.length} records?`)) return;
                for (const id of selectedIds) await db.deleteOrder(id, tenantId);
                setSelectedIds([]);
                loadData();
              }}
              className="bg-rose-600 px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 hover:bg-rose-700 transition-all"
            >
              <Trash2 size={14} /> Delete
            </button>
            <button onClick={() => setSelectedIds([])} className="bg-white/10 px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-white/20 transition-all">Dismiss</button>
          </div>
        </div>
      )}

      <div className="p-5 border-b border-slate-100 flex flex-col md:flex-row items-center justify-between gap-4 bg-slate-50/20">
        <div className="relative flex-1 md:w-80">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input placeholder="Search identifiers..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full bg-white border border-slate-200 pl-11 pr-4 py-3 rounded-2xl outline-none text-[13px] font-bold focus:ring-2 focus:ring-blue-500 transition-all shadow-sm" />
        </div>
        <div className="flex items-center gap-3">
          <button onClick={toggleAll} className="flex items-center gap-2 px-4 py-2 bg-slate-100 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-600 hover:bg-slate-200 transition-all">
            {selectedIds.length === filteredOrders.length ? <CheckSquare size={14}/> : <Square size={14}/>} {selectedIds.length === filteredOrders.length ? 'Deselect' : 'Select All'}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto no-scrollbar">
        <table className="w-full text-left compact-table">
          <thead className="sticky top-0 bg-white/95 backdrop-blur-sm z-10 border-b border-slate-100">
            <tr>
              <th className="w-12"></th>
              <th className="w-24">Node</th>
              <th>Identity</th>
              <th className="text-center">Risk</th>
              <th>Amount</th>
              <th className="text-center">Pipeline</th>
              <th className="text-right pr-6">Action</th>
            </tr>
          </thead>
          <tbody className={`divide-y divide-slate-100 ${isLoading ? 'opacity-50' : ''}`}>
            {filteredOrders.map((order) => {
              const history = customerHistories[order.customerPhone];
              const isSelected = selectedIds.includes(order.id);
              const isHighRisk = history?.returns > 0;
              return (
                <tr key={order.id} className={`hover:bg-slate-50 transition-colors cursor-pointer group ${isSelected ? 'bg-blue-50/50' : ''}`} onClick={() => handleOrderClick(order)}>
                  <td onClick={(e) => toggleSelect(e, order.id)} className="text-center">
                    <div className={`p-1 transition-all ${isSelected ? 'text-blue-600' : 'text-slate-300'}`}>
                      {isSelected ? <CheckSquare size={18}/> : <Square size={18}/>}
                    </div>
                  </td>
                  <td><span className="font-mono text-[10px] font-bold text-slate-400">#{order.id.slice(-6)}</span></td>
                  <td>
                    <div className="flex flex-col">
                      <span className={`text-[13px] font-black tracking-tight ${isHighRisk ? 'text-rose-600' : 'text-slate-900'} uppercase`}>{order.customerName}</span>
                      <span className="text-[10px] font-bold text-slate-400">{order.customerPhone}</span>
                    </div>
                  </td>
                  <td className="text-center">
                      {isHighRisk ? <div className="bg-rose-100 text-rose-700 px-2 py-0.5 rounded text-[8px] font-black uppercase inline-flex items-center gap-1"><AlertCircle size={10} /> {history.returns} REJ</div> : <span className="text-[10px] font-bold text-slate-300">-</span>}
                  </td>
                  <td><span className="text-sm font-black text-slate-900">{formatCurrency(order.totalAmount)}</span></td>
                  <td className="text-center">
                    <span className={`px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest shadow-sm border border-black/5 ${getStatusColor(order.status)}`}>
                      {order.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="text-right pr-6">
                    <div className="flex items-center justify-end gap-2">
                        <button onClick={(e) => handleDelete(e, order.id)} className="p-2.5 rounded-xl text-slate-300 hover:text-rose-600 hover:bg-rose-50 transition-all opacity-0 group-hover:opacity-100"><Trash2 size={16} /></button>
                        <button className="p-2.5 rounded-xl bg-slate-50 text-slate-400 group-hover:text-blue-600 group-hover:bg-blue-50 transition-all"><ChevronRight size={16}/></button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filteredOrders.length === 0 && !isLoading && (
          <div className="p-32 text-center opacity-20 uppercase font-black text-xs tracking-[0.5em] flex flex-col items-center gap-6">
            <Zap size={60} strokeWidth={1} />
            Logs Empty
          </div>
        )}
      </div>
    </div>
  );
};
