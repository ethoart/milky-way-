
import React, { useState, useEffect } from 'react';
import { db } from '../services/mockBackend';
import { Order, OrderStatus, Product, Tenant } from '../types';
import { 
  ArrowLeft, Truck, Save, 
  Activity, Package, Printer, ShoppingBag
} from 'lucide-react';
import { formatCurrency } from '../utils/helpers';
import { LabelPrintView } from '../components/LabelPrintView';
import { createRoot } from 'react-dom/client';

interface OrderDetailProps {
  orderId: string;
  tenantId: string;
  onBack: () => void;
}

const SRI_LANKA_CITIES = [
  "Colombo", "Gampaha", "Kalutara", "Kandy", "Matale", "Nuwara Eliya", "Galle", "Matara", "Hambantota", 
  "Jaffna", "Kilinochchi", "Mannar", "Vavuniya", "Mullaitivu", "Batticaloa", "Ampara", "Trincomalee", 
  "Kurunegala", "Puttalam", "Anuradhapura", "Polonnaruwa", "Badulla", "Monaragala", "Ratnapura", "Kegalle"
].sort();

// Fix: Exporting OrderDetail component which was missing due to file truncation
export const OrderDetail: React.FC<OrderDetailProps> = ({ orderId, tenantId, onBack }) => {
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [shipping, setShipping] = useState(false);
  const [tenant, setTenant] = useState<Tenant | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [o, t] = await Promise.all([
          db.getOrder(orderId, tenantId),
          db.getTenant(tenantId)
        ]);
        if (o) setOrder(o);
        if (t) setTenant(t);
      } catch (err) {
        console.error("Failed to load order", err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [orderId, tenantId]);

  const handleUpdate = async () => {
    if (!order) return;
    setSaving(true);
    try {
      await db.updateOrder(order);
      alert("Success: Order protocol updated.");
    } catch (e: any) {
      alert("Update Failed: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleShip = async () => {
    if (!order) return;
    if (!confirm("Execute Logistics Handshake?")) return;
    setShipping(true);
    try {
      const updated = await db.shipOrder(order, tenantId);
      setOrder(updated);
      alert("Success: Shipment Dispatched & Tracking Assigned.");
    } catch (e: any) {
      alert("Logistics Error: " + e.message);
    } finally {
      setShipping(false);
    }
  };

  const handlePrint = () => {
    if (!order || !tenant) return;
    const printContainer = document.createElement('div');
    document.body.appendChild(printContainer);
    const root = createRoot(printContainer);
    root.render(<LabelPrintView orders={[order]} settings={tenant.settings} />);
    setTimeout(() => {
      window.print();
      root.unmount();
      document.body.removeChild(printContainer);
    }, 500);
  };

  if (loading) return <div className="p-20 text-center font-black uppercase text-slate-300 tracking-[0.5em]">Accessing Node...</div>;
  if (!order) return <div className="p-20 text-center font-black uppercase text-rose-300 tracking-[0.5em]">Node Not Found</div>;

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-slide-in pb-20">
      <button onClick={onBack} className="flex items-center gap-2 text-slate-400 hover:text-slate-900 font-black text-[10px] uppercase tracking-widest transition-all">
        <ArrowLeft size={16} /> Return to Pipeline
      </button>

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="flex items-center gap-4">
          <div className={`p-4 rounded-[1.5rem] shadow-xl text-white ${order.status === OrderStatus.CONFIRMED ? 'bg-emerald-600' : 'bg-blue-600'}`}>
            <Package size={28} />
          </div>
          <div>
            <h2 className="text-3xl font-black text-slate-900 tracking-tighter uppercase leading-none">Order Registry</h2>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2">Node ID: #{order.id.slice(-8)}</p>
          </div>
        </div>
        <div className="flex gap-3">
           <button onClick={handlePrint} className="px-6 py-3 bg-white border border-slate-200 text-slate-900 rounded-xl font-black text-[10px] uppercase tracking-widest flex items-center gap-2 hover:bg-slate-50 shadow-sm transition-all">
              <Printer size={16} /> Print Label
           </button>
           <button 
             onClick={handleUpdate} 
             disabled={saving}
             className="px-6 py-3 bg-slate-900 text-white rounded-xl font-black text-[10px] uppercase tracking-widest flex items-center gap-2 hover:bg-black shadow-xl transition-all disabled:opacity-50"
           >
              <Save size={16} /> {saving ? 'Syncing...' : 'Save Changes'}
           </button>
           {order.status === OrderStatus.CONFIRMED && (
             <button 
                onClick={handleShip}
                disabled={shipping}
                className="px-8 py-3 bg-blue-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest flex items-center gap-2 hover:bg-blue-700 shadow-xl shadow-blue-500/20 transition-all"
             >
                <Truck size={16} /> {shipping ? 'Connecting Logistics...' : 'Execute Dispatch'}
             </button>
           )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-8 space-y-8">
            <div className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-sm space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Consignee Identity</label>
                        <input className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-3.5 text-sm font-black outline-none focus:ring-2 focus:ring-blue-600 transition-all" value={order.customerName} onChange={e => setOrder({...order, customerName: e.target.value})} />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Secure Contact</label>
                        <input className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-3.5 text-sm font-black outline-none focus:ring-2 focus:ring-blue-600 transition-all" value={order.customerPhone} onChange={e => setOrder({...order, customerPhone: e.target.value})} />
                    </div>
                    <div className="md:col-span-2 space-y-1.5">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Logistics Destination</label>
                        <textarea className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-3.5 text-sm font-black outline-none focus:ring-2 focus:ring-blue-600 transition-all min-h-[100px]" value={order.customerAddress} onChange={e => setOrder({...order, customerAddress: e.target.value})} />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Recipient City</label>
                        <select className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-3.5 text-sm font-black outline-none" value={order.customerCity || ''} onChange={e => setOrder({...order, customerCity: e.target.value})}>
                            <option value="">Select City...</option>
                            {SRI_LANKA_CITIES.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Pipeline Status</label>
                        <select className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-3.5 text-sm font-black outline-none" value={order.status} onChange={e => setOrder({...order, status: e.target.value as OrderStatus})}>
                            {Object.values(OrderStatus).map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
                        </select>
                    </div>
                </div>
            </div>

            <div className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-sm">
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest mb-6 flex items-center gap-2"><ShoppingBag size={18} className="text-blue-600"/> Manifest Composition</h3>
                <div className="space-y-4">
                    {order.items.map((item, idx) => (
                        <div key={idx} className="flex items-center justify-between p-6 bg-slate-50 rounded-[2rem] border border-slate-100">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center text-blue-600 shadow-sm border border-slate-100">
                                    <Package size={20} />
                                </div>
                                <div>
                                    <p className="text-sm font-black text-slate-900 uppercase">{item.name}</p>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Qty: {item.quantity}</p>
                                </div>
                            </div>
                            <div className="text-right">
                                <p className="text-sm font-black text-slate-900">{formatCurrency(item.price * item.quantity)}</p>
                            </div>
                        </div>
                    ))}
                    <div className="flex justify-between items-center p-8 bg-slate-900 text-white rounded-[2rem] shadow-xl">
                        <span className="text-[11px] font-black uppercase tracking-[0.3em]">Total Settlement</span>
                        <span className="text-2xl font-black">{formatCurrency(order.totalAmount)}</span>
                    </div>
                </div>
            </div>
        </div>

        <div className="lg:col-span-4 space-y-8">
            <div className="bg-slate-950 text-white p-8 rounded-[3rem] shadow-2xl space-y-8">
                <h3 className="text-[10px] font-black text-blue-400 uppercase tracking-[0.3em] flex items-center gap-2"><Activity size={16}/> Protocol Logs</h3>
                <div className="space-y-4 max-h-[400px] overflow-auto pr-2 no-scrollbar">
                    {order.logs?.slice().reverse().map(log => (
                        <div key={log.id} className="p-4 bg-white/5 border border-white/10 rounded-2xl space-y-1 group">
                            <p className="text-[11px] font-bold text-slate-300 leading-relaxed uppercase">{log.message}</p>
                            <div className="flex justify-between items-center">
                                <span className="text-[8px] font-black text-blue-500 uppercase tracking-tighter">{log.user}</span>
                                <span className="text-[8px] font-mono text-slate-600">{new Date(log.timestamp).toLocaleString()}</span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};
