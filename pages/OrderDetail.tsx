
import React, { useState, useEffect } from 'react';
import { db } from '../services/mockBackend';
import { Order, OrderStatus, OrderLog } from '../types';
import { 
  ArrowLeft, 
  Save, 
  Truck, 
  Check, 
  Clock, 
  User as UserIcon, 
  Calendar,
  Info,
  Package,
  MapPin,
  AlertCircle,
  // Added Activity import to fix the missing icon error
  Activity
} from 'lucide-react';
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
    customerName: '', 
    customerPhone: '', 
    customerAddress: '', 
    customerCity: '',
    parcelWeight: '1',
    parcelDescription: '',
    totalAmount: 0,
    shippedAt: ''
  });

  const loadOrder = async () => {
    setLoading(true);
    const data = await db.getOrder(orderId);
    if (data) {
      setOrder(data);
      const h = await db.getCustomerHistory(data.customerPhone, tenantId);
      setHistory(h);
      setFormData({ 
        customerName: data.customerName, 
        customerPhone: data.customerPhone, 
        customerAddress: data.customerAddress, 
        customerCity: data.customerCity || '',
        parcelWeight: data.parcelWeight || '1',
        parcelDescription: data.parcelDescription || '',
        totalAmount: data.totalAmount,
        shippedAt: data.shippedAt || ''
      });
    }
    setLoading(false);
  };

  useEffect(() => { loadOrder(); }, [orderId]);

  const updateStatus = async (newStatus: OrderStatus) => {
    if (!order) return;
    
    if (newStatus === OrderStatus.SHIPPED) {
        if (!formData.customerCity || !formData.parcelDescription) {
            alert("Mandatory for Logistics: City and Description required.");
            return;
        }
        setShippingLoading(true);
        try {
            const updatedWithCourier = { ...order, ...formData };
            await db.shipOrder(updatedWithCourier, tenantId);
            alert("Milky Way: Courier Sync Successful!");
        } catch (e: any) {
            alert(e.message);
        } finally {
            setShippingLoading(false);
            loadOrder();
        }
        return;
    }

    const log: OrderLog = { id: `l-${Date.now()}`, message: `Pipeline updated: ${newStatus}`, timestamp: new Date().toISOString(), user: 'Admin' };
    const updatedOrder = { ...order, status: newStatus, logs: [...(order.logs || []), log] };
    await db.updateOrder(updatedOrder);
    loadOrder();
  };

  const handleSaveChanges = async () => {
    if (!order) return;
    const updatedOrder = { ...order, ...formData };
    await db.updateOrder(updatedOrder);
    loadOrder();
    alert('Milky Way: Entry Synced Successfully');
  };

  if (loading || !order) return <div className="p-20 text-center font-black uppercase text-slate-300 tracking-widest text-xs">Accessing Record...</div>;

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-20 animate-slide-in">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
                <button onClick={onBack} className="p-4 bg-white border border-slate-100 rounded-3xl text-black hover:scale-110 transition-all shadow-sm">
                    <ArrowLeft size={20} />
                </button>
                <div>
                    <h1 className="text-3xl font-black text-black tracking-tight uppercase">Registry {order.id}</h1>
                    <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
                        <span className="text-blue-500 text-lg leading-none">👤</span> Opened By: {order.openedBy || 'System'}
                    </p>
                </div>
            </div>
            <div className="flex items-center gap-3">
              {history?.returns > 0 && (
                 <div className="flex items-center gap-2 px-4 py-2 bg-rose-50 border border-rose-100 rounded-2xl text-rose-600 font-black text-[10px] uppercase">
                    <AlertCircle size={14} /> High Risk: {history.returns} Returns
                 </div>
              )}
              <button onClick={handleSaveChanges} className="bg-black text-white px-10 py-4 rounded-[1.5rem] font-black uppercase tracking-widest text-xs shadow-2xl hover:scale-105 active:scale-95 transition-all flex items-center gap-3">
                  <Save size={18} /> Sync Local Updates
              </button>
            </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-8">
                {/* Command Console */}
                <div className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-sm space-y-6">
                    <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><Check size={16}/> Control Console</h3>
                    <div className="flex flex-wrap gap-2">
                        {[OrderStatus.PENDING, OrderStatus.OPEN_LEAD, OrderStatus.NO_ANSWER, OrderStatus.HOLD, OrderStatus.REJECTED].includes(order.status) && (
                            <>
                                <button onClick={() => updateStatus(OrderStatus.PENDING)} className="bg-blue-600 text-white px-5 py-3 rounded-2xl font-black text-[10px] uppercase shadow-lg">Pending</button>
                                <button onClick={() => updateStatus(OrderStatus.OPEN_LEAD)} className="bg-sky-500 text-white px-5 py-3 rounded-2xl font-black text-[10px] uppercase shadow-lg">Open Lead</button>
                                <button onClick={() => updateStatus(OrderStatus.NO_ANSWER)} className="bg-amber-500 text-white px-5 py-3 rounded-2xl font-black text-[10px] uppercase shadow-lg">No Answer</button>
                                <button onClick={() => updateStatus(OrderStatus.REJECTED)} className="bg-rose-600 text-white px-5 py-3 rounded-2xl font-black text-[10px] uppercase shadow-lg">Reject</button>
                                <button onClick={() => updateStatus(OrderStatus.HOLD)} className="bg-purple-600 text-white px-5 py-3 rounded-2xl font-black text-[10px] uppercase shadow-lg">Hold</button>
                                <button onClick={() => updateStatus(OrderStatus.CONFIRMED)} className="bg-emerald-600 text-white px-8 py-3 rounded-2xl font-black text-[10px] uppercase shadow-xl hover:scale-105 transition-all">Confirm Order</button>
                            </>
                        )}
                        
                        {order.status === OrderStatus.CONFIRMED && (
                             <button 
                                onClick={() => updateStatus(OrderStatus.SHIPPED)} 
                                disabled={shippingLoading}
                                className="bg-black text-white px-10 py-4 rounded-2xl font-black text-[10px] uppercase flex items-center gap-3 hover:scale-105 transition-all shadow-2xl disabled:opacity-50"
                             >
                                <Truck size={18} /> {shippingLoading ? 'Syncing Courier...' : 'Dispatch Milky Way Shipment'}
                             </button>
                        )}

                        {[OrderStatus.SHIPPED, OrderStatus.DELIVERY, OrderStatus.RESIDUAL].includes(order.status) && (
                            <>
                                <button onClick={() => updateStatus(OrderStatus.DELIVERY)} className="bg-blue-50 text-blue-700 px-5 py-3 rounded-2xl font-black text-[10px] uppercase border border-blue-100">Delivery</button>
                                <button onClick={() => updateStatus(OrderStatus.RESIDUAL)} className="bg-purple-50 text-purple-700 px-5 py-3 rounded-2xl font-black text-[10px] uppercase border border-purple-100">Residual</button>
                                <button onClick={() => updateStatus(OrderStatus.RETURNED)} className="bg-rose-600 text-white px-5 py-3 rounded-2xl font-black text-[10px] uppercase shadow-lg">Returned</button>
                                <button onClick={() => updateStatus(OrderStatus.DELIVERED)} className="bg-emerald-600 text-white px-8 py-3 rounded-2xl font-black text-[10px] uppercase shadow-xl hover:scale-105 transition-all">Delivered</button>
                            </>
                        )}

                        {(order.status === OrderStatus.RETURNED || order.status === OrderStatus.RESIDUAL) && (
                             <button onClick={() => updateStatus(OrderStatus.RETURN_COMPLETED)} className="bg-black text-white px-8 py-3 rounded-2xl font-black text-[10px] uppercase shadow-xl hover:scale-105 transition-all">Return Complete</button>
                        )}
                    </div>
                </div>

                {/* Form Fields */}
                <div className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-sm space-y-8">
                    <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><UserIcon size={16}/> Subject Data</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Customer Full Name</label>
                            <input className="w-full bg-slate-50 border-none rounded-2xl px-6 py-4 text-black font-black outline-none focus:ring-2 focus:ring-black transition-all" value={formData.customerName} onChange={e => setFormData({...formData, customerName: e.target.value})} placeholder="Full Name" />
                        </div>
                        <div>
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Primary Contact</label>
                            <input className="w-full bg-slate-50 border-none rounded-2xl px-6 py-4 text-black font-black outline-none focus:ring-2 focus:ring-black transition-all" value={formData.customerPhone} onChange={e => setFormData({...formData, customerPhone: e.target.value})} placeholder="Phone Number" />
                        </div>
                        <div className="md:col-span-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Drop-off Address</label>
                            <textarea className="w-full bg-slate-50 border-none rounded-2xl px-6 py-4 text-black font-black outline-none focus:ring-2 focus:ring-black transition-all min-h-[80px]" value={formData.customerAddress} onChange={e => setFormData({...formData, customerAddress: e.target.value})} placeholder="Address String" />
                        </div>
                    </div>
                </div>

                {/* Logistics Configuration Section */}
                <div className="bg-blue-50/30 p-10 rounded-[3rem] border border-blue-100 shadow-sm space-y-8">
                    <h3 className="text-[10px] font-black text-blue-500 uppercase tracking-widest flex items-center gap-2"><Truck size={16}/> Courier Payload Configuration</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2 flex items-center gap-1.5"><MapPin size={12}/> Destination City (Target)</label>
                            <input 
                                className="w-full bg-white border border-blue-100 rounded-2xl px-6 py-4 text-black font-black outline-none focus:ring-2 focus:ring-blue-500 transition-all shadow-sm" 
                                value={formData.customerCity} 
                                onChange={e => setFormData({...formData, customerCity: e.target.value})} 
                                placeholder="Ex. Matara, Kandy, Colombo"
                            />
                        </div>
                        <div>
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2 flex items-center gap-1.5"><Package size={12}/> Weight (Kg)</label>
                            <input 
                                type="number"
                                className="w-full bg-white border border-blue-100 rounded-2xl px-6 py-4 text-black font-black outline-none focus:ring-2 focus:ring-blue-500 transition-all shadow-sm" 
                                value={formData.parcelWeight} 
                                onChange={e => setFormData({...formData, parcelWeight: e.target.value})} 
                            />
                        </div>
                        <div className="md:col-span-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2 flex items-center gap-1.5"><Info size={12}/> Parcel Description</label>
                            <input 
                                className="w-full bg-white border border-blue-100 rounded-2xl px-6 py-4 text-black font-black outline-none focus:ring-2 focus:ring-blue-500 transition-all shadow-sm" 
                                value={formData.parcelDescription} 
                                onChange={e => setFormData({...formData, parcelDescription: e.target.value})} 
                                placeholder="Ex. Mobile Accessories, Clothing Item"
                            />
                        </div>
                    </div>
                </div>
            </div>

            <div className="space-y-8">
                 <div className="bg-black text-white p-10 rounded-[3rem] shadow-2xl relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-blue-600 rounded-full blur-[80px] opacity-20 transition-all group-hover:opacity-40"></div>
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-2">Milky Way Valuation</p>
                    <h2 className="text-4xl font-black tracking-tight">{formatCurrency(formData.totalAmount)}</h2>
                    <div className="mt-8 flex justify-between items-center text-[10px] font-black uppercase text-slate-500">
                        <span>Terminal Segment</span>
                        <span className="text-white bg-slate-800 px-3 py-1 rounded-full">{order.status}</span>
                    </div>
                    {order.trackingNumber && (
                         <div className="mt-4 pt-4 border-t border-white/10">
                            <p className="text-[9px] font-black text-slate-500 uppercase mb-1">Waybill ID</p>
                            <p className="font-mono text-blue-400 font-bold tracking-widest">{order.trackingNumber}</p>
                         </div>
                    )}
                 </div>

                 {/* History Intelligence Panel */}
                 {history && history.count > 0 && (
                   <div className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-sm space-y-4">
                      <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><Activity size={16} className="text-blue-500"/> Customer Intelligence</h3>
                      <div className="grid grid-cols-2 gap-3">
                          <div className="bg-slate-50 p-4 rounded-2xl text-center">
                              <p className="text-[8px] font-black text-slate-400 uppercase mb-1">Total Orders</p>
                              <p className="text-xl font-black text-slate-900">{history.count}</p>
                          </div>
                          <div className="bg-rose-50 p-4 rounded-2xl text-center">
                              <p className="text-[8px] font-black text-slate-400 uppercase mb-1">Returns</p>
                              <p className="text-xl font-black text-rose-600">{history.returns}</p>
                          </div>
                      </div>
                   </div>
                 )}

                 <div className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-sm flex flex-col h-full max-h-[500px]">
                    <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-8 flex items-center gap-2">
                        <Clock size={16}/> Milky Way Registry Log
                    </h3>
                    <div className="flex-1 space-y-6 overflow-y-auto no-scrollbar pr-2">
                        {(order.logs || []).slice().reverse().map((log) => (
                            <div key={log.id} className="relative pl-6 border-l-2 border-slate-100">
                                <div className="absolute -left-[5px] top-1 w-2 h-2 rounded-full bg-slate-300"></div>
                                <p className="text-[11px] font-black text-slate-900 uppercase tracking-tight leading-tight">{log.message}</p>
                                <p className="text-[9px] text-slate-400 font-bold uppercase mt-1 tracking-widest">
                                    {new Date(log.timestamp).toLocaleTimeString()} | {log.user}
                                </p>
                            </div>
                        ))}
                    </div>
                 </div>
            </div>
        </div>
    </div>
  );
};
