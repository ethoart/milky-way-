import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import { db } from '../services/mockBackend';
import { Order, OrderStatus, OrderLog, Product, Tenant } from '../types';
import { 
  ArrowLeft, Truck, Check, Clock, User as UserIcon, Save, 
  Activity, AlertCircle, Pause, MapPin, Package, Trash2, Plus, Printer, RefreshCcw
} from 'lucide-react';
import { formatCurrency } from '../utils/helpers';
import { BillPrintView } from '../components/BillPrintView';

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
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [loading, setLoading] = useState(true);
  const [shippingLoading, setShippingLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Local state for form fields to prevent re-renders of the whole page on every character typed
  const [localFormData, setLocalFormData] = useState({ 
    customerName: '', 
    customerPhone: '', 
    customerAddress: '', 
    customerCity: '', 
    parcelWeight: '1', 
    parcelDescription: ''
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
        parcelDescription: data.parcelDescription || '' 
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
    root.render(<BillPrintView order={{...order, ...localFormData, items, totalAmount}} settings={tenant.settings} />);
    setTimeout(() => {
        window.print();
        root.unmount();
        document.body.removeChild(printContainer);
    }, 500);
  };

  const updateStatus = async (newStatus: OrderStatus) => {
    if (!order) return;
    
    if (newStatus === OrderStatus.CONFIRMED) {
      if (!localFormData.customerPhone || localFormData.customerPhone.trim().length < 9) return alert("Phone Required.");
      if (items.length === 0) return alert("Manifest is empty.");
    }

    if (newStatus === OrderStatus.SHIPPED) {
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
      message: `Status: ${newStatus}`, 
      timestamp: new Date().toISOString(), 
      user: localStorage.getItem('mw_user') ? JSON.parse(localStorage.getItem('mw_user')!).username : 'System'
    };
    
    setIsSaving(true);
    await db.updateOrder({ ...order, ...localFormData, items, totalAmount, status: newStatus, logs: [...(order.logs || []), log] });
    setIsSaving(false);
    loadData();
  };

  if (loading || !order) return <div className="p-20 text-center font-black uppercase text-slate-300 text-xs tracking-widest">Synchronizing Node...</div>;

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
                    <Printer size={16} /> Print Bill
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
                {/* Action Grid */}
                <div className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-sm space-y-6">
                    <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><Activity size={16}/> Command Protocol</h3>
                    <div className="flex flex-wrap gap-2">
                        {[OrderStatus.OPEN_LEAD, OrderStatus.HOLD, OrderStatus.NO_ANSWER, OrderStatus.REJECTED].map(s => (
                           <button key={s} onClick={() => updateStatus(s)} className={`px-5 py-3 rounded-2xl font-black text-[10px] uppercase transition-all ${order.status === s ? 'bg-blue-600 text-white shadow-lg' : 'bg-slate-50 text-slate-400 hover:text-slate-600'}`}>{s.replace('_', ' ')}</button>
                        ))}
                        <button onClick={() => updateStatus(OrderStatus.CONFIRMED)} className="bg-emerald-600 text-white px-8 py-3 rounded-2xl font-black text-[10px] uppercase shadow-xl hover:bg-emerald-700 transition-all">Confirm Order</button>
                        {(order.status === OrderStatus.CONFIRMED || order.status === OrderStatus.SHIPPED) && (
                             <button onClick={() => updateStatus(OrderStatus.SHIPPED)} disabled={shippingLoading} className="bg-slate-900 text-white px-10 py-4 rounded-2xl font-black text-[11px] uppercase flex items-center gap-3 hover:bg-black transition-all shadow-2xl">
                                <Truck size={20} className="text-blue-400" /> {shippingLoading ? 'API LINKING...' : 'Dispatch to Fardar'}
                             </button>
                        )}
                    </div>
                </div>

                {/* Subject Info - Stabilized Inputs */}
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
                        <div className="space-y-1">
                          <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">City Hub</label>
                          <select 
                            className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-6 py-4 font-black outline-none appearance-none" 
                            value={localFormData.customerCity} 
                            onChange={e => setLocalFormData({...localFormData, customerCity: e.target.value})}
                          >
                              <option value="">Select Hub...</option>
                              {SRI_LANKA_CITIES.map(c => <option key={c} value={c}>{c}</option>)}
                          </select>
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

                {/* Manifest */}
                <div className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-sm space-y-8">
                    <div className="flex items-center justify-between">
                        <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><Package size={16}/> Order Manifest</h3>
                        <button onClick={() => setItems([...items, { productId: products[0]?.id, name: products[0]?.name, price: products[0]?.price, quantity: 1 }])} className="bg-blue-50 text-blue-600 px-4 py-2 rounded-xl text-[9px] font-black uppercase"><Plus size={14} className="inline mr-1"/> Add Sku</button>
                    </div>
                    <div className="space-y-4">
                        {items.map((item, idx) => (
                            <div key={idx} className="p-6 bg-slate-50 rounded-[2rem] border border-slate-100 flex flex-col md:flex-row items-center gap-6">
                                <select 
                                    className="flex-1 w-full bg-white rounded-xl px-4 py-3 text-sm font-bold border border-slate-100" 
                                    value={item.productId} 
                                    onChange={(e) => {
                                        const prod = products.find(p => p.id === e.target.value);
                                        if (prod) {
                                            const newItems = [...items];
                                            newItems[idx] = { ...newItems[idx], productId: prod.id, name: prod.name, price: prod.price };
                                            setItems(newItems);
                                        }
                                    }}
                                >
                                    {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                </select>
                                <div className="flex items-center gap-3">
                                  <input 
                                    type="number" 
                                    className="w-20 bg-white rounded-xl px-4 py-3 text-sm font-black text-center border border-slate-100" 
                                    value={item.quantity} 
                                    onChange={(e) => {
                                        const newItems = [...items];
                                        newItems[idx].quantity = parseInt(e.target.value) || 0;
                                        setItems(newItems);
                                    }} 
                                  />
                                  <input 
                                    type="number" 
                                    className="w-32 bg-white rounded-xl px-4 py-3 text-sm font-black border border-slate-100" 
                                    value={item.price} 
                                    onChange={(e) => {
                                        const newItems = [...items];
                                        newItems[idx].price = parseFloat(e.target.value) || 0;
                                        setItems(newItems);
                                    }} 
                                  />
                                  <button onClick={() => setItems(items.filter((_, i) => i !== idx))} className="text-slate-300 hover:text-rose-500 transition-colors"><Trash2 size={18} /></button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            <div className="space-y-8">
                 <div className="bg-slate-950 text-white p-10 rounded-[3rem] shadow-2xl">
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Grand Total Payable</p>
                    <h2 className="text-4xl font-black tracking-tighter">{formatCurrency(totalAmount)}</h2>
                    {order.trackingNumber && (
                        <div className="mt-6 pt-6 border-t border-white/10">
                            <p className="text-[9px] font-black text-blue-400 uppercase tracking-widest mb-1">Waybill Handshake</p>
                            <p className="text-lg font-mono font-black">{order.trackingNumber}</p>
                        </div>
                    )}
                 </div>
            </div>
        </div>
    </div>
  );
};