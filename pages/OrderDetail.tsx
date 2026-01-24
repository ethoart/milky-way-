import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
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
  const [history, setHistory] = useState<any>(null);
  const [isSaving, setIsSaving] = useState(false);

  const [formData, setFormData] = useState({ 
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
      setHistory(await db.getCustomerHistory(data.customerPhone, tenantId));
      setFormData({ 
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
    root.render(<BillPrintView order={order} settings={tenant.settings} />);
    setTimeout(() => {
        window.print();
        root.unmount();
        document.body.removeChild(printContainer);
    }, 500);
  };

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

  const updateStatus = async (newStatus: OrderStatus) => {
    if (!order) return;
    
    if (newStatus === OrderStatus.CONFIRMED) {
      if (!formData.customerPhone || formData.customerPhone.trim().length < 9) return alert("Consignee Contact Required.");
      if (!formData.customerCity) return alert("Logistics Node (City) Required.");
      if (items.length === 0) return alert("Manifest Empty.");
    }

    if (newStatus === OrderStatus.SHIPPED) {
      setShippingLoading(true);
      try { 
        await db.shipOrder({ ...order, ...formData, items, totalAmount }, tenantId);
        loadData();
      } catch (e: any) { alert(e.message); } 
      finally { setShippingLoading(false); }
      return;
    }

    const log: OrderLog = { 
      id: `l-${Date.now()}`, 
      message: `Status Transition: ${newStatus}`, 
      timestamp: new Date().toISOString(), 
      user: localStorage.getItem('mw_user') ? JSON.parse(localStorage.getItem('mw_user')!).username : 'System'
    };
    
    setIsSaving(true);
    await db.updateOrder({ ...order, ...formData, items, totalAmount, status: newStatus, logs: [...(order.logs || []), log] });
    setIsSaving(false);
    loadData();
  };

  if (loading || !order) return <div className="p-20 text-center font-black uppercase text-slate-300 text-xs">Awaiting Node Data...</div>;

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-20 animate-slide-in no-print">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
                <button onClick={onBack} className="p-4 bg-white border border-slate-100 rounded-3xl text-black shadow-sm hover:bg-slate-50 transition-all"><ArrowLeft size={20} /></button>
                <div>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight uppercase">Registry {order.id.slice(-8)}</h1>
                    <div className="text-[10px] font-black text-blue-600 uppercase tracking-widest mt-1 flex items-center gap-2">
                      <span className="px-2 py-0.5 bg-blue-50 rounded-md">{order.status}</span>
                      <span>•</span>
                      <span>{formatCurrency(totalAmount)}</span>
                    </div>
                </div>
            </div>
            <div className="flex gap-2">
                <button 
                    onClick={handlePrintBill}
                    className="bg-white border border-slate-200 text-slate-900 px-6 py-4 rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-sm flex items-center gap-3 hover:bg-slate-50 transition-all"
                >
                    <Printer size={16} /> Print Courier Label
                </button>
                <button onClick={async () => {
                    setIsSaving(true);
                    await db.updateOrder({ ...order, ...formData, items, totalAmount });
                    setIsSaving(false);
                    alert("Node Synchronized.");
                }} className="bg-black text-white px-8 py-4 rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-xl flex items-center gap-3 active:scale-95 transition-all">
                    {isSaving ? <RefreshCcw size={16} className="animate-spin" /> : <Save size={16} />} 
                    Force Sync
                </button>
            </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-8">
                <div className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-sm space-y-6">
                    <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><Activity size={16}/> Protocol Action</h3>
                    <div className="flex flex-wrap gap-2">
                        {[OrderStatus.OPEN_LEAD, OrderStatus.HOLD, OrderStatus.NO_ANSWER, OrderStatus.REJECTED].map(s => (
                           <button key={s} onClick={() => updateStatus(s)} className={`px-5 py-3 rounded-2xl font-black text-[10px] uppercase transition-all ${order.status === s ? 'bg-blue-600 text-white shadow-lg' : 'bg-slate-50 text-slate-400 hover:text-slate-600'}`}>{s.replace('_', ' ')}</button>
                        ))}
                        <button onClick={() => updateStatus(OrderStatus.CONFIRMED)} className="bg-emerald-600 text-white px-8 py-3 rounded-2xl font-black text-[10px] uppercase shadow-xl hover:bg-emerald-700 transition-all">Confirm Registry</button>
                        {(order.status === OrderStatus.CONFIRMED || order.status === OrderStatus.SHIPPED) && (
                             <button onClick={() => updateStatus(OrderStatus.SHIPPED)} disabled={shippingLoading} className="bg-slate-900 text-white px-10 py-4 rounded-2xl font-black text-[11px] uppercase flex items-center gap-3 hover:bg-black transition-all shadow-2xl">
                                <Truck size={20} className="text-blue-400" /> {shippingLoading ? 'API HANDSHAKE...' : 'DISPATCH TO COURIER'}
                             </button>
                        )}
                    </div>
                </div>

                <div className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-sm space-y-8">
                    <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><UserIcon size={16}/> Consignee Identity</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-1">
                          <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Full Name</label>
                          <input className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-6 py-4 font-black outline-none focus:ring-2 focus:ring-blue-500 transition-all" value={formData.customerName} onChange={e => setFormData({...formData, customerName: e.target.value})} placeholder="Consignee Name" />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Contact Phone</label>
                          <input className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-6 py-4 font-black outline-none focus:ring-2 focus:ring-blue-500 transition-all" value={formData.customerPhone} onChange={e => setFormData({...formData, customerPhone: e.target.value})} placeholder="Phone Number" />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Courier Node (City)</label>
                          <select className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-6 py-4 font-black outline-none" value={formData.customerCity} onChange={e => setFormData({...formData, customerCity: e.target.value})}>
                              <option value="">Select City Node...</option>
                              {SRI_LANKA_CITIES.map(c => <option key={c} value={c}>{c}</option>)}
                          </select>
                        </div>
                        <div className="space-y-1 md:col-span-2">
                          <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Delivery Address</label>
                          <textarea className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-6 py-4 font-black outline-none min-h-[120px] focus:ring-2 focus:ring-blue-500 transition-all" value={formData.customerAddress} onChange={e => setFormData({...formData, customerAddress: e.target.value})} placeholder="Full Street Address" />
                        </div>
                    </div>
                </div>

                <div className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-sm space-y-8">
                    <div className="flex items-center justify-between">
                        <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><Package size={16}/> Manifest Inventory</h3>
                        <button onClick={handleAddItem} className="bg-blue-50 text-blue-600 px-4 py-2 rounded-xl text-[9px] font-black uppercase"><Plus size={14} className="inline mr-1"/> Add Item</button>
                    </div>
                    <div className="space-y-4">
                        {items.map((item, idx) => (
                            <div key={idx} className="p-6 bg-slate-50 rounded-[2rem] border border-slate-100 flex flex-col md:flex-row items-center gap-6 animate-slide-in">
                                <select className="flex-1 w-full bg-white rounded-xl px-4 py-3 text-sm font-bold border border-slate-100" value={item.productId} onChange={(e) => handleUpdateItem(idx, 'productId', e.target.value)}>
                                    {products.map(p => <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>)}
                                </select>
                                <div className="flex items-center gap-3">
                                  <input type="number" className="w-20 bg-white rounded-xl px-4 py-3 text-sm font-black text-center border border-slate-100" value={item.quantity} onChange={(e) => handleUpdateItem(idx, 'quantity', parseInt(e.target.value) || 0)} />
                                  <input type="number" className="w-32 bg-white rounded-xl px-4 py-3 text-sm font-black border border-slate-100" value={item.price} onChange={(e) => handleUpdateItem(idx, 'price', parseFloat(e.target.value) || 0)} />
                                  <button onClick={() => setItems(items.filter((_, i) => i !== idx))} className="text-slate-300 hover:text-rose-500 transition-colors"><Trash2 size={18} /></button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            <div className="space-y-8">
                 <div className="bg-slate-950 text-white p-10 rounded-[3rem] shadow-2xl border border-white/5">
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Total Net Payable</p>
                    <h2 className="text-4xl font-black tracking-tighter">{formatCurrency(totalAmount)}</h2>
                    {order.trackingNumber && (
                      <div className="mt-6 pt-6 border-t border-white/10 space-y-2">
                        <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Tracking Handshake</p>
                        <p className="text-lg font-mono text-blue-400 font-black">{order.trackingNumber}</p>
                      </div>
                    )}
                 </div>
            </div>
        </div>
    </div>
  );
};