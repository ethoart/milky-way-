import React, { useState, useRef, useEffect } from 'react';
import { db } from '../services/mockBackend';
import { CheckCircle, AlertOctagon, Camera, X, Scan, Upload, FileSpreadsheet, Keyboard, ShieldCheck } from 'lucide-react';
import { Order, OrderStatus } from '../types';
import { Html5QrcodeScanner } from 'html5-qrcode';

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

  // Milky Way Logic: Always keep the input focused for hardware scanners
  useEffect(() => {
    const handleGlobalClick = () => {
        if (activeTab === 'SCAN' && !isCameraActive) {
            inputRef.current?.focus();
        }
    };
    
    document.addEventListener('mousedown', handleGlobalClick);
    inputRef.current?.focus();
    
    const focusInterval = setInterval(() => {
        if (activeTab === 'SCAN' && !isCameraActive && document.activeElement !== inputRef.current) {
            inputRef.current?.focus();
        }
    }, 1000);

    return () => {
        document.removeEventListener('mousedown', handleGlobalClick);
        clearInterval(focusInterval);
    };
  }, [activeTab, isCameraActive]);

  useEffect(() => {
      if (isCameraActive && activeTab === 'SCAN') {
        const scanner = new Html5QrcodeScanner("reader", { 
            fps: 20, 
            qrbox: { width: 280, height: 280 },
            aspectRatio: 1.0
        }, false);
        
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
    const cleanCode = code.trim();
    if (!cleanCode) return;
    
    try {
      const result = await db.processReturn(cleanCode, tenantId);
      if (result) { 
          setProcessedOrder(result); 
          setScanInput(''); 
      }
      else { 
          setError('Invalid Hub Node identifier.'); 
          setScanInput('');
      }
    } catch (err) { 
        setError('Cluster Query Timeout.'); 
        setScanInput('');
    }
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
            <button onClick={() => setActiveTab('RECONCILE')} className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'RECONCILE' ? 'bg-blue-600 text-white shadow-lg' : 'bg-white text-slate-400 border border-slate-100'}`}>Audit Reconcile</button>
        </div>
      </div>

      {activeTab === 'SCAN' && (
        <div className="w-full bg-white p-10 rounded-[3rem] shadow-sm border border-slate-100">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                    <Keyboard size={18} />
                </div>
                <div>
                    <h3 className="text-xs font-black uppercase tracking-widest">Hardware Focus Engaged</h3>
                    <p className="text-[9px] font-bold text-slate-400 uppercase">Connect USB Barcode Machine</p>
                </div>
            </div>
            {!isCameraActive && (
                <button onClick={() => setIsCameraActive(true)} className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-xl text-[9px] font-black uppercase tracking-widest shadow-lg hover:bg-black transition-all">
                    <Camera size={14} /> Use Lens
                </button>
            )}
          </div>

          {isCameraActive && (
              <div className="mb-8 relative animate-slide-in">
                  <div id="reader" className="overflow-hidden rounded-[2rem] border-4 border-blue-500/20 bg-slate-50"></div>
                   <button onClick={() => setIsCameraActive(false)} className="absolute top-4 right-4 bg-black text-white p-3 rounded-2xl z-10 hover:scale-110 transition-all shadow-xl"><X size={24} /></button>
              </div>
          )}

          <form onSubmit={(e) => { e.preventDefault(); handleScanProcess(scanInput); }} className="space-y-4">
            <div className="relative group">
                <input 
                    ref={inputRef} 
                    type="text" 
                    autoFocus
                    value={scanInput} 
                    onChange={(e) => setScanInput(e.target.value)} 
                    className="w-full bg-slate-50 border-2 border-slate-100 text-slate-900 text-2xl font-black text-center py-8 rounded-[2rem] focus:border-blue-600 outline-none transition-all" 
                    placeholder="BEAM READY..." 
                />
                <div className="absolute right-6 top-1/2 -translate-y-1/2 text-slate-200">
                    <Scan size={32} />
                </div>
            </div>
          </form>

          {processedOrder && (
            <div className="mt-8 bg-emerald-50 border border-emerald-100 p-8 rounded-[2rem] flex items-center gap-6 text-emerald-700 animate-slide-in shadow-lg">
                <div className="w-16 h-16 bg-emerald-600 text-white rounded-2xl flex items-center justify-center shadow-xl">
                    <ShieldCheck size={32} />
                </div>
                <div className="flex-1">
                    <h3 className="font-black uppercase text-lg tracking-tight">Return Processed: {processedOrder.customerName}</h3>
                    <p className="text-[10px] font-bold uppercase opacity-60">Status: RETURN COMPLETED</p>
                </div>
                <button onClick={() => setProcessedOrder(null)} className="p-2 hover:bg-emerald-100 rounded-xl"><X size={20}/></button>
            </div>
          )}
          {error && (
            <div className="mt-8 bg-rose-50 border border-rose-100 p-8 rounded-[2rem] flex items-center gap-6 text-rose-600 animate-slide-in">
                <div className="w-16 h-16 bg-rose-600 text-white rounded-2xl flex items-center justify-center shadow-xl">
                    <AlertOctagon size={32} />
                </div>
                <div className="flex-1">
                    <h3 className="font-black uppercase text-lg tracking-tight">Identity Mismatch</h3>
                    <p className="text-[10px] font-bold opacity-70 uppercase">{error}</p>
                </div>
                <button onClick={() => setError(null)} className="p-2 hover:bg-rose-100 rounded-xl"><X size={20}/></button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};