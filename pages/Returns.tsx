import React, { useState, useRef, useEffect } from 'react';
import { db } from '../services/mockBackend';
import { CheckCircle, AlertOctagon, Camera, X, Scan, Keyboard, ShieldCheck, Zap, Laptop, Monitor } from 'lucide-react';
import { Order, OrderStatus } from '../types';
import { Html5QrcodeScanner } from 'html5-qrcode';

interface ReturnsProps {
  tenantId: string;
}

export const Returns: React.FC<ReturnsProps> = ({ tenantId }) => {
  const [scanMode, setScanMode] = useState<'HARDWARE' | 'CAMERA' | 'MANUAL'>('HARDWARE');
  const [scanInput, setScanInput] = useState('');
  const [processedOrder, setProcessedOrder] = useState<Order | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  
  const inputRef = useRef<HTMLInputElement>(null);
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);

  // Auto-focus lock for Hardware Scanners (Laser/Beam)
  useEffect(() => {
    if (scanMode === 'HARDWARE') {
        const interval = setInterval(() => {
            if (document.activeElement !== inputRef.current) {
                inputRef.current?.focus();
            }
        }, 800);
        inputRef.current?.focus();
        return () => clearInterval(interval);
    }
  }, [scanMode]);

  useEffect(() => {
      if (scanMode === 'CAMERA') {
        const scanner = new Html5QrcodeScanner("reader", { 
            fps: 20, 
            qrbox: { width: 300, height: 300 },
            aspectRatio: 1.0
        }, false);
        
        scanner.render((text) => {
            handleScanProcess(text);
        }, () => {});
        scannerRef.current = scanner;
      } else if (scannerRef.current) {
         scannerRef.current.clear().catch(() => {});
         scannerRef.current = null;
      }
      return () => { if(scannerRef.current) scannerRef.current.clear().catch(() => {}); };
  }, [scanMode]);

  const handleScanProcess = async (code: string) => {
    if (isProcessing) return;
    setIsProcessing(true);
    setError(null);
    setProcessedOrder(null);
    
    const cleanCode = code.trim();
    if (!cleanCode) { setIsProcessing(false); return; }
    
    try {
      const result = await db.processReturn(cleanCode, tenantId);
      if (result) { 
          setProcessedOrder(result); 
          setScanInput(''); 
          // Audible feedback could be added here
      } else { 
          setError(`Node ID "${cleanCode}" not found in this cluster.`); 
          setScanInput('');
      }
    } catch (err: any) { 
        setError(err.message || 'Restock failure.'); 
        setScanInput('');
    } finally {
        setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-8 max-w-4xl mx-auto p-4 animate-slide-in">
      <div className="text-center space-y-4">
        <div className="w-20 h-20 bg-blue-600 rounded-[2.2rem] flex items-center justify-center mx-auto shadow-2xl rotate-3 border-4 border-white mb-6">
            <Scan size={40} className="text-white" />
        </div>
        <div>
            <h2 className="text-4xl font-black text-slate-900 tracking-tighter uppercase">Milky Way Scan</h2>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em] mt-2">Inventory Restocking Terminal</p>
        </div>
        
        {/* Terminal Mode Selector */}
        <div className="flex flex-wrap justify-center gap-3 mt-10">
            <button 
                onClick={() => setScanMode('HARDWARE')} 
                className={`flex items-center gap-3 px-8 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${scanMode === 'HARDWARE' ? 'bg-slate-900 text-white shadow-2xl scale-105' : 'bg-white text-slate-400 border border-slate-100 hover:bg-slate-50'}`}
            >
                <Laptop size={18}/> Hardware Beam
            </button>
            <button 
                onClick={() => setScanMode('CAMERA')} 
                className={`flex items-center gap-3 px-8 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${scanMode === 'CAMERA' ? 'bg-blue-600 text-white shadow-2xl scale-105' : 'bg-white text-slate-400 border border-slate-100 hover:bg-slate-50'}`}
            >
                <Camera size={18}/> Optical Lens
            </button>
            <button 
                onClick={() => setScanMode('MANUAL')} 
                className={`flex items-center gap-3 px-8 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${scanMode === 'MANUAL' ? 'bg-slate-500 text-white shadow-2xl scale-105' : 'bg-white text-slate-400 border border-slate-100 hover:bg-slate-50'}`}
            >
                <Keyboard size={18}/> Manual Entry
            </button>
        </div>
      </div>

      <div className="w-full bg-white p-10 rounded-[3rem] shadow-sm border border-slate-100">
        {scanMode === 'CAMERA' ? (
            <div className="animate-slide-in space-y-6">
                <div id="reader" className="overflow-hidden rounded-[2.5rem] border-8 border-slate-50 bg-slate-50"></div>
                <div className="text-center">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Scanning via browser lens...</p>
                </div>
            </div>
        ) : (
            <div className="animate-slide-in space-y-8">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl">
                            {scanMode === 'HARDWARE' ? <Monitor size={24} /> : <Keyboard size={24} />}
                        </div>
                        <div>
                            <h3 className="text-sm font-black uppercase tracking-widest">
                                {scanMode === 'HARDWARE' ? 'Laser Bridge Active' : 'Manual Registry Mode'}
                            </h3>
                            <p className="text-[9px] font-bold text-slate-400 uppercase">
                                {scanMode === 'HARDWARE' ? 'Auto-focus Lock Enabled' : 'Type ID and hit Enter'}
                            </p>
                        </div>
                    </div>
                    {isProcessing && <Zap size={20} className="text-blue-500 animate-pulse" />}
                </div>

                <form onSubmit={(e) => { e.preventDefault(); handleScanProcess(scanInput); }} className="relative group">
                    <input 
                        ref={inputRef} 
                        type="text" 
                        autoFocus
                        value={scanInput} 
                        onChange={(e) => setScanInput(e.target.value)} 
                        className="w-full bg-slate-50 border-4 border-slate-100 text-slate-900 text-3xl font-black text-center py-12 rounded-[3.5rem] focus:border-blue-600 outline-none transition-all placeholder:text-slate-200" 
                        placeholder={scanMode === 'HARDWARE' ? "READY TO BEAM..." : "ENTER NODE ID..."}
                    />
                    <div className="absolute right-10 top-1/2 -translate-y-1/2 text-slate-200">
                        {scanMode === 'HARDWARE' ? <Scan size={44} /> : <Keyboard size={44} />}
                    </div>
                </form>
            </div>
        )}

        {/* Status Feedback Display */}
        <div className="mt-10 min-h-[140px]">
            {processedOrder && (
                <div className="bg-emerald-50 border-2 border-emerald-100 p-8 rounded-[2.5rem] flex items-center gap-6 text-emerald-700 animate-slide-in shadow-xl shadow-emerald-500/10">
                    <div className="w-16 h-16 bg-emerald-600 text-white rounded-2xl flex items-center justify-center shadow-lg">
                        <ShieldCheck size={32} />
                    </div>
                    <div className="flex-1">
                        <h3 className="font-black uppercase text-xl tracking-tight leading-none mb-2">Restock Success</h3>
                        <p className="text-[11px] font-black uppercase opacity-60">
                            Subject: {processedOrder.customerName} <br/>
                            ID: {processedOrder.id}
                        </p>
                    </div>
                    <button onClick={() => setProcessedOrder(null)} className="p-2 hover:bg-emerald-100 rounded-xl transition-all"><X size={24}/></button>
                </div>
            )}
            {error && (
                <div className="bg-rose-50 border-2 border-rose-100 p-8 rounded-[2.5rem] flex items-center gap-6 text-rose-600 animate-shake shadow-xl shadow-rose-500/10">
                    <div className="w-16 h-16 bg-rose-600 text-white rounded-2xl flex items-center justify-center shadow-lg">
                        <AlertOctagon size={32} />
                    </div>
                    <div className="flex-1">
                        <h3 className="font-black uppercase text-xl tracking-tight leading-none mb-2">Registry Blocked</h3>
                        <p className="text-[11px] font-black opacity-70 uppercase leading-relaxed">{error}</p>
                    </div>
                    <button onClick={() => setError(null)} className="p-2 hover:bg-rose-100 rounded-xl transition-all"><X size={24}/></button>
                </div>
            )}
            {!processedOrder && !error && (
                <div className="h-full flex flex-col items-center justify-center text-slate-200 py-8 opacity-40">
                    <Zap size={56} className="mb-4" />
                    <p className="text-[11px] font-black uppercase tracking-[0.5em]">System Idle • Handshake Ready</p>
                </div>
            )}
        </div>
      </div>
    </div>
  );
};