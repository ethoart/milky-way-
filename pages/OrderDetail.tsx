import React, { useState, useEffect } from 'react';
import { db } from '../services/mockBackend';
import { Order, OrderStatus, OrderLog } from '../types';
import { ArrowLeft, Truck, Check, Clock, User as UserIcon, Save, Activity, AlertCircle, Pause } from 'lucide-react';
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
  const [formData, setFormData] = useState({ 
    customerName: '', customerPhone: '', customerAddress: '', customerCity: '', 
    parcelWeight: '1', parcelDescription: '', totalAmount: 0 
  });

  const loadOrder = async () => {
    setLoading(true);
    const data = await db.getOrder(orderId, tenantId);
    if (data) {
      setOrder(data);
      setHistory(await db.getCustomerHistory(data.customerPhone, tenantId));
      setFormData({ 
        customerName: data.customerName, customerPhone: data.customerPhone, 
        customerAddress: data.customerAddress, customerCity: data.customerCity || '', 
        parcelWeight: data.parcelWeight || '1', parcelDescription: data.parcelDescription || '', 
        totalAmount: data.totalAmount 
      });
    }
    setLoading(false);
  };

  useEffect(() => { loadOrder(); }, [orderId]);

  const updateStatus = async (newStatus: OrderStatus) => {
    if (!order) return;
    
    if (newStatus === OrderStatus.SHIPPED) {
      if (!formData.customerCity || !formData.parcelDescription) {
        return alert("Milky Way: Destination City and Parcel Description are mandatory for Courier API handshake.");
      }
      setShippingLoading(true);
      try { 
        // shipOrder now handles JSON conversion internally
        const result = await db.shipOrder({ ...order, ...formData }, tenantId);
        alert(`Milky Way: Courier Handshake Success. Tracking ID: ${result.trackingNumber}`);
        loadOrder();
      } catch (e: any) { 
        alert(`Courier Error: ${e.message}`); 
      } finally { 
        setShippingLoading(false); 
      }
      return;
    }

    const log: OrderLog = { 
      id: `l-${Date.now()}`, 
      message: `Status transitioned to ${newStatus}`, 
      timestamp: new Date().toISOString(), 
      user: 'System' 
    };
    
    await db.updateOrder({ ...order, ...formData, status: newStatus, logs: [...(order.logs || []), log] });
    loadOrder();
  };

  if (loading || !order) return <div className="p-20 text-center font-black uppercase text-slate-300 text-xs tracking-widest">Accessing Cluster Identity...</div>;

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-20 animate-slide-in">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
                <button onClick={onBack} className="p-4 bg-white border border-slate-100 rounded-3xl text-black hover:scale-110 transition-all shadow-sm"><ArrowLeft size={20} /></button>
                <div>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight uppercase leading-none">Registry {order.id.slice(-8)}</h1>
                    <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mt-1">Status: {order.status}</p>
                </div>
            </div>
            <button onClick={() => updateStatus(order.status)} className="bg-black text-white px-10 py-4 rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl flex items-center gap-3 hover:scale-105 transition-all active:scale-95"><Save size={18} /> Master Sync</button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-8">
                <div className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-sm space-y-6">
                    <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><Activity size={16}/> Protocol Action Center</h3>
                    <div className="flex flex-wrap gap-2">
                        {[OrderStatus.PENDING, OrderStatus.OPEN_LEAD, OrderStatus.NO_ANSWER, OrderStatus.HOLD, OrderStatus.REJECTED].includes(order.status) && (
                            <>
                                <button onClick={() => updateStatus(OrderStatus.OPEN_LEAD)} className={`px-5 py-3 rounded-2xl font-black text-[10px] uppercase transition-all shadow-lg ${order.status === OrderStatus.OPEN_LEAD ? 'bg-sky-500 text-white' : 'bg-slate-100 text-slate-500'}`}>Open Lead</button>
                                <button onClick={() => updateStatus(OrderStatus.HOLD)} className={`px-5 py-3 rounded-2xl font-black text-[10px] uppercase transition-all shadow-lg ${order.status === OrderStatus.HOLD ? 'bg-amber-600 text-white' : 'bg-slate-100 text-slate-500'}`}><Pause size={12} className="inline mr-1" /> Hold</button>
                                <button onClick={() => updateStatus(OrderStatus.NO_ANSWER)} className={`px-5 py-3 rounded-2xl font-black text-[10px] uppercase transition-all shadow-lg ${order.status === OrderStatus.NO_ANSWER ? 'bg-orange-500 text-white' : 'bg-slate-100 text-slate-500'}`}>No Answer</button>
                                <button onClick={() => updateStatus(OrderStatus.REJECTED)} className={`px-5 py-3 rounded-2xl font-black text-[10px] uppercase transition-all shadow-lg ${order.status === OrderStatus.REJECTED ? 'bg-rose-600 text-white' : 'bg-slate-100 text-slate-500'}`}>Reject</button>
                                <button onClick={() => updateStatus(OrderStatus.CONFIRMED)} className="bg-emerald-600 text-white px-8 py-3 rounded-2xl font-black text-[10px] uppercase shadow-xl hover:scale-105 transition-all">Confirm Order</button>
                            </>
                        )}
                        {order.status === OrderStatus.CONFIRMED && (
                             <button 
                                onClick={() => updateStatus(OrderStatus.SHIPPED)} 
                                disabled={shippingLoading} 
                                className="bg-slate-900 text-white px-10 py-4 rounded-2xl font-black text-[11px] uppercase flex items-center gap-3 hover:bg-black hover:scale-105 transition-all shadow-2xl disabled:opacity-50"
                             >
                                <Truck size={20} className="text-blue-400" /> 
                                {shippingLoading ? 'Handshaking...' : 'Dispatch Shipment'}
                             </button>
                        )}
                        {order.status === OrderStatus.SHIPPED && (
                          <div className="bg-indigo-600 text-white px-6 py-3 rounded-2xl font-mono text-xs font-bold uppercase tracking-widest border border-white/10 shadow-lg">
                            <Truck size={14} className="inline mr-2 text-indigo-200" />
                            Tracking: {order.trackingNumber}
                          </div>
                        )}
                    </div>
                </div>

                <div className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-sm space-y-8">
                    <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><UserIcon size={16}/> Subject Info Profile</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2 ml-1">Full Legal Name</label>
                            <input className="w-full bg-slate-50 border-none rounded-2xl px-6 py-4 text-slate-900 font-black outline-none focus:ring-2 focus:ring-slate-900 transition-all shadow-inner" value={formData.customerName} onChange={e => setFormData({...formData, customerName: e.target.value})} />
                        </div>
                        <div>
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2 ml-1">Contact Phone</label>
                            <input className="w-full bg-slate-50 border-none rounded-2xl px-6 py-4 text-slate-900 font-black outline-none focus:ring-2 focus:ring-slate-900 transition-all shadow-inner" value={formData.customerPhone} onChange={e => setFormData({...formData, customerPhone: e.target.value})} />
                        </div>
                        <div>
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2 ml-1">Destination City (API Reqd)</label>
                            <input className="w-full bg-slate-50 border-none rounded-2xl px-6 py-4 text-slate-900 font-black outline-none focus:ring-2 focus:ring-slate-900 transition-all shadow-inner" value={formData.customerCity} onChange={e => setFormData({...formData, customerCity: e.target.value})} placeholder="Colombo, Kandy, etc." />
                        </div>
                        <div>
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2 ml-1">Item Contents</label>
                            <input className="w-full bg-slate-50 border-none rounded-2xl px-6 py-4 text-slate-900 font-black outline-none focus:ring-2 focus:ring-slate-900 transition-all shadow-inner" value={formData.parcelDescription} onChange={e => setFormData({...formData, parcelDescription: e.target.value})} placeholder="Electronics, Clothing, etc." />
                        </div>
                        <div className="md:col-span-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2 ml-1">Deployment Address</label>
                            <textarea className="w-full bg-slate-50 border-none rounded-2xl px-6 py-4 text-slate-900 font-black outline-none focus:ring-2 focus:ring-slate-900 transition-all shadow-inner min-h-[120px] resize-none" value={formData.customerAddress} onChange={e => setFormData({...formData, customerAddress: e.target.value})} />
                        </div>
                    </div>
                </div>
            </div>

            <div className="space-y-8">
                 <div className="bg-slate-950 text-white p-10 rounded-[3rem] shadow-2xl relative overflow-hidden border border-white/5">
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-2">Registry Valuation</p>
                    <h2 className="text-4xl font-black tracking-tighter">{formatCurrency(formData.totalAmount)}</h2>
                    <div className="mt-8 flex justify-between items-center text-[10px] font-black uppercase text-slate-500">
                        <span>Node Status</span>
                        <span className="text-blue-400 bg-white/5 border border-white/10 px-4 py-1.5 rounded-full">{order.status}</span>
                    </div>
                 </div>

                 {history && history.count > 0 && (
                   <div className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-sm space-y-4">
                      <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><Activity size={16} className="text-blue-500"/> Intel Profile</h3>
                      <div className="grid grid-cols-2 gap-3">
                          <div className="bg-slate-50 p-4 rounded-2xl text-center">
                              <p className="text-[8px] font-black text-slate-400 uppercase mb-1">Total Hits</p>
                              <p className="text-xl font-black text-slate-900">{history.count}</p>
                          </div>
                          <div className={`p-4 rounded-2xl text-center ${history.returns > 0 ? 'bg-rose-50' : 'bg-emerald-50'}`}>
                              <p className="text-[8px] font-black text-slate-400 uppercase mb-1">Return History</p>
                              <p className={`text-xl font-black ${history.returns > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>{history.returns}</p>
                          </div>
                      </div>
                   </div>
                 )}

                 <div className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-sm max-h-[400px] overflow-hidden flex flex-col">
                    <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-8 flex items-center gap-2"><Clock size={16}/> Activity Stream</h3>
                    <div className="flex-1 space-y-4 overflow-y-auto no-scrollbar pr-2 pb-4">
                        {(order.logs || []).slice().reverse().map((log) => (
                            <div key={log.id} className="relative pl-6 border-l-2 border-slate-100">
                                <div className="absolute -left-[5px] top-1 w-2 h-2 rounded-full bg-slate-300"></div>
                                <p className="text-[11px] font-black text-slate-900 leading-tight uppercase">{log.message}</p>
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