import React, { useState, useRef, useEffect } from 'react';
import { db } from '../services/mockBackend';
import { CheckCircle, AlertOctagon, Camera, X, Scan, Upload, FileSpreadsheet, PackageSearch, AlertTriangle } from 'lucide-react';
import { Order, OrderStatus } from '../types';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { parseCSV } from '../utils/helpers';

interface ReturnsProps {
  tenantId: string;
}

export const Returns: React.FC<ReturnsProps> = ({ tenantId }) => {
  const [activeTab, setActiveTab] = useState<'SCAN' | 'RECONCILE'>('SCAN');
  const [scanInput, setScanInput] = useState('');
  const [processedOrder, setProcessedOrder] = useState<Order | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [reconcileResults, setReconcileResults] = useState<{ total: number, missing: string[], matched: number } | null>(null);
  
  const inputRef = useRef<HTMLInputElement>(null);
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);

  useEffect(() => {
    if (activeTab === 'SCAN') inputRef.current?.focus();
    return () => { if (scannerRef.current) scannerRef.current.clear().catch(() => {}); };
  }, [activeTab]);

  useEffect(() => {
      if (isCameraActive && activeTab === 'SCAN') {
        const scanner = new Html5QrcodeScanner("reader", { fps: 15, qrbox: { width: 250, height: 250 } }, false);
        scanner.render((text) => {
            setScanInput(text);
            setIsCameraActive(false);
            handleScanProcess(text);
        }, () => {});
        scannerRef.current = scanner;
      } else if (scannerRef.current) {
         scannerRef.current.clear().catch(() => {});
         scannerRef.current = null;
      }
  }, [isCameraActive, activeTab]);

  const handleScanProcess = async (code: string) => {
    setError(null);
    setProcessedOrder(null);
    if (!code.trim()) return;
    try {
      const result = await db.processReturn(code, tenantId);
      if (result) { setProcessedOrder(result); setScanInput(''); }
      else { setError('Order not found or invalid cluster identifier.'); }
    } catch (err) { setError('System failure while querying cluster.'); }
  };

  const handleCsvUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
        const csvContent = ev.target?.result as string;
        const rows = csvContent.split('\n').map(r => r.trim()).filter(r => r);
        const trackingList = rows.map(r => r.split(',')[0].trim()); // Assume 1st column is tracking

        const systemOrders = await db.getOrders(tenantId);
        const returnCompletedTracking = systemOrders
            .filter(o => o.status === OrderStatus.RETURN_COMPLETED)
            .map(o => o.trackingNumber || o.id);

        const missing = trackingList.filter(t => !returnCompletedTracking.includes(t));
        const matched = trackingList.length - missing.length;

        setReconcileResults({ total: trackingList.length, missing, matched });
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-8 max-w-4xl mx-auto p-4 animate-slide-in">
      <div className="text-center space-y-4">
        <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto shadow-xl rotate-3">
            <Scan size={32} className="text-white" />
        </div>
        <h2 className="text-3xl font-black text-slate-900 tracking-tighter uppercase">Milky Way Scan</h2>
        <div className="flex justify-center gap-2 mt-4">
            <button onClick={() => setActiveTab('SCAN')} className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'SCAN' ? 'bg-blue-600 text-white shadow-lg' : 'bg-white text-slate-400 border border-slate-100'}`}>Terminal Scan</button>
            <button onClick={() => setActiveTab('RECONCILE')} className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'RECONCILE' ? 'bg-blue-600 text-white shadow-lg' : 'bg-white text-slate-400 border border-slate-100'}`}>Return Reconciliation</button>
        </div>
      </div>

      {activeTab === 'SCAN' ? (
        <div className="w-full bg-white p-10 rounded-[3rem] shadow-sm border border-slate-100">
          {isCameraActive ? (
              <div className="mb-6 relative">
                  <div id="reader" className="overflow-hidden rounded-[2rem] border-2 border-blue-500/20 bg-slate-50"></div>
                   <button onClick={() => setIsCameraActive(false)} className="absolute top-4 right-4 bg-black text-white p-3 rounded-2xl z-10 hover:scale-110 transition-all"><X size={24} /></button>
              </div>
          ) : (
            <button onClick={() => setIsCameraActive(true)} className="w-full flex items-center justify-center gap-3 py-6 bg-blue-600 text-white rounded-3xl font-black uppercase text-xs tracking-[0.2em] shadow-xl hover:bg-blue-700 transition-all mb-8"><Camera size={20} /> Activate Optical Scan</button>
          )}
          <form onSubmit={(e) => { e.preventDefault(); handleScanProcess(scanInput); }} className="space-y-4">
            <input ref={inputRef} type="text" value={scanInput} onChange={(e) => setScanInput(e.target.value)} className="w-full bg-slate-50 border-2 border-slate-100 text-slate-900 text-2xl font-black text-center py-6 rounded-3xl focus:border-blue-600 outline-none" placeholder="WAYBILL / ID" />
          </form>
          {processedOrder && (
            <div className="mt-8 bg-emerald-50 border border-emerald-100 p-6 rounded-3xl flex items-center gap-4 text-emerald-700 animate-slide-in">
                <CheckCircle size={32} />
                <div><h3 className="font-black uppercase text-sm">Restocked: {processedOrder.customerName}</h3><p className="text-[10px] font-bold">Node #{processedOrder.id.slice(-6)} updated.</p></div>
            </div>
          )}
          {error && (
            <div className="mt-8 bg-rose-50 border border-rose-100 p-6 rounded-3xl flex items-center gap-4 text-rose-600 animate-shake">
                <AlertOctagon size={32} />
                <div><h3 className="font-black uppercase text-sm">Error</h3><p className="text-[10px] font-bold">{error}</p></div>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white p-10 rounded-[3rem] shadow-sm border border-slate-100 space-y-8">
            <div className="flex items-center gap-4 border-b border-slate-50 pb-6">
                <div className="w-12 h-12 bg-slate-900 text-white rounded-2xl flex items-center justify-center shadow-lg"><FileSpreadsheet size={24} /></div>
                <div><h3 className="text-xl font-black text-slate-900 uppercase">Return Auditor</h3><p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Compare Courier Manifest with Cluster Data</p></div>
            </div>
            <div className="p-10 border-2 border-dashed border-slate-100 rounded-[2rem] flex flex-col items-center justify-center text-center space-y-4">
                <input type="file" id="reconcile-csv" className="hidden" accept=".csv" onChange={handleCsvUpload} />
                <label htmlFor="reconcile-csv" className="cursor-pointer bg-slate-950 text-white px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl hover:scale-105 transition-all">Upload Courier CSV</label>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Supports Waybill/ID in 1st Column</p>
            </div>
            {reconcileResults && (
                <div className="space-y-6 animate-slide-in">
                    <div className="grid grid-cols-3 gap-4">
                        <div className="bg-slate-50 p-6 rounded-3xl text-center">
                            <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Manifest Count</p>
                            <p className="text-3xl font-black text-slate-900">{reconcileResults.total}</p>
                        </div>
                        <div className="bg-emerald-50 p-6 rounded-3xl text-center border border-emerald-100">
                            <p className="text-[9px] font-black text-emerald-600 uppercase mb-1">Matched (Restocked)</p>
                            <p className="text-3xl font-black text-emerald-600">{reconcileResults.matched}</p>
                        </div>
                        <div className="bg-rose-50 p-6 rounded-3xl text-center border border-rose-100">
                            <p className="text-[9px] font-black text-rose-600 uppercase mb-1">Missing / Pending</p>
                            <p className="text-3xl font-black text-rose-600">{reconcileResults.missing.length}</p>
                        </div>
                    </div>
                    {reconcileResults.missing.length > 0 && (
                        <div className="bg-slate-900 text-white p-8 rounded-[2rem] space-y-4">
                            <div className="flex items-center gap-2 text-rose-400 text-[10px] font-black uppercase tracking-widest"><AlertTriangle size={14} /> Missing Records Identified</div>
                            <div className="max-h-40 overflow-y-auto font-mono text-xs space-y-2 pr-4 custom-scrollbar">
                                {reconcileResults.missing.map((id, i) => <div key={i} className="bg-white/5 px-4 py-2 rounded-lg flex justify-between"><span>{id}</span><span className="text-rose-500 font-black">NOT COMPLETED</span></div>)}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
      )}
    </div>
  );
};