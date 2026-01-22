import React, { useState, useEffect } from 'react';
import { db } from '../services/mockBackend';
import { Order, OrderStatus, OrderLog } from '../types';
import { ArrowLeft, Truck, Check, Clock, User as UserIcon, Save, Activity, AlertCircle, Pause, MapPin, Package } from 'lucide-react';
import { formatCurrency } from '../utils/helpers';

const SRI_LANKA_CITIES = [
  "Colombo", "Gampaha", "Kalutara", "Kandy", "Matale", "Nuwara Eliya", "Galle", "Matara", "Hambantota", 
  "Jaffna", "Kilinochchi", "Mannar", "Vavuniya", "Mullaitivu", "Batticaloa", "Ampara", "Trincomalee", 
  "Kurunegala", "Puttalam", "Anuradhapura", "Polonnaruwa", "Badulla", "Monaragala", "Ratnapura", "Kegalle",
  "Dehiwala-Mount Lavinia", "Moratuwa", "Negombo", "Sri Jayawardenepura Kotte", "Kaduwela", "Kolonnawa", 
  "Chilaw", "Wattala", "Welisara", "Ja-Ela", "Paliyagoda", "Gampola", "Nawalapitiya", "Haputale"
].sort();

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
    
    // VALIDATION: Confirmation Guard
    if (newStatus === OrderStatus.CONFIRMED) {
      if (!formData.customerPhone || formData.customerPhone.trim().length < 9) {
        return alert("Validation Error: A valid Mobile Number is required to confirm.");
      }
      if (!formData.customerCity) {
        return alert("Validation Error: City must be selected from the Sri Lanka Geo-Registry to confirm.");
      }
    }

    if (newStatus === OrderStatus.SHIPPED) {
      if (!formData.customerCity || !formData.parcelDescription) {
        return alert("Milky Way: Destination City and Parcel Description are mandatory for Courier API handshake.");
      }
      setShippingLoading(true);
      try { 
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

  if (loading || !order) return <div className="p-20 text-center font-black uppercase text-slate-300 text-xs tracking-widest">Accessing Node Cluster...</div>;

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-20 animate-slide-in">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
                <button onClick={onBack} className="p-4 bg-white border border-slate-100 rounded-3xl text-black hover:scale-110 transition-all shadow-sm"><ArrowLeft size={20} /></button>
                <div>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight uppercase leading-none">Registry {order.id.slice(-8)}</h1>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-blue-600 text-[10px] font-black uppercase tracking-widest">{order.status}</span>
                      <span className="text-slate-300">•</span>
                      <span className="text-slate-400 text-[10px] font-bold">NODE: {order.tenantId}</span>
                    </div>
                </div>
            </div>
            <button onClick={() => updateStatus(order.status)} className="bg-black text-white px-10 py-4 rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl flex items-center gap-3 hover:scale-105 transition-all active:scale-95"><Save size={18} /> Master Sync</button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-8">
                {/* Pipeline Controls - Now always flexible */}
                <div className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-sm space-y-6">
                    <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><Activity size={16}/> Pipeline Command Center</h3>
                    <div className="flex flex-wrap gap-2">
                        <button onClick={() => updateStatus(OrderStatus.OPEN_LEAD)} className={`px-5 py-3 rounded-2xl font-black text-[10px] uppercase transition-all shadow-sm ${order.status === OrderStatus.OPEN_LEAD ? 'bg-sky-500 text-white' : 'bg-slate-100 text-slate-500'}`}>Open Lead</button>
                        <button onClick={() => updateStatus(OrderStatus.HOLD)} className={`px-5 py-3 rounded-2xl font-black text-[10px] uppercase transition-all shadow-sm ${order.status === OrderStatus.HOLD ? 'bg-amber-600 text-white' : 'bg-slate-100 text-slate-500'}`}><Pause size={12} className="inline mr-1" /> Hold</button>
                        <button onClick={() => updateStatus(OrderStatus.NO_ANSWER)} className={`px-5 py-3 rounded-2xl font-black text-[10px] uppercase transition-all shadow-sm ${order.status === OrderStatus.NO_ANSWER ? 'bg-orange-500 text-white' : 'bg-slate-100 text-slate-500'}`}>No Answer</button>
                        <button onClick={() => updateStatus(OrderStatus.REJECTED)} className={`px-5 py-3 rounded-2xl font-black text-[10px] uppercase transition-all shadow-sm ${order.status === OrderStatus.REJECTED ? 'bg-rose-600 text-white' : 'bg-slate-100 text-slate-500'}`}>Reject</button>
                        
                        {order.status !== OrderStatus.SHIPPED && (
                          <button onClick={() => updateStatus(OrderStatus.CONFIRMED)} className={`bg-emerald-600 text-white px-8 py-3 rounded-2xl font-black text-[10px] uppercase shadow-xl hover:scale-105 transition-all ${order.status === OrderStatus.CONFIRMED ? 'ring-4 ring-emerald-100' : ''}`}>Confirm Order</button>
                        )}

                        {order.status === OrderStatus.CONFIRMED && (
                             <button 
                                onClick={() => updateStatus(OrderStatus.SHIPPED)} 
                                disabled={shippingLoading} 
                                className="bg-slate-900 text-white px-10 py-4 rounded-2xl font-black text-[11px] uppercase flex items-center gap-3 hover:bg-black hover:scale-105 transition-all shadow-2xl disabled:opacity-50"
                             >
                                <Truck size={20} className="text-blue-400" /> 
                                {shippingLoading ? 'Syncing...' : 'Dispatch Shipment'}
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
                        <div className="md:col-span-2 p-6 bg-slate-50 rounded-3xl border border-slate-100 flex items-center gap-4">
                            <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-blue-600 shadow-sm">
                                <Package size={24}/>
                            </div>
                            <div>
                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Selected Lead Item</p>
                                <div className="flex flex-col">
                                    {order.items.map((item, idx) => (
                                        <span key={idx} className="text-lg font-black text-slate-900 uppercase">
                                            {item.name} <span className="text-blue-600 text-sm ml-2">x{item.quantity}</span>
                                        </span>
                                    ))}
                                </div>
                            </div>
                        </div>
                        <div>
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2 ml-1">Full Legal Name</label>
                            <input className="w-full bg-slate-50 border-none rounded-2xl px-6 py-4 text-slate-900 font-black outline-none focus:ring-2 focus:ring-slate-900 transition-all shadow-inner" value={formData.customerName} onChange={e => setFormData({...formData, customerName: e.target.value})} />
                        </div>
                        <div>
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2 ml-1">Contact Phone (Required)</label>
                            <input className="w-full bg-slate-50 border-none rounded-2xl px-6 py-4 text-slate-900 font-black outline-none focus:ring-2 focus:ring-slate-900 transition-all shadow-inner" value={formData.customerPhone} onChange={e => setFormData({...formData, customerPhone: e.target.value})} />
                        </div>
                        <div>
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2 ml-1">Sri Lanka City (Required)</label>
                            <div className="relative">
                                <select 
                                    className="w-full bg-slate-50 border-none rounded-2xl px-6 py-4 text-slate-900 font-black outline-none focus:ring-2 focus:ring-slate-900 transition-all shadow-inner appearance-none" 
                                    value={formData.customerCity} 
                                    onChange={e => setFormData({...formData, customerCity: e.target.value})}
                                >
                                    <option value="">Select City...</option>
                                    {SRI_LANKA_CITIES.map(city => <option key={city} value={city}>{city}</option>)}
                                </select>
                                <MapPin size={14} className="absolute right-6 top-1/2 -translate-y-1/2 text-slate-300" />
                            </div>
                        </div>
                        <div>
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2 ml-1">Parcel Contents</label>
                            <input className="w-full bg-slate-50 border-none rounded-2xl px-6 py-4 text-slate-900 font-black outline-none focus:ring-2 focus:ring-slate-900 transition-all shadow-inner" value={formData.parcelDescription} onChange={e => setFormData({...formData, parcelDescription: e.target.value})} placeholder="Contents for Label" />
                        </div>
                        <div className="md:col-span-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2 ml-1">Deployment Address</label>
                            <textarea className="w-full bg-slate-50 border-none rounded-2xl px-6 py-4 text-slate-900 font-black outline-none focus:ring-2 focus:ring-slate-900 transition-all shadow-inner min-h-[100px] resize-none" value={formData.customerAddress} onChange={e => setFormData({...formData, customerAddress: e.target.value})} />
                        </div>
                    </div>
                </div>
            </div>

            <div className="space-y-8">
                 <div className="bg-slate-950 text-white p-10 rounded-[3rem] shadow-2xl relative overflow-hidden border border-white/5">
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-2">Registry Valuation</p>
                    <h2 className="text-4xl font-black tracking-tighter">{formatCurrency(formData.totalAmount)}</h2>
                    <div className="mt-8 flex justify-between items-center text-[10px] font-black uppercase text-slate-500">
                        <span>Terminal Link</span>
                        <span className="text-blue-400 bg-white/5 border border-white/10 px-4 py-1.5 rounded-full">{order.status}</span>
                    </div>
                 </div>

                 {history && history.count > 0 && (
                   <div className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-sm space-y-4">
                      <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><Activity size={16} className="text-blue-500"/> Intelligence Profile</h3>
                      <div className="grid grid-cols-2 gap-3">
                          <div className="bg-slate-50 p-4 rounded-2xl text-center">
                              <p className="text-[8px] font-black text-slate-400 uppercase mb-1">Cluster Hits</p>
                              <p className="text-xl font-black text-slate-900">{history.count}</p>
                          </div>
                          <div className={`p-4 rounded-2xl text-center ${history.returns > 0 ? 'bg-rose-50' : 'bg-emerald-50'}`}>
                              <p className="text-[8px] font-black text-slate-400 uppercase mb-1">Return Ratio</p>
                              <p className={`text-xl font-black ${history.returns > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>{history.returns}</p>
                          </div>
                      </div>
                   </div>
                 )}

                 <div className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-sm max-h-[400px] overflow-hidden flex flex-col">
                    <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-8 flex items-center gap-2"><Clock size={16}/> Protocol Logs</h3>
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