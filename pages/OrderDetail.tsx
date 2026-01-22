import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../services/mockBackend';
import { Order, OrderStatus, OrderLog, Product } from '../types';
import { 
  ArrowLeft, Truck, Check, Clock, User as UserIcon, Save, 
  Activity, AlertCircle, Pause, MapPin, Package, Trash2, Plus 
} from 'lucide-react';
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
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [shippingLoading, setShippingLoading] = useState(false);
  const [history, setHistory] = useState<any>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Form State
  const [formData, setFormData] = useState({ 
    customerName: '', 
    customerPhone: '', 
    customerAddress: '', 
    customerCity: '', 
    parcelWeight: '1', 
    parcelDescription: ''
  });
  
  // Items State (Editable Manifest)
  const [items, setItems] = useState<{ productId: string; quantity: number; price: number; name: string }[]>([]);

  const loadData = async () => {
    setLoading(true);
    const [data, fetchedProducts] = await Promise.all([
      db.getOrder(orderId, tenantId),
      db.getProducts(tenantId)
    ]);
    
    if (data) {
      setOrder(data);
      setProducts(fetchedProducts);
      setHistory(await db.getCustomerHistory(data.customerPhone, tenantId));
      setFormData({ 
        customerName: data.customerName, 
        customerPhone: data.customerPhone, 
        customerAddress: data.customerAddress, 
        customerCity: data.customerCity || '', 
        parcelWeight: data.parcelWeight || '1', 
        parcelDescription: data.parcelDescription || '' 
      });
      setItems(data.items || []);
    }
    setLoading(false);
  };

  useEffect(() => { loadData(); }, [orderId]);

  // Derived Total Amount
  const totalAmount = useMemo(() => {
    return items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  }, [items]);

  const handleUpdateItem = (index: number, field: string, value: any) => {
    const newItems = [...items];
    if (field === 'productId') {
      const prod = products.find(p => p.id === value);
      if (prod) {
        newItems[index] = { ...newItems[index], productId: prod.id, name: prod.name, price: prod.price };
      }
    } else {
      (newItems[index] as any)[field] = value;
    }
    setItems(newItems);
  };

  const handleAddItem = () => {
    if (products.length > 0) {
      const p = products[0];
      setItems([...items, { productId: p.id, name: p.name, price: p.price, quantity: 1 }]);
    }
  };

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const updateStatus = async (newStatus: OrderStatus) => {
    if (!order) return;
    
    // STRICT VALIDATION: Confirmation Guard
    if (newStatus === OrderStatus.CONFIRMED) {
      if (!formData.customerPhone || formData.customerPhone.trim().length < 9) {
        return alert("MILKY WAY PROTOCOL: A valid Mobile Number (min 9 digits) is required to confirm.");
      }
      if (!formData.customerCity) {
        return alert("MILKY WAY PROTOCOL: Destination City must be selected from the geo-registry to confirm.");
      }
      if (items.length === 0) {
        return alert("MILKY WAY PROTOCOL: Manifest is empty. Add at least one item.");
      }
    }

    if (newStatus === OrderStatus.SHIPPED) {
      if (!formData.customerCity || !formData.parcelDescription) {
        return alert("Courier API Error: Destination City and Parcel Description are mandatory.");
      }
      setShippingLoading(true);
      try { 
        const result = await db.shipOrder({ ...order, ...formData, items, totalAmount }, tenantId);
        alert(`Handshake Successful: API CODE ${result.trackingNumber}`);
        loadData();
      } catch (e: any) { 
        alert(`API Failure: ${e.message}`); 
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
    
    setIsSaving(true);
    await db.updateOrder({ ...order, ...formData, items, totalAmount, status: newStatus, logs: [...(order.logs || []), log] });
    setIsSaving(false);
    loadData();
  };

  const handleMasterSync = async () => {
    if (!order) return;
    setIsSaving(true);
    await db.updateOrder({ ...order, ...formData, items, totalAmount });
    setIsSaving(false);
    alert("MILKY WAY: Node synchronized with central cluster.");
  };

  if (loading || !order) return <div className="p-20 text-center font-black uppercase text-slate-300 text-xs tracking-widest">Accessing Node Identity...</div>;

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
                      <span className="text-slate-400 text-[10px] font-bold">VALUATION: {formatCurrency(totalAmount)}</span>
                    </div>
                </div>
            </div>
            <div className="flex items-center gap-2">
                {isSaving && <span className="text-[9px] font-black text-blue-600 animate-pulse uppercase tracking-widest mr-2">Syncing Grid...</span>}
                <button onClick={handleMasterSync} className="bg-black text-white px-8 py-4 rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-xl flex items-center gap-3 hover:scale-105 active:scale-95 transition-all"><Save size={16} /> Force Sync</button>
            </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-8">
                {/* Protocol Controls */}
                <div className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-sm space-y-6">
                    <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><Activity size={16}/> Protocol Action Grid</h3>
                    <div className="flex flex-wrap gap-2">
                        <button onClick={() => updateStatus(OrderStatus.OPEN_LEAD)} className={`px-5 py-3 rounded-2xl font-black text-[10px] uppercase transition-all shadow-sm ${order.status === OrderStatus.OPEN_LEAD ? 'bg-sky-500 text-white' : 'bg-slate-100 text-slate-500'}`}>Open Lead</button>
                        <button onClick={() => updateStatus(OrderStatus.HOLD)} className={`px-5 py-3 rounded-2xl font-black text-[10px] uppercase transition-all shadow-sm ${order.status === OrderStatus.HOLD ? 'bg-amber-600 text-white' : 'bg-slate-100 text-slate-500'}`}><Pause size={12} className="inline mr-1" /> Hold</button>
                        <button onClick={() => updateStatus(OrderStatus.NO_ANSWER)} className={`px-5 py-3 rounded-2xl font-black text-[10px] uppercase transition-all shadow-sm ${order.status === OrderStatus.NO_ANSWER ? 'bg-orange-500 text-white' : 'bg-slate-100 text-slate-500'}`}>No Answer</button>
                        <button onClick={() => updateStatus(OrderStatus.REJECTED)} className={`px-5 py-3 rounded-2xl font-black text-[10px] uppercase transition-all shadow-sm ${order.status === OrderStatus.REJECTED ? 'bg-rose-600 text-white' : 'bg-slate-100 text-slate-500'}`}>Reject</button>
                        
                        {order.status !== OrderStatus.SHIPPED && (
                          <button onClick={() => updateStatus(OrderStatus.CONFIRMED)} className={`bg-emerald-600 text-white px-8 py-3 rounded-2xl font-black text-[10px] uppercase shadow-xl hover:scale-105 transition-all ${order.status === OrderStatus.CONFIRMED ? 'ring-4 ring-emerald-100' : ''}`}>Confirm Node</button>
                        )}

                        {order.status === OrderStatus.CONFIRMED && (
                             <button 
                                onClick={() => updateStatus(OrderStatus.SHIPPED)} 
                                disabled={shippingLoading} 
                                className="bg-slate-900 text-white px-10 py-4 rounded-2xl font-black text-[11px] uppercase flex items-center gap-3 hover:bg-black hover:scale-105 transition-all shadow-2xl disabled:opacity-50"
                             >
                                <Truck size={20} className="text-blue-400" /> 
                                {shippingLoading ? 'Handshaking...' : 'Execute Dispatch'}
                             </button>
                        )}
                        {order.status === OrderStatus.SHIPPED && (
                          <div className="bg-indigo-600 text-white px-6 py-3 rounded-2xl font-mono text-xs font-bold uppercase tracking-widest border border-white/10 shadow-lg">
                            <Truck size={14} className="inline mr-2 text-indigo-200" />
                            Waybill: {order.trackingNumber}
                          </div>
                        )}
                    </div>
                </div>

                {/* Editable Manifest Section */}
                <div className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-sm space-y-8">
                    <div className="flex items-center justify-between">
                        <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><Package size={16}/> Selected Lead Manifest</h3>
                        <button onClick={handleAddItem} className="bg-blue-50 text-blue-600 px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest flex items-center gap-2 hover:bg-blue-100 transition-all"><Plus size={14}/> Add Sku</button>
                    </div>
                    <div className="space-y-4">
                        {items.map((item, idx) => (
                            <div key={idx} className="p-6 bg-slate-50 rounded-[2rem] border border-slate-100 flex flex-col md:flex-row items-center gap-6 animate-slide-in">
                                <div className="flex-1 w-full">
                                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-2 ml-1">Assigned SKU</label>
                                    <select 
                                        className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-900 outline-none focus:ring-2 focus:ring-blue-500"
                                        value={item.productId}
                                        onChange={(e) => handleUpdateItem(idx, 'productId', e.target.value)}
                                    >
                                        {products.map(p => <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>)}
                                    </select>
                                </div>
                                <div className="w-full md:w-32">
                                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-2 ml-1">Quantity</label>
                                    <input 
                                        type="number" 
                                        className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-900 outline-none focus:ring-2 focus:ring-blue-500"
                                        value={item.quantity}
                                        onChange={(e) => handleUpdateItem(idx, 'quantity', parseInt(e.target.value) || 0)}
                                    />
                                </div>
                                <div className="w-full md:w-40">
                                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-2 ml-1">Unit Price (LKR)</label>
                                    <input 
                                        type="number" 
                                        className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-900 outline-none focus:ring-2 focus:ring-blue-500"
                                        value={item.price}
                                        onChange={(e) => handleUpdateItem(idx, 'price', parseFloat(e.target.value) || 0)}
                                    />
                                </div>
                                <button onClick={() => handleRemoveItem(idx)} className="mt-6 md:mt-0 p-3 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all">
                                    <Trash2 size={18} />
                                </button>
                            </div>
                        ))}
                        {items.length === 0 && (
                            <div className="p-10 text-center border-2 border-dashed border-slate-100 rounded-[2rem] text-slate-300 font-black text-[10px] uppercase tracking-widest">
                                Manifest is empty. Click "Add Sku" to initialize.
                            </div>
                        )}
                    </div>
                </div>

                <div className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-sm space-y-8">
                    <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><UserIcon size={16}/> Subject Info Identity</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                                    <option value="">Select City Node...</option>
                                    {SRI_LANKA_CITIES.map(city => <option key={city} value={city}>{city}</option>)}
                                </select>
                                <MapPin size={14} className="absolute right-6 top-1/2 -translate-y-1/2 text-slate-300" />
                            </div>
                        </div>
                        <div>
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2 ml-1">Waybill Description</label>
                            <input className="w-full bg-slate-50 border-none rounded-2xl px-6 py-4 text-slate-900 font-black outline-none focus:ring-2 focus:ring-slate-900 transition-all shadow-inner" value={formData.parcelDescription} onChange={e => setFormData({...formData, parcelDescription: e.target.value})} placeholder="Label Content" />
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
                    <h2 className="text-4xl font-black tracking-tighter">{formatCurrency(totalAmount)}</h2>
                    <div className="mt-8 flex justify-between items-center text-[10px] font-black uppercase text-slate-500">
                        <span>Cluster Link</span>
                        <span className="text-blue-400 bg-white/5 border border-white/10 px-4 py-1.5 rounded-full">{order.status}</span>
                    </div>
                 </div>

                 {history && history.count > 0 && (
                   <div className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-sm space-y-4">
                      <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><Activity size={16} className="text-blue-500"/> Intelligence Profile</h3>
                      <div className="grid grid-cols-2 gap-3">
                          <div className="bg-slate-50 p-4 rounded-2xl text-center">
                              <p className="text-[8px] font-black text-slate-400 uppercase mb-1">Global Hits</p>
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