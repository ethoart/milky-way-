import React, { useState, useEffect, useRef } from 'react';
import { db } from '../services/mockBackend';
import { Product, Order, OrderStatus } from '../types';
import { UserPlus, Upload, FileSpreadsheet, AlertCircle, CheckCircle2, ChevronDown, Activity, History, Package, ShieldAlert, AlertTriangle } from 'lucide-react';
import { parseCSV, formatCurrency } from '../utils/helpers';

interface LeadsProps {
  tenantId: string;
}

export const Leads: React.FC<LeadsProps> = ({ tenantId }) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [currentUser, setCurrentUser] = useState<string>('System');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [manualForm, setManualForm] = useState({ name: '', phone: '', address: '', productId: '' });
  const [customerHistory, setCustomerHistory] = useState<any>(null);
  const [csvText, setCsvText] = useState('');
  const [csvProductId, setCsvProductId] = useState('');
  const [message, setMessage] = useState<{ text: string, type: 'success' | 'error' | 'info' } | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    db.getProducts(tenantId).then(setProducts);
    const saved = localStorage.getItem('mw_user');
    if (saved) setCurrentUser(JSON.parse(saved).username);
  }, [tenantId]);

  useEffect(() => {
    const lookup = async () => {
      const normalizedPhone = manualForm.phone.replace(/\D/g, '');
      if (normalizedPhone.length >= 9) {
          const h = await db.getCustomerHistory(normalizedPhone, tenantId);
          setCustomerHistory(h);
      } else {
          setCustomerHistory(null);
      }
    };
    const timer = setTimeout(lookup, 300);
    return () => clearTimeout(timer);
  }, [manualForm.phone]);

  const handleManualSubmit = async () => {
    if (!manualForm.name || !manualForm.phone || !manualForm.productId) return alert("Fill required fields");
    const p = products.find(x => x.id === manualForm.productId);
    if (!p) return;
    const order: Order = {
      id: `ord-${Date.now()}`,
      tenantId,
      customerName: manualForm.name,
      customerPhone: manualForm.phone,
      customerAddress: manualForm.address,
      items: [{ productId: p.id, name: p.name, price: p.price, quantity: 1 }],
      totalAmount: p.price,
      status: OrderStatus.PENDING, // Changed to PENDING
      createdAt: new Date().toISOString(),
      isPrinted: false,
      openedBy: currentUser,
      logs: [{ id: `l-${Date.now()}`, message: 'Manual Creation (Pending)', timestamp: new Date().toISOString(), user: currentUser }]
    };
    await db.createOrders([order]);
    setMessage({ text: "Lead registered (Pending Status)", type: 'success' });
    setManualForm({ name: '', phone: '', address: '', productId: '' });
    setCustomerHistory(null);
  };

  const InputField = ({ label, ...props }: any) => (
    <div className="space-y-1.5">
      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{label}</label>
      <input 
        {...props} 
        className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-3.5 text-sm font-black text-slate-900 outline-none focus:ring-2 focus:ring-blue-500 transition-all placeholder:text-slate-300" 
      />
    </div>
  );

  return (
    <div className="space-y-8 animate-slide-in max-w-[1300px] mx-auto pb-20">
      <div className="flex items-center justify-between px-2">
        <div>
          <h2 className="text-4xl font-black text-slate-900 tracking-tighter uppercase leading-none">Inbound Leads</h2>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2">Subject injection & Risk analysis</p>
        </div>
        {message && (
            <div className={`flex items-center gap-3 px-6 py-3 rounded-2xl border text-[11px] font-black uppercase tracking-widest shadow-xl transition-all ${
                message.type === 'success' ? 'bg-emerald-600 text-white border-none' : 'bg-blue-600 text-white border-none'
            }`}>
                {message.type === 'success' ? <CheckCircle2 size={16}/> : <AlertCircle size={16}/>} {message.text}
            </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <div className="lg:col-span-8 space-y-8">
            <div className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-sm space-y-10">
              <div className="flex items-center justify-between pb-6 border-b border-slate-50">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-blue-600 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-blue-200">
                    <UserPlus size={24} />
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-slate-900 tracking-tighter uppercase">Manual Subject</h3>
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Initial status: PENDING</p>
                  </div>
                </div>
                {customerHistory?.count > 0 && (
                    <div className="flex items-center gap-2 px-5 py-2.5 bg-amber-50 text-amber-600 border border-amber-100 rounded-2xl text-[10px] font-black uppercase tracking-tight animate-pulse">
                        <AlertTriangle size={16} /> DUPLICATE: {customerHistory.count} PREVIOUS RECORDS
                    </div>
                )}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <InputField label="Identity Name" value={manualForm.name} onChange={(e: any) => setManualForm({...manualForm, name: e.target.value})} placeholder="Ex. John Doe" />
                <InputField label="Primary Contact (Phone)" value={manualForm.phone} onChange={(e: any) => setManualForm({...manualForm, phone: e.target.value})} placeholder="Ex. 0771234567" />
                <div className="md:col-span-2 space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Deployment Address</label>
                  <textarea 
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 text-sm font-black text-slate-900 outline-none focus:ring-2 focus:ring-blue-500 transition-all min-h-[100px]"
                    value={manualForm.address} onChange={(e: any) => setManualForm({...manualForm, address: e.target.value})}
                    placeholder="Full street address..."
                  />
                </div>
                <div className="md:col-span-2 space-y-2 relative">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">SKU Assignment</label>
                  <select 
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 text-sm font-black text-slate-900 outline-none appearance-none"
                    value={manualForm.productId} onChange={(e: any) => setManualForm({...manualForm, productId: e.target.value})}
                  >
                    <option value="">Select Target SKU...</option>
                    {products.map(p => <option key={p.id} value={p.id}>{p.name} - {formatCurrency(p.price)}</option>)}
                  </select>
                  <ChevronDown className="absolute right-6 bottom-4 text-slate-400 pointer-events-none" size={18} />
                </div>
              </div>
              <button onClick={handleManualSubmit} className="w-full py-5 bg-black text-white rounded-[1.5rem] font-black text-xs uppercase tracking-widest shadow-2xl hover:scale-105 active:scale-95 transition-all">
                Inject into Pipeline
              </button>
            </div>

            <div className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-sm space-y-8">
              <div className="flex items-center justify-between pb-6 border-b border-slate-50">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-indigo-600 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-200">
                    <FileSpreadsheet size={24} />
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-slate-900 tracking-tighter uppercase">Bulk Stream</h3>
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">CSV (full_name, street_address, phone)</p>
                  </div>
                </div>
                <button onClick={() => fileInputRef.current?.click()} className="text-[10px] font-black text-blue-600 uppercase bg-blue-50 px-5 py-2.5 rounded-xl border border-blue-100 hover:bg-blue-600 hover:text-white transition-all">
                  Load Source File
                </button>
                <input type="file" ref={fileInputRef} onChange={(e) => {
                  const f = e.target.files?.[0];
                  if(!f) return;
                  const r = new FileReader();
                  r.onload = (ev) => setCsvText(ev.target?.result as string);
                  r.readAsText(f);
                }} className="hidden" accept=".csv" />
              </div>
              <div className="space-y-6">
                <div className="space-y-2 relative">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Stream Assignment (SKU)</label>
                  <select className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 text-sm font-black text-slate-900 outline-none appearance-none" value={csvProductId} onChange={(e) => setCsvProductId(e.target.value)}>
                    <option value="">Select SKU for Bulk Payload...</option>
                    {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                  <ChevronDown className="absolute right-6 bottom-4 text-slate-400 pointer-events-none" size={18} />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Source Stream (Raw CSV Data)</label>
                  <textarea 
                    className="w-full bg-slate-900 border-none rounded-3xl px-8 py-6 text-emerald-400 font-mono text-xs outline-none shadow-2xl resize-none min-h-[250px] leading-relaxed"
                    value={csvText} onChange={(e) => setCsvText(e.target.value)}
                    placeholder="full_name, street_address, phone"
                  />
                </div>
              </div>
              <button onClick={async () => {
                if(!csvText || !csvProductId) return;
                setIsProcessing(true);
                const p = products.find(x => x.id === csvProductId);
                if(!p) return;
                const leads = parseCSV(csvText);
                const orders = leads.map((l, i) => ({
                  id: `bulk-${Date.now()}-${i}`,
                  tenantId, customerName: l.name, customerPhone: l.phone, customerAddress: l.address,
                  items: [{ productId: p.id, name: p.name, price: p.price, quantity: 1 }],
                  totalAmount: p.price, status: OrderStatus.PENDING, createdAt: new Date().toISOString(),
                  isPrinted: false, openedBy: currentUser, logs: []
                }));
                // Process in one batch for speed
                await db.createOrders(orders);
                setMessage({ text: `Sync Complete: ${orders.length} leads (Pending Status)`, type: 'success' });
                setIsProcessing(false);
                setCsvText('');
              }} disabled={isProcessing} className="w-full py-5 bg-blue-600 text-white rounded-[1.5rem] font-black text-xs uppercase tracking-widest shadow-2xl hover:bg-blue-700 active:scale-95 transition-all disabled:opacity-50">
                {isProcessing ? 'BATCH SYNCHRONIZING...' : 'EXECUTE BULK STREAM'}
              </button>
            </div>
        </div>

        <div className="lg:col-span-4 space-y-8 sticky top-10">
            <div className="bg-slate-950 text-white p-10 rounded-[3rem] shadow-2xl relative overflow-hidden flex flex-col min-h-[500px] border border-white/5">
                <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600 rounded-full blur-[100px] opacity-20 transform translate-x-1/2 -translate-y-1/2"></div>
                <div className="relative z-10">
                    <div className="flex items-center gap-3 mb-10">
                        <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center">
                            <History size={20} className="text-blue-400" />
                        </div>
                        <h3 className="text-sm font-black uppercase tracking-[0.2em]">Customer Intel</h3>
                    </div>
                    {!customerHistory ? (
                        <div className="flex-1 flex flex-col items-center justify-center text-center py-20 opacity-30">
                            <Package size={64} className="mb-6 stroke-1" />
                            <p className="text-[10px] font-black uppercase tracking-[0.4em] leading-relaxed">Awaiting identity input</p>
                        </div>
                    ) : (
                        <div className="space-y-10 animate-slide-in">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-white/5 p-6 rounded-3xl border border-white/10 text-center">
                                    <p className="text-[9px] font-black text-slate-500 uppercase mb-2 tracking-widest">History</p>
                                    <p className="text-4xl font-black text-white">{customerHistory.count}</p>
                                </div>
                                <div className={`p-6 rounded-3xl border text-center ${customerHistory.returns > 0 ? 'bg-rose-500/10 border-rose-500/30' : 'bg-emerald-500/10 border-emerald-500/30'}`}>
                                    <p className="text-[9px] font-black text-slate-500 uppercase mb-2 tracking-widest">Returns</p>
                                    <p className={`text-4xl font-black ${customerHistory.returns > 0 ? 'text-rose-500' : 'text-emerald-500'}`}>{customerHistory.returns}</p>
                                </div>
                            </div>
                            {customerHistory.returns > 0 && (
                                <div className="bg-rose-600/20 border border-rose-600/30 p-6 rounded-3xl flex items-start gap-4">
                                    <ShieldAlert size={20} className="text-rose-500 shrink-0 mt-0.5" />
                                    <div>
                                        <p className="text-[11px] font-black text-rose-200 uppercase tracking-tight">Integrity Alert</p>
                                        <p className="text-[10px] font-bold text-rose-400 mt-1 uppercase leading-tight">High rejection risk detected.</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};