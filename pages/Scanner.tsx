
import React, { useState, useRef, useEffect } from 'react';
import { db } from '../services/mockBackend';
import { 
    ScanLine, 
    ArrowRight, 
    CheckCircle, 
    AlertOctagon, 
    Camera, 
    X, 
    Truck, 
    RotateCcw, 
    Search,
    Loader2,
    ShieldCheck,
    Navigation,
    ShoppingBag
} from 'lucide-react';
import { Order, OrderStatus } from '../types';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { formatCurrency } from '../utils/helpers';

interface ScannerProps {
  tenantId: string;
}

type ScanMode = 'RETURN' | 'SHIP' | 'INFO';

export const Scanner: React.FC<ScannerProps> = ({ tenantId }) => {
  const [mode, setMode] = useState<ScanMode>('RETURN');
  const [scanInput, setScanInput] = useState('');
  const [processedOrder, setProcessedOrder] = useState<Order | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
    return () => {
        if (scannerRef.current) {
            scannerRef.current.clear().catch(console.error);
        }
    };
  }, []);

  useEffect(() => {
      if (isCameraActive) {
        const scanner = new Html5QrcodeScanner(
            "reader", 
            { fps: 20, qrbox: { width: 280, height: 160 } },
            false
        );
        scanner.render(onScanSuccess, onScanFailure);
        scannerRef.current = scanner;
      } else {
         if (scannerRef.current) {
             scannerRef.current.clear().catch(console.error);
             scannerRef.current = null;
         }
      }
  }, [isCameraActive]);

  const onScanSuccess = (decodedText: string) => {
      // Haptic feedback
      if ("vibrate" in navigator) navigator.vibrate(80);
      setScanInput(decodedText);
      setIsCameraActive(false);
      handleScanProcess(decodedText);
  };

  const onScanFailure = () => { /* Scan in progress... */ };

  const handleScanProcess = async (code: string) => {
    setError(null);
    setProcessedOrder(null);
    if (!code.trim()) return;
    setLoading(true);

    try {
      const orders = await db.getOrders(tenantId);
      // Search by exact ID, exact tracking number, or partial match for fuzzy scanning
      const order = orders.find(o => 
          o.id === code || 
          o.trackingNumber === code || 
          o.customerPhone === code ||
          o.id.endsWith(code)
      );
      
      if (!order) {
          setError('Entry ID not recognized in current Milky Way Segment.');
          setLoading(false);
          return;
      }

      if (mode === 'INFO') {
          setProcessedOrder(order);
          setScanInput('');
      } else if (mode === 'RETURN') {
          const result = await db.processReturn(order.id, tenantId);
          if (result) {
              setProcessedOrder(result);
              setScanInput('');
          } else {
              setError('Subject ineligible for return protocol.');
          }
      } else if (mode === 'SHIP') {
          if (order.status === OrderStatus.CONFIRMED || order.status === OrderStatus.PENDING) {
              const result = await db.shipOrder(order, tenantId);
              setProcessedOrder(result);
              setScanInput('');
          } else {
              setError(`Order state conflict: Cannot SHIP from status ${order.status}`);
          }
      }
    } catch (err) {
      setError('System integrity failure: Could not reach cluster node.');
    } finally {
      setLoading(false);
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      handleScanProcess(scanInput);
  };

  const ModeButton = ({ target, label, icon, sub }: { target: ScanMode, label: string, icon: React.ReactNode, sub: string }) => (
    <button 
        onClick={() => { setMode(target); setProcessedOrder(null); setError(null); }}
        className={`flex-1 flex flex-col items-center gap-2 p-5 rounded-[2rem] border transition-all duration-300 ${
            mode === target 
            ? 'bg-slate-900 text-white border-slate-900 shadow-2xl scale-105 z-10' 
            : 'bg-white text-slate-400 border-slate-100 hover:bg-slate-50'
        }`}
    >
        <div className={`p-3 rounded-2xl ${mode === target ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-400'}`}>
            {icon}
        </div>
        <div className="text-center">
            <span className="text-[10px] font-black uppercase tracking-widest block leading-none">{label}</span>
            <span className="text-[7px] font-bold uppercase opacity-50 tracking-tighter">{sub}</span>
        </div>
    </button>
  );

  return (
    <div className="flex flex-col items-center justify-center min-h-[85vh] py-10 space-y-8 max-w-2xl mx-auto px-4">
      <div className="text-center space-y-3">
        <div className="w-24 h-24 bg-slate-950 rounded-[2.5rem] flex items-center justify-center mx-auto mb-6 shadow-2xl relative overflow-hidden group">
            <div className="absolute inset-0 bg-blue-600/20 blur-xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
            <ScanLine size={44} className="text-white relative z-10" />
        </div>
        <h2 className="text-5xl font-black text-slate-900 tracking-tighter uppercase leading-none">Milky Way Scanner</h2>
        <p className="text-[11px] font-black text-slate-400 uppercase tracking-[0.4em]">Unified OMS Terminal Protocol</p>
      </div>

      <div className="w-full bg-white p-10 rounded-[3.5rem] shadow-2xl border border-slate-100 space-y-10 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-48 h-48 bg-blue-600/5 rounded-full blur-3xl pointer-events-none"></div>
          
          <div className="flex gap-4 relative z-10">
              <ModeButton target="RETURN" label="Return" sub="Restock Item" icon={<RotateCcw size={22}/>} />
              <ModeButton target="SHIP" label="Dispatch" sub="Mark Shipped" icon={<Truck size={22}/>} />
              <ModeButton target="INFO" label="Inspect" sub="Registry Data" icon={<Search size={22}/>} />
          </div>

          {isCameraActive ? (
              <div className="relative animate-slide-in">
                  <div className="absolute inset-0 border-[12px] border-slate-950/20 rounded-[2.5rem] pointer-events-none z-10"></div>
                  <div id="reader" className="overflow-hidden rounded-[2.5rem] border-4 border-slate-950 shadow-inner bg-slate-950 aspect-video"></div>
                   <button 
                    onClick={() => setIsCameraActive(false)}
                    className="absolute -top-5 -right-5 bg-rose-600 p-4 rounded-full text-white shadow-2xl z-20 hover:scale-110 active:scale-95 transition-all"
                  >
                      <X size={24} />
                  </button>
                  <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-slate-900/80 backdrop-blur-md px-6 py-2 rounded-full border border-white/10 z-10">
                    <p className="text-[9px] font-black text-white uppercase tracking-widest whitespace-nowrap">Optics Active • Align Barcode</p>
                  </div>
              </div>
          ) : (
            <button 
                type="button"
                onClick={() => setIsCameraActive(true)}
                className="w-full flex flex-col items-center justify-center gap-4 py-16 bg-slate-50 border-2 border-dashed border-slate-200 text-slate-400 rounded-[3rem] transition-all group hover:border-blue-500 hover:bg-blue-50/20"
            >
                <div className="p-6 bg-white rounded-3xl shadow-lg border border-slate-100 group-hover:scale-110 group-hover:shadow-blue-200 transition-all">
                    <Camera size={40} />
                </div>
                <div className="text-center">
                    <p className="font-black uppercase tracking-[0.2em] text-[12px] group-hover:text-blue-600 transition-colors">Initialize Visual Uplink</p>
                    <p className="text-[9px] font-bold uppercase opacity-50 mt-1">Camera Scanner Module</p>
                </div>
            </button>
          )}

          <div className="relative flex items-center gap-6">
              <div className="flex-1 h-px bg-slate-100"></div>
              <span className="text-[9px] text-slate-300 font-black uppercase tracking-[0.3em]">Manual Override</span>
              <div className="flex-1 h-px bg-slate-100"></div>
          </div>

          <form onSubmit={handleManualSubmit} className="relative">
            <input
                ref={inputRef}
                type="text"
                value={scanInput}
                onChange={(e) => setScanInput(e.target.value)}
                className="w-full bg-slate-50 border-none text-slate-900 text-4xl font-black text-center py-8 rounded-[2rem] focus:ring-4 focus:ring-blue-500/10 outline-none transition-all placeholder:text-slate-200 tracking-tighter"
                placeholder="ID CODE..."
                disabled={isCameraActive || loading}
            />
            <button 
                type="submit" 
                disabled={loading || !scanInput} 
                className="absolute right-6 top-1/2 -translate-y-1/2 p-4 text-slate-300 hover:text-blue-600 bg-white rounded-2xl shadow-sm border border-slate-100 transition-all disabled:opacity-0"
            >
                <ArrowRight size={28} />
            </button>
          </form>
      </div>

      {processedOrder && (
        <div className="w-full bg-white p-10 rounded-[3.5rem] animate-slide-in shadow-2xl border-l-[12px] border-emerald-500 flex flex-col md:flex-row gap-8 items-center">
          <div className="w-24 h-24 bg-emerald-50 rounded-[2rem] flex items-center justify-center text-emerald-600 shrink-0 shadow-inner">
            <ShieldCheck size={48} />
          </div>
          <div className="flex-1 text-center md:text-left space-y-4">
              <div className="space-y-1">
                <div className="flex items-center justify-center md:justify-start gap-3">
                    <h3 className="text-3xl font-black text-slate-900 tracking-tighter uppercase">Subject Synced</h3>
                    <span className="px-3 py-1 bg-emerald-600 text-white rounded-xl text-[9px] font-black uppercase tracking-widest">{mode} SUCCESS</span>
                </div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Global Registry Updated: {new Date().toLocaleTimeString()}</p>
              </div>
              
              <div className="grid grid-cols-2 gap-4 bg-slate-50 p-6 rounded-[2rem] border border-slate-100">
                  <div className="flex flex-col">
                      <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Invoice ID</span>
                      <span className="text-[13px] font-mono font-black text-slate-900">{processedOrder.id}</span>
                  </div>
                  <div className="flex flex-col">
                      <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Consignee</span>
                      <span className="text-[13px] font-black text-slate-900 truncate">{processedOrder.customerName}</span>
                  </div>
                  <div className="flex flex-col">
                      <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Terminal State</span>
                      <span className="text-[12px] font-black text-blue-600 uppercase">{processedOrder.status.replace('_', ' ')}</span>
                  </div>
                  <div className="flex flex-col">
                      <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">COD Valuation</span>
                      <span className="text-[13px] font-black text-slate-900">{formatCurrency(processedOrder.totalAmount)}</span>
                  </div>
              </div>

              {processedOrder.items.length > 0 && (
                <div className="flex flex-wrap gap-2">
                    {processedOrder.items.map((item, idx) => (
                        <div key={idx} className="bg-white border border-slate-200 px-3 py-1.5 rounded-xl flex items-center gap-2">
                            <ShoppingBag size={12} className="text-slate-400" />
                            <span className="text-[10px] font-black text-slate-700 uppercase">{item.name} <span className="text-blue-500">x{item.quantity}</span></span>
                        </div>
                    ))}
                </div>
              )}
          </div>
        </div>
      )}

      {error && (
        <div className="w-full bg-white p-10 rounded-[3.5rem] animate-shake shadow-2xl border-l-[12px] border-rose-500 flex gap-8 items-center">
          <div className="w-20 h-20 bg-rose-50 rounded-[2rem] flex items-center justify-center text-rose-500 shrink-0 shadow-inner">
            <AlertOctagon size={40} />
          </div>
          <div>
            <h3 className="text-2xl font-black text-rose-600 uppercase tracking-tight">Access Protocol Failure</h3>
            <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest mt-1 leading-relaxed">{error}</p>
            <button onClick={() => setError(null)} className="mt-4 text-[9px] font-black text-rose-500 uppercase tracking-widest bg-rose-50 px-4 py-2 rounded-xl hover:bg-rose-100 transition-colors">Clear Protocol Error</button>
          </div>
        </div>
      )}

      {loading && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-xl z-[100] flex items-center justify-center">
              <div className="bg-white p-12 rounded-[4rem] flex flex-col items-center gap-6 shadow-2xl scale-110 border border-white/20">
                  <div className="relative">
                    <Loader2 size={64} className="text-blue-600 animate-spin" />
                    <Navigation size={24} className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-slate-900" />
                  </div>
                  <div className="text-center space-y-1">
                    <p className="text-[11px] font-black uppercase tracking-[0.4em] text-slate-900">Querying Clusters</p>
                    <p className="text-[8px] font-bold uppercase text-slate-400 tracking-widest">Global Synchronization Active</p>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};
