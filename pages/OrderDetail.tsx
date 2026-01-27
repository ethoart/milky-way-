
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import { db } from '../services/mockBackend';
import { Order, OrderStatus, OrderLog, Product, Tenant, CourierMode } from '../types';
import { 
  ArrowLeft, Truck, Check, Clock, User as UserIcon, Save, 
  Activity, AlertCircle, Pause, MapPin, Package, Trash2, Plus, Printer, RefreshCcw, MessageSquare, Zap
} from 'lucide-react';
import { formatCurrency } from '../utils/helpers';
import { LabelPrintView } from '../components/LabelPrintView';

interface OrderDetailProps {
  orderId: string;
  tenantId: string;
  onBack: () => void;
}

export const OrderDetail: React.FC<OrderDetailProps> = ({ orderId, tenantId, onBack }) => {
  const [order, setOrder] = useState<Order | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [loading, setLoading] = useState(true);
  const [shippingLoading, setShippingLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [callNote, setCallNote] = useState('');

  const [localFormData, setLocalFormData] = useState({ 
    customerName: '', 
    customerPhone: '', 
    customerAddress: '', 
    customerCity: '', 
    parcelWeight: '1', 
    parcelDescription: '',
    trackingNumber: ''
  });
  
  const [items, setItems] = useState<{ productId: string; quantity: number; price: number; name: string }[]>([]);

  const loadData = useCallback(async () => {
    setLoading(true);
    const [data, fetchedProducts, fetchedTenant] = await Promise.all([
      db.getOrder(orderId, tenantId),
      db.getProducts(tenantId),
      db.getTenant(tenantId)
    ]);
    
    if (data) {
      setOrder(data);
      setProducts(fetchedProducts);
      setTenant(fetchedTenant || null);
      setLocalFormData({ 
        customerName: data.customerName || '', 
        customerPhone: data.customerPhone || '', 
        customerAddress: data.customerAddress || '', 
        customerCity: data.customerCity || '', 
        parcelWeight: data.parcelWeight || '1', 
        parcelDescription: data.parcelDescription || '',
        trackingNumber: data.trackingNumber || ''
      });
      setItems(data.items || []);
    }
    setLoading(false);
  }, [orderId, tenantId]);

  useEffect(() => { loadData(); }, [loadData]);

  const totalAmount = useMemo(() => {
    return items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  }, [items]);

  const handlePrintBill = () => {
    if (!order || !tenant) return;
    const printContainer = document.createElement('div');
    printContainer.className = 'print-only';
    document.body.appendChild(printContainer);
    const root = createRoot(printContainer);
    root.render(<LabelPrintView orders={[{...order, ...localFormData, items, totalAmount}]} settings={tenant.settings} />);
    setTimeout(() => {
        window.print();
        root.unmount();
        document.body.removeChild(printContainer);
    }, 500);
  };

  const handleAddCallNote = async () => {
    if (!order || !callNote.trim()) return;
    const user = localStorage.getItem('mw_user') ? JSON.parse(localStorage.getItem('mw_user')!).username : 'System';
    const log: OrderLog = { 
      id: `call-${Date.now()}`, 
      message: `CALL NOTE: ${callNote}`, 
      timestamp: new Date().toISOString(), 
      user 
    };
    await db.updateOrder({ ...order, logs: [...(order.logs || []), log] });
    setCallNote('');
    loadData();
  };

  const updateStatus = async (newStatus: OrderStatus) => {
    if (!order) return;
    
    if (newStatus === OrderStatus.CONFIRMED) {
      if (!localFormData.customerPhone || localFormData.customerPhone.trim().length < 9) return alert("Phone Required.");
      if (items.length === 0) return alert("Manifest is empty.");
    }

    if (newStatus === OrderStatus.SHIPPED) {
      if (tenant?.settings.courierMode === CourierMode.EXISTING_WAYBILL && !localFormData.trackingNumber) {
          return alert("Existing Waybill ID is required to dispatch.");
      }
      setShippingLoading(true);
      try { 
        await db.shipOrder({ ...order, ...localFormData, items, totalAmount }, tenantId);
        loadData();
      } catch (e: any) { alert(e.message); } 
      finally { setShippingLoading(false); }
      return;
    }

    const log: OrderLog = { 
      id: `l-${Date.now()}`, 
      message: `Status Changed to ${newStatus}`, 
      timestamp: new Date().toISOString(), 
      user: localStorage.getItem('mw_user') ? JSON.parse(localStorage.getItem('mw_user')!).username : 'System'
    };
    
    setIsSaving(true);
    await db.updateOrder({ ...order, ...localFormData, items, totalAmount, status: newStatus, logs: [...(order.logs || []), log] });
    setIsSaving(false);
    loadData();
  };

  const getBtnColor = (status: OrderStatus) => {
    if (order?.status === status) {
        switch(status) {
          case OrderStatus.PENDING: return 'bg-blue-600 text-white shadow-lg';
          case OrderStatus.OPEN_LEAD: return 'bg-sky-400 text-white shadow-lg';
          case OrderStatus.CONFIRMED: return 'bg-emerald-600 text-white shadow-lg';
          case OrderStatus.HOLD: return 'bg-purple-600 text-white shadow-lg';
          case OrderStatus.NO_ANSWER: return 'bg-yellow-500 text-white shadow-lg';
          case OrderStatus.REJECTED: return 'bg-rose-600 text-white shadow-lg';
          case OrderStatus.RESIDUAL: return 'bg-slate-900 text-white shadow-lg';
          case OrderStatus.REARRANGE: return 'bg-indigo-600 text-white shadow-lg';
          default: return 'bg-blue-600 text-white shadow-lg';
        }
    }
    return 'bg-slate-50 text-slate-400 hover:text-slate-600';
  };

  if (loading || !order) return <div className="p-20 text-center font-black uppercase text-slate-300 text-xs tracking-widest">Synchronizing Node...</div>;

  const isExistingMode = tenant?.settings.courierMode === CourierMode.EXISTING_WAYBILL;

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-20 animate-slide-in no-print">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
                <button onClick={onBack} className="p-4 bg-white border border-slate-100 rounded-3xl text-black shadow-sm hover:bg-slate-50 transition-all"><ArrowLeft size={20} /></button>
                <div>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight uppercase">Order #{order.id.slice(-6)}</h1>
                    <div className="text-[10px] font-black text-blue-600 uppercase tracking-widest mt-1">{order.status} • {formatCurrency(totalAmount)}</div>
                </div>
            </div>
            <div className="flex gap-2">
                <button 
                    onClick={handlePrintBill}
                    className="bg-white border border-slate-200 text-slate-900 px-6 py-4 rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-sm flex items-center gap-3 hover:bg-slate-50 transition-all active:scale-95"
                >
                    <Printer size={16} /> Print 2x3 Bill
                </button>
                <button onClick={async () => {
                    setIsSaving(true);
                    await db.updateOrder({ ...order, ...localFormData, items, totalAmount });
                    setIsSaving(false);
                    alert("Node Synchronized.");
                }} className="bg-black text-white px-8 py-4 rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-xl flex items-center gap-3 active:scale-95 transition-all">
                    {isSaving ? <RefreshCcw size={16} className="animate-spin" /> : <Save size={16} />} Force Save
                </button>
            </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-8">
                <div className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-sm space-y-6">
                    <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><Activity size={16}/> Command Protocol</h3>
                    
                    {isExistingMode && order.status === OrderStatus.CONFIRMED && (
                        <div className="bg-indigo-50 border border-indigo-100 p-6 rounded-[2rem] space-y-3">
                            <p className="text-[10px] font-black text-indigo-600 uppercase tracking-widest flex items-center gap-2">
                                <Zap size={14} /> Assign Waybill for Existing Stock
                            </p>
                            <input 
                                className="w-full bg-white border-2 border-indigo-200 rounded-xl px-4 py-3 font-mono font-bold text-slate-900 outline-none focus:border-indigo-600"
                                value={localFormData.trackingNumber}
                                onChange={e => setLocalFormData({...localFormData, trackingNumber: e.target.value})}
                                placeholder="Scan or Enter Waybill ID..."
                            />
                        </div>
                    )}

                    <div className="flex flex-wrap gap-2">
                        {[OrderStatus.OPEN_LEAD, OrderStatus.HOLD, OrderStatus.NO_ANSWER, OrderStatus.REJECTED, OrderStatus.RESIDUAL, OrderStatus.REARRANGE].map(s => (
                           <button key={s} onClick={() => updateStatus(s)} className={`px-5 py-3 rounded-2xl font-black text-[10px] uppercase transition-all ${getBtnColor(s)}`}>{s.replace('_', ' ')}</button>
                        ))}
                        <button onClick={() => updateStatus(OrderStatus.CONFIRMED)} className={`px-8 py-3 rounded-2xl font-black text-[10px] uppercase shadow-xl transition-all ${order.status === OrderStatus.CONFIRMED ? 'bg-emerald-600 text-white' : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'}`}>Confirm Order</button>
                        {(order.status === OrderStatus.CONFIRMED || order.status === OrderStatus.SHIPPED) && (
                             <button onClick={() => updateStatus(OrderStatus.SHIPPED)} disabled={shippingLoading} className="bg-slate-900 text-white px-10 py-4 rounded-2xl font-black text-[11px] uppercase flex items-center gap-3 hover:bg-black transition-all shadow-2xl">
                                <Truck size={20} className="text-blue-400" /> {shippingLoading ? 'API LINKING...' : 'Dispatch to Fardar'}
                             </button>
                        )}
                    </div>
                </div>

                <div className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-sm space-y-8">
                    <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><UserIcon size={16}/> Consignee Identity</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-1">
                          <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Full Name</label>
                          <input 
                            className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-6 py-4 font-black outline-none focus:ring-2 focus:ring-blue-500 transition-all" 
                            value={localFormData.customerName} 
                            onChange={e => setLocalFormData({...localFormData, customerName: e.target.value})} 
                            placeholder="Type Name..." 
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Contact No</label>
                          <input 
                            className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-6 py-4 font-black outline-none focus:ring-2 focus:ring-blue-500 transition-all" 
                            value={localFormData.customerPhone} 
                            onChange={e => setLocalFormData({...localFormData, customerPhone: e.target.value})} 
                            placeholder="077..." 
                          />
                        </div>
                        <div className="space-y-1 md:col-span-2">
                          <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Full Address</label>
                          <textarea 
                            className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-6 py-4 font-black outline-none min-h-[120px] focus:ring-2 focus:ring-blue-500 transition-all" 
                            value={localFormData.customerAddress} 
                            onChange={e => setLocalFormData({...localFormData, customerAddress: e.target.value})} 
                            placeholder="Street, No, Lane..." 
                          />
                        </div>
                    </div>
                </div>
                
                {order.logs && order.logs.length > 0 && (
                   <div className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-sm space-y-6">
                      <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Audit Trail</h3>
                      <div className="space-y-4">
                         {order.logs.slice().reverse().map(log => (
                            <div key={log.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex justify-between items-center">
                               <div>
                                  <p className="text-[11px] font-black text-slate-900 uppercase">{log.message}</p>
                                  <p className="text-[9px] font-bold text-slate-400 uppercase mt-1">{log.user}</p>
                               </div>
                               <span className="text-[9px] font-mono text-slate-300">{new Date(log.timestamp).toLocaleString()}</span>
                            </div>
                         ))}
                      </div>
                   </div>
                )}
            </div>

            <div className="space-y-8">
                 <div className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-sm space-y-6">
                    <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><MessageSquare size={16}/> Call Notes</h3>
                    <div className="space-y-4">
                        <textarea 
                            value={callNote}
                            onChange={e => setCallNote(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 text-[13px] font-bold outline-none focus:ring-2 focus:ring-blue-500 h-24"
                            placeholder="Add internal feedback..."
                        />
                        <button onClick={handleAddCallNote} className="w-full bg-blue-600 text-white py-3 rounded-xl font-black text-[10px] uppercase shadow-lg hover:bg-blue-700">Commit Note</button>
                    </div>
                 </div>

                 <div className="bg-slate-950 text-white p-10 rounded-[3rem] shadow-2xl">
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Grand Total Payable</p>
                    <h2 className="text-4xl font-black tracking-tighter">{formatCurrency(totalAmount)}</h2>
                    {(order.trackingNumber || localFormData.trackingNumber) && (
                        <div className="mt-6 pt-6 border-t border-white/10">
                            <p className="text-[9px] font-black text-blue-400 uppercase tracking-widest mb-1">Waybill Handshake</p>
                            <p className="text-lg font-mono font-black">{order.trackingNumber || localFormData.trackingNumber}</p>
                        </div>
                    )}
                 </div>
            </div>
        </div>
    </div>
  );
};
