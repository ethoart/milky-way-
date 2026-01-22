import React, { useState, useEffect, useCallback } from 'react';
import { db } from '../services/mockBackend';
import { Order, OrderStatus, OrderLog } from '../types';
import { ArrowLeft, Truck, Check, Clock, User as UserIcon, Save, Activity, AlertCircle } from 'lucide-react';
import { formatCurrency } from '../utils/helpers';

interface OrderDetailProps {
  orderId: string;
  tenantId: string;
  onBack: () => void;
}

export const OrderDetail: React.FC<OrderDetailProps> = ({ orderId, tenantId, onBack }) => {
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [shippingLoading, setShippingLoading] = useState(false);
  const [history, setHistory] = useState<any>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState({ 
    customerName: '', customerPhone: '', customerAddress: '', customerCity: '',
    parcelWeight: '1', parcelDescription: '', totalAmount: 0, shippedAt: ''
  });

  const loadOrder = async () => {
    setLoading(true);
    const data = await db.getOrder(orderId, tenantId);
    if (data) {
      setOrder(data);
      const h = await db.getCustomerHistory(data.customerPhone, tenantId);
      setHistory(h);
      setFormData({ 
        customerName: data.customerName, customerPhone: data.customerPhone, 
        customerAddress: data.customerAddress, customerCity: data.customerCity || '',
        parcelWeight: data.parcelWeight || '1', parcelDescription: data.parcelDescription || '',
        totalAmount: data.totalAmount, shippedAt: data.shippedAt || ''
      });
    }
    setLoading(false);
  };

  useEffect(() => { loadOrder(); }, [orderId]);

  useEffect(() => {
    if (!order) return;
    const timer = setTimeout(async () => {
      if (formData.customerName !== order.customerName || 
          formData.customerPhone !== order.customerPhone || 
          formData.customerAddress !== order.customerAddress) {
        setIsSaving(true);
        await db.updateOrder({ ...order, ...formData });
        setIsSaving(false);
      }
    }, 800);
    return () => clearTimeout(timer);
  }, [formData.customerName, formData.customerPhone, formData.customerAddress]);

  const updateStatus = async (newStatus: OrderStatus) => {
    if (!order) return;

    // COURIER API HANDSHAKE LOGIC
    if (newStatus === OrderStatus.SHIPPED) {
        if (!formData.customerCity || !formData.parcelDescription) return alert("Milky Way: City & Parcel Description are mandatory for Courier API handshake.");
        
        setShippingLoading(true);
        try { 
          const result = await db.shipOrder({ ...order, ...formData }, tenantId); 
          alert(`Milky Way: Courier API Successful. Generated API Code: ${result.trackingNumber}`);
          loadOrder();
        } catch (e: any) { 
          alert(`Milky Way: Courier Handshake Failed. Details: ${e.message}`); 
        } finally { 
          setShippingLoading(false); 
        }
        return;
    }

    const log: OrderLog = { id: `l-${Date.now()}`, message: `Status updated to ${newStatus}`, timestamp: new Date().toISOString(), user: 'Staff' };
    await db.updateOrder({ ...order, ...formData, status: newStatus, logs: [...(order.logs || []), log] });
    loadOrder();
  };

  if (loading || !order) return <div className="p-20 text-center font-black uppercase text-slate-300 text-xs">Accessing Cluster Identity...</div>;

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-20 animate-slide-in">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
                <button onClick={onBack} className="p-4 bg-white border border-slate-100 rounded-3xl text-black hover:scale-110 transition-all shadow-sm"><ArrowLeft size={20} /></button>
                <div>
                    <h1 className="text-3xl font-black text-black tracking-tight uppercase leading-none">Registry {order.id.slice(-8)}</h1>
                    <div className="flex items-center gap-2 mt-1">
                      <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest">Operator: {order.openedBy || 'System'}</p>
                      {isSaving && <span className="text-[10px] font-black text-blue-600 animate-pulse uppercase tracking-widest">● Auto-Sync Active</span>}
                    </div>
                </div>
            </div>
            <div className="flex items-center gap-3">
              {history?.returns > 0 && <div className="flex items-center gap-2 px-4 py-2 bg-rose-50 border border-rose-100 rounded-2xl text-rose-600 font-black text-[10px] uppercase"><AlertCircle size={14} /> Integrity Risk: {history.returns} Rejections</div>}
              <button onClick={() => updateStatus(order.status)} className="bg-black text-white px-10 py-4 rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl flex items-center gap-3 hover:scale-105 active:scale-95 transition-all"><Save size={18} /> Force Master Sync</button>
            </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-8">
                <div className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-sm space-y-6">
                    <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><Check size={16}/> Pipeline Status Controls</h3>
                    <div className="flex flex-wrap gap-2">
                        {[OrderStatus.PENDING, OrderStatus.OPEN_LEAD, OrderStatus.NO_ANSWER, OrderStatus.HOLD, OrderStatus.REJECTED].includes(order.status) && (
                            <>
                                <button onClick={() => updateStatus(OrderStatus.OPEN_LEAD)} className={`px-5 py-3 rounded-2xl font-black text-[10px] uppercase shadow-lg ${order.status === OrderStatus.OPEN_LEAD ? 'bg-sky-500 text-white' : 'bg-slate-100 text-slate-500'}`}>Open Lead</button>
                                <button onClick={() => updateStatus(OrderStatus.NO_ANSWER)} className={`px-5 py-3 rounded-2xl font-black text-[10px] uppercase shadow-lg ${order.status === OrderStatus.NO_ANSWER ? 'bg-amber-500 text-white' : 'bg-slate-100 text-slate-500'}`}>No Answer</button>
                                <button onClick={() => updateStatus(OrderStatus.REJECTED)} className={`px-5 py-3 rounded-2xl font-black text-[10px] uppercase shadow-lg ${order.status === OrderStatus.REJECTED ? 'bg-rose-600 text-white' : 'bg-slate-100 text-slate-500'}`}>Reject</button>
                                <button onClick={() => updateStatus(OrderStatus.CONFIRMED)} className="bg-emerald-600 text-white px-8 py-3 rounded-2xl font-black text-[10px] uppercase shadow-xl hover:scale-105 transition-all">Confirm Subject</button>
                            </>
                        )}
                        
                        {/* THE SHIP BUTTON: Only visible in Confirmed Status */}
                        {order.status === OrderStatus.CONFIRMED && (
                             <button 
                                onClick={() => updateStatus(OrderStatus.SHIPPED)} 
                                disabled={shippingLoading} 
                                className="bg-slate-900 text-white px-10 py-4 rounded-2xl font-black text-[11px] uppercase flex items-center gap-3 hover:bg-black hover:scale-105 transition-all shadow-2xl disabled:opacity-50"
                             >
                                <Truck size={20} className="text-blue-400" /> 
                                {shippingLoading ? 'Performing API Handshake...' : 'Ship with Courier Partner'}
                             </button>
                        )}

                        {[OrderStatus.SHIPPED, OrderStatus.DELIVERY, OrderStatus.RESIDUAL].includes(order.status) && (
                            <>
                                <div className="flex items-center gap-2 bg-slate-950 text-white px-6 py-3 rounded-2xl font-mono text-[11px] font-bold shadow-lg border border-white/10">
                                    <Truck size={14} className="text-blue-400" /> API CODE: {order.trackingNumber}
                                </div>
                                <button onClick={() => updateStatus(OrderStatus.DELIVERY)} className="bg-blue-50 text-blue-700 px-5 py-3 rounded-2xl font-black text-[10px] uppercase border border-blue-100">In Delivery</button>
                                <button onClick={() => updateStatus(OrderStatus.DELIVERED)} className="bg-emerald-600 text-white px-8 py-3 rounded-2xl font-black text-[10px] uppercase shadow-xl hover:scale-105 transition-all">Mark Delivered</button>
                                <button onClick={() => updateStatus(OrderStatus.RETURNED)} className="bg-rose-600 text-white px-5 py-3 rounded-2xl font-black text-[10px] uppercase shadow-lg">Returned</button>
                            </>
                        )}
                    </div>
                </div>

                <div className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-sm space-y-8">
                    <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><UserIcon size={16}/> Consignee Identity Profile</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2 ml-1">Full Legal Name</label>
                            <input className="w-full bg-slate-50 border-none rounded-2xl px-6 py-4 text-slate-900 font-black outline-none focus:ring-2 focus:ring-slate-900 transition-all shadow-inner" value={formData.customerName} onChange={e => setFormData({...formData, customerName: e.target.value})} />
                        </div>
                        <div>
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2 ml-1">Primary Contact</label>
                            <input className="w-full bg-slate-50 border-none rounded-2xl px-6 py-4 text-slate-900 font-black outline-none focus:ring-2 focus:ring-slate-900 transition-all shadow-inner" value={formData.customerPhone} onChange={e => setFormData({...formData, customerPhone: e.target.value})} />
                        </div>
                        <div>
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2 ml-1">Destination City (Courier Required)</label>
                            <input className="w-full bg-slate-50 border-none rounded-2xl px-6 py-4 text-slate-900 font-black outline-none focus:ring-2 focus:ring-slate-900 transition-all shadow-inner" value={formData.customerCity} onChange={e => setFormData({...formData, customerCity: e.target.value})} placeholder="Ex. Colombo 07" />
                        </div>
                        <div>
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2 ml-1">Parcel Contents / SKU</label>
                            <input className="w-full bg-slate-50 border-none rounded-2xl px-6 py-4 text-slate-900 font-black outline-none focus:ring-2 focus:ring-slate-900 transition-all shadow-inner" value={formData.parcelDescription} onChange={e => setFormData({...formData, parcelDescription: e.target.value})} placeholder="Ex. Milky Way SKU-A" />
                        </div>
                        <div className="md:col-span-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2 ml-1">Deployment Address</label>
                            <textarea className="w-full bg-slate-50 border-none rounded-2xl px-6 py-4 text-slate-900 font-black outline-none focus:ring-2 focus:ring-slate-900 transition-all shadow-inner min-h-[120px]" value={formData.customerAddress} onChange={e => setFormData({...formData, customerAddress: e.target.value})} />
                        </div>
                    </div>
                </div>
            </div>

            <div className="space-y-8">
                 <div className="bg-slate-950 text-white p-10 rounded-[3rem] shadow-2xl relative overflow-hidden border border-white/5">
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-2">Registry Valuation</p>
                    <h2 className="text-4xl font-black tracking-tighter">{formatCurrency(formData.totalAmount)}</h2>
                    <div className="mt-8 flex justify-between items-center text-[10px] font-black uppercase text-slate-500">
                        <span>Segment Node</span>
                        <span className="text-blue-400 bg-white/5 border border-white/10 px-4 py-1.5 rounded-full">{order.status}</span>
                    </div>
                 </div>

                 {history && history.count > 0 && (
                   <div className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-sm space-y-4">
                      <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><Activity size={16} className="text-blue-500"/> Intelligence Intel</h3>
                      <div className="grid grid-cols-2 gap-3">
                          <div className="bg-slate-50 p-4 rounded-2xl text-center">
                              <p className="text-[8px] font-black text-slate-400 uppercase mb-1">Global Hits</p>
                              <p className="text-xl font-black text-slate-900">{history.count}</p>
                          </div>
                          <div className="bg-rose-50 p-4 rounded-2xl text-center">
                              <p className="text-[8px] font-black text-slate-400 uppercase mb-1">Rejection Count</p>
                              <p className="text-xl font-black text-rose-600">{history.returns}</p>
                          </div>
                      </div>
                   </div>
                 )}

                 <div className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-sm max-h-[400px] overflow-hidden flex flex-col">
                    <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-8 flex items-center gap-2"><Clock size={16}/> Protocol Logs</h3>
                    <div className="flex-1 space-y-6 overflow-y-auto no-scrollbar pr-2">
                        {(order.logs || []).slice().reverse().map((log) => (
                            <div key={log.id} className="relative pl-6 border-l-2 border-slate-100">
                                <div className="absolute -left-[5px] top-1 w-2 h-2 rounded-full bg-slate-300"></div>
                                <p className="text-[11px] font-black text-slate-900 uppercase leading-tight">{log.message}</p>
                                <p className="text-[9px] text-slate-400 font-bold uppercase mt-1 tracking-widest">{new Date(log.timestamp).toLocaleTimeString()} | {log.user}</p>
                            </div>
                        ))}
                    </div>
                 </div>
            </div>
        </div>
    </div>
  );
};