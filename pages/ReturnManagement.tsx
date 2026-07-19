
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { db } from '../services/mockBackend';
import { Order, OrderStatus, Product } from '../types';
import { OrderList } from './OrderList';
import { RotateCcw, Scan, RotateCw, History, CheckCircle, ListFilter, ClipboardCheck, RefreshCw, Calendar, AlertTriangle, Box, ChevronDown, ArrowRightLeft } from 'lucide-react';
import { getSLDateString, getOrderActivityDate } from '../utils/helpers';

interface ReturnManagementProps {
  tenantId: string;
  shopName: string;
  onSelectOrder: (id: string) => void;
}

export const ReturnManagement: React.FC<ReturnManagementProps> = ({ tenantId, shopName, onSelectOrder }) => {
  const [activeFilter, setActiveFilter] = useState<OrderStatus | 'RETURN_ALL'>('RETURN_ALL');
  const [scanInput, setScanInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<string>('ALL');
  const [counts, setCounts] = useState<Record<string, number>>({});
  const scanRef = useRef<HTMLInputElement>(null);
  
  // Date Filters (Default to today for activity-based view)
  const [startDate, setStartDate] = useState(getSLDateString());
  const [endDate, setEndDate] = useState(getSLDateString());

  // Scan Feedback
  const [scanResult, setScanResult] = useState<{ msg: string, type: 'success' | 'warning' | 'error' } | null>(null);

  const load = async () => {
    const fetchedProducts = await db.getProducts(tenantId);
    setProducts(fetchedProducts || []);
    db.getOrderCounts({ tenantId, productId: selectedProductId, startDate, endDate, dateField: "shippedAt" }).then(setCounts);

    setProducts(fetchedProducts || []);
  };

  useEffect(() => {
    load();
    const focusTimer = setInterval(() => {
      if (document.activeElement !== scanRef.current) scanRef.current?.focus();
    }, 1500);
    return () => clearInterval(focusTimer);
  }, [tenantId, refreshKey]);

  const applyPreset = (preset: 'TODAY' | 'WEEK' | 'MONTH' | 'YEAR') => {
    const end = new Date();
    const start = new Date();
    if (preset === 'WEEK') start.setDate(end.getDate() - 7);
    if (preset === 'MONTH') {
        start.setDate(1);
        end.setMonth(end.getMonth() + 1);
        end.setDate(0);
    }
    if (preset === 'YEAR') start.setFullYear(end.getFullYear() - 1);
    
    setStartDate(getSLDateString(start));
    setEndDate(getSLDateString(end));
  };

  const handleScan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!scanInput.trim() || isProcessing) return;
    setIsProcessing(true);
    setScanResult(null);
    try {
      const currentUser = localStorage.getItem('mw_user') ? JSON.parse(localStorage.getItem('mw_user')!).username : 'System';
      const result: any = await db.processReturn(scanInput, tenantId, currentUser);
      if (result) {
        if (result.alreadyProcessed) {
            setScanResult({ msg: `ALREADY SCANNED: ${result.customerName}`, type: 'warning' });
            try { new Audio('https://assets.mixkit.co/active_storage/sfx/2573/2573-preview.mp3').play(); } catch(e){}
        } else {
            setScanResult({ msg: `SUCCESS: Restocked ${result.customerName}`, type: 'success' });
            try { new Audio('https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3').play(); } catch(e){}
            setRefreshKey(prev => prev + 1);
        }
        setScanInput('');
      } else {
        setScanResult({ msg: "REFERENCE NOT FOUND", type: 'error' });
      }
    } catch(e) {
        setScanResult({ msg: "SYSTEM ERROR", type: 'error' });
    } finally {
      setIsProcessing(false);
    }
  };

  // Base list of orders filtered by Date and Product (Shared by Stats and List)
  const filteredCounts = { 
    ALL: (counts[OrderStatus.RETURNED] || 0) + (counts[OrderStatus.RETURN_TRANSFER] || 0) + (counts[OrderStatus.RETURN_AS_ON_SYSTEM] || 0) + (counts[OrderStatus.RETURN_HANDOVER] || 0) + (counts[OrderStatus.RETURN_COMPLETED] || 0),
    RETURNED: counts[OrderStatus.RETURNED] || 0,
    RETURN_TRANSFER: counts[OrderStatus.RETURN_TRANSFER] || 0,
    RETURN_AS_ON_SYSTEM: counts[OrderStatus.RETURN_AS_ON_SYSTEM] || 0,
    RETURN_HANDOVER: counts[OrderStatus.RETURN_HANDOVER] || 0,
    RETURN_COMPLETED: counts[OrderStatus.RETURN_COMPLETED] || 0
  };


  const filters = [
    { label: 'ALL RETURNS', status: 'RETURN_ALL', icon: <ListFilter size={14}/>, count: filteredCounts.ALL },
    { label: 'RETURNED', status: OrderStatus.RETURNED, icon: <RotateCcw size={14}/>, count: filteredCounts.RETURNED },
    { label: 'RETURN TRANSFER', status: OrderStatus.RETURN_TRANSFER, icon: <ArrowRightLeft size={14}/>, count: filteredCounts.RETURN_TRANSFER },
    { label: 'AS ON SYSTEM', status: OrderStatus.RETURN_AS_ON_SYSTEM, icon: <History size={14}/>, count: filteredCounts.RETURN_AS_ON_SYSTEM },
    { label: 'PENDING (HANDOVER)', status: OrderStatus.RETURN_HANDOVER, icon: <ClipboardCheck size={14}/>, count: filteredCounts.RETURN_HANDOVER },
    { label: 'COMPLETED', status: OrderStatus.RETURN_COMPLETED, icon: <CheckCircle size={14}/>, count: filteredCounts.RETURN_COMPLETED },
  ];

  return (
    <div className="space-y-8 animate-slide-in max-w-[1400px] mx-auto pb-20">
      <div className="flex flex-col xl:flex-row justify-between items-end gap-6 px-2">
        <div className="flex items-center gap-4">
          <div className="p-4 bg-blue-600 text-white rounded-[2rem] shadow-xl rotate-3">
            <RotateCcw size={28} />
          </div>
          <div>
            <h2 className="text-3xl font-black text-slate-900 tracking-tighter uppercase leading-none">{shopName} Returns Hub</h2>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2">Logistics Reversal & Restock Controller</p>
          </div>
        </div>

        <div className="flex flex-col items-end gap-3 w-full xl:w-auto">
            {/* Presets */}
            <div className="flex gap-2 p-1 bg-white border border-slate-100 rounded-xl shadow-sm">
                {(['TODAY', 'WEEK', 'MONTH', 'YEAR'] as const).map(p => (
                    <button key={p} onClick={() => applyPreset(p)} className="px-4 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest text-slate-500 hover:bg-slate-50 hover:text-slate-900 transition-all">
                        {p}
                    </button>
                ))}
            </div>

            <div className="flex flex-col md:flex-row items-center gap-3 w-full">
                {/* Product Select */}
                <div className="bg-white px-4 py-3 rounded-[1.5rem] border border-slate-100 shadow-sm flex items-center gap-3 relative min-w-[200px] w-full md:w-auto">
                    <Box size={14} className="text-blue-600" />
                    <select value={selectedProductId} onChange={e => setSelectedProductId(e.target.value)} className="w-full text-[10px] font-black text-slate-900 outline-none uppercase bg-transparent cursor-pointer appearance-none">
                        <option value="ALL">ALL PRODUCTS</option>
                        {products.map(p => <option key={p.id} value={p.id}>{p.sku} - {p.name}</option>)}
                    </select>
                    <ChevronDown size={12} className="absolute right-4 text-slate-400 pointer-events-none" />
                </div>

                {/* Date Picker */}
                <div className="flex items-center gap-2 bg-white px-4 py-3 rounded-[1.5rem] border border-slate-200 shadow-sm w-full md:w-auto justify-center">
                    <Calendar size={14} className="text-blue-600" />
                    <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="text-[10px] font-bold outline-none bg-transparent uppercase" />
                    <span className="text-[10px] font-black text-slate-300 mx-1">TO</span>
                    <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="text-[10px] font-bold outline-none bg-transparent uppercase" />
                </div>

                <form onSubmit={handleScan} className="relative w-full md:w-80">
                    <input 
                        ref={scanRef}
                        className="w-full bg-white border-2 border-slate-100 rounded-[1.5rem] pl-12 pr-4 py-3 text-sm font-black outline-none focus:border-blue-600 shadow-sm transition-all"
                        value={scanInput}
                        onChange={e => setScanInput(e.target.value)}
                        placeholder="Scan ID to Restock & Complete..."
                    />
                    <Scan className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    {isProcessing && <div className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>}
                </form>
                <button 
                    onClick={() => setRefreshKey(prev => prev + 1)} 
                    className="p-3 bg-white border-2 border-slate-100 rounded-[1.5rem] text-slate-400 hover:text-slate-900 shadow-sm transition-all active:scale-95"
                >
                    <RefreshCw size={20} />
                </button>
            </div>
        </div>
      </div>

      {scanResult && (
          <div className={`mx-2 p-4 rounded-2xl flex items-center justify-center gap-3 font-black uppercase tracking-widest text-xs shadow-lg animate-bounce ${
              scanResult.type === 'success' ? 'bg-emerald-500 text-white' : 
              scanResult.type === 'warning' ? 'bg-amber-400 text-black' : 'bg-rose-600 text-white'
          }`}>
              {scanResult.type === 'warning' ? <AlertTriangle size={18}/> : scanResult.type === 'success' ? <CheckCircle size={18}/> : <AlertTriangle size={18}/>}
              {scanResult.msg}
          </div>
      )}

      <div className="flex flex-wrap gap-2 bg-white p-2.5 rounded-[2.5rem] border border-slate-100 shadow-sm overflow-x-auto no-scrollbar">
        {filters.map(f => (
          <button
            key={f.status}
            onClick={() => setActiveFilter(f.status as any)}
            className={`flex items-center gap-2 px-6 py-3.5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${activeFilter === f.status ? 'bg-blue-600 text-white shadow-lg scale-105' : 'text-slate-400 hover:bg-slate-50 hover:text-black'}`}
          >
            {f.icon} {f.label}
            <span className={`ml-2 px-2 py-0.5 rounded-full text-[9px] ${activeFilter === f.status ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-600'}`}>
                {f.count}
            </span>
          </button>
        ))}
      </div>

      <div className="bg-white rounded-[3rem] border border-slate-100 shadow-sm min-h-[600px] overflow-hidden">
        <OrderList 
          key={refreshKey}
          tenantId={tenantId} 
          onSelectOrder={onSelectOrder} 
          status={activeFilter}
          productId={selectedProductId === 'ALL' ? null : selectedProductId}
          startDate={startDate}
          endDate={endDate}
          onRefresh={() => setRefreshKey(prev => prev + 1)}
        />
      </div>
    </div>
  );
};
