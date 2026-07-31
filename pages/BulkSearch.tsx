import React, { useState, useRef } from 'react';
import { 
  Search, 
  Upload, 
  FileSpreadsheet, 
  FileDown, 
  CheckCircle, 
  RotateCcw, 
  AlertCircle, 
  HelpCircle, 
  Clock,
  ArrowLeft,
  X,
  FileSearch,
  Database
} from 'lucide-react';
import { db } from '../services/mockBackend';
import { OrderStatus } from '../types';

interface BulkSearchResult {
  waybill: string;
  found: boolean;
  orderId?: string;
  status?: string;
  customerName?: string;
  customerPhone?: string;
  shopId?: string;
  shopName?: string;
  createdAt?: string;
  shippedAt?: string;
  deliveredAt?: string;
  returnedAt?: string;
  returnCompletedAt?: string;
}

export const BulkSearch: React.FC<{ tenantId: string; shopName: string; onSelectOrder?: (id: string) => void }> = ({ tenantId, shopName, onSelectOrder }) => {
  const [waybillInput, setWaybillInput] = useState('');
  const [results, setResults] = useState<BulkSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeFilter, setActiveFilter] = useState<'ALL' | 'DELIVERED' | 'RETURNED' | 'OTHER' | 'NOT_FOUND'>('ALL');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSearch = async (waybillsList: string[]) => {
    if (waybillsList.length === 0) {
      alert("Please enter or upload at least one Waybill ID or Order ID.");
      return;
    }
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await db.bulkSearch(waybillsList);
      if (res.success) {
        setResults(res.results);
      } else {
        setErrorMsg("Search executed but server did not return valid response format.");
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to search waybills");
    } finally {
      setLoading(false);
    }
  };

  const executeTextSearch = () => {
    const list = waybillInput
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0);
    handleSearch(list);
  };

  // CSV Parsing
  const handleCSVFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      if (!text) return;

      const lines = text.split(/\r?\n/);
      const waybillsSet = new Set<string>();

      lines.forEach(line => {
        // Simple comma split
        const columns = line.split(',').map(col => col.replace(/^["']|["']$/g, '').trim());
        columns.forEach(col => {
          // Look for potential waybill formats (alphanumeric, e.g. API4488930, ord-, tracking length > 4)
          if (col && col.length >= 4 && col.length <= 30) {
            waybillsSet.add(col);
          }
        });
      });

      const extractedList = Array.from(waybillsSet);
      if (extractedList.length === 0) {
        alert("Could not extract any valid waybills or IDs from the CSV. Please make sure the CSV has a column with tracking/waybill numbers.");
        return;
      }

      setWaybillInput(extractedList.join('\n'));
      handleSearch(extractedList);
    };
    reader.readAsText(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleCSVFile(e.target.files[0]);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleCSVFile(e.dataTransfer.files[0]);
    }
  };

  // Helper to check returned statuses
  const isReturnedStatus = (status?: string) => {
    if (!status) return false;
    return ['RETURNED', 'RETURN_TRANSFER', 'RETURN_HANDOVER', 'RETURN_COMPLETED', 'RETURN_AS_ON_SYSTEM', 'REJECTED'].includes(status);
  };

  // Filtered results
  const filteredResults = results.filter(r => {
    if (activeFilter === 'ALL') return true;
    if (activeFilter === 'DELIVERED') return r.found && r.status === 'DELIVERED';
    if (activeFilter === 'RETURNED') return r.found && isReturnedStatus(r.status);
    if (activeFilter === 'NOT_FOUND') return !r.found;
    if (activeFilter === 'OTHER') return r.found && r.status !== 'DELIVERED' && !isReturnedStatus(r.status);
    return true;
  });

  // Calculate stats
  const totalCount = results.length;
  const deliveredCount = results.filter(r => r.found && r.status === 'DELIVERED').length;
  const returnedCount = results.filter(r => r.found && isReturnedStatus(r.status)).length;
  const otherCount = results.filter(r => r.found && r.status !== 'DELIVERED' && !isReturnedStatus(r.status)).length;
  const notFoundCount = results.filter(r => !r.found).length;

  // Export Results back to CSV
  const exportToCSV = () => {
    if (results.length === 0) return;
    
    const headers = ['Waybill/ID', 'Found', 'Order ID', 'Current Status', 'Shop Name', 'Customer Name', 'Customer Phone', 'Shipped At', 'Delivered At', 'Returned At'];
    const rows = results.map(r => [
      r.waybill,
      r.found ? 'YES' : 'NO',
      r.orderId || '',
      r.status || '',
      r.shopName || '',
      r.customerName || '',
      r.customerPhone || '',
      r.shippedAt ? new Date(r.shippedAt).toLocaleString() : '',
      r.deliveredAt ? new Date(r.deliveredAt).toLocaleString() : '',
      r.returnedAt ? new Date(r.returnedAt).toLocaleString() : ''
    ]);

    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(','), ...rows.map(e => e.map(val => `"${String(val).replace(/"/g, '""')}"`).join(','))].join('\n');
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `waybill_search_results_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-8 animate-slide-in pb-20">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-black text-black tracking-tighter uppercase leading-none">Bulk API Logistics Search</h2>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2">Cross-Shop Waybill and Courier Status Tracking</p>
        </div>
        {results.length > 0 && (
          <button 
            onClick={exportToCSV}
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-3.5 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2.5 shadow-lg active:scale-95 transition-all self-start md:self-auto"
          >
            <FileDown size={14} /> Export Results to CSV
          </button>
        )}
      </div>

      {/* Main Form Area */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Input Controls */}
        <div className="lg:col-span-5 space-y-6">
          
          {/* CSV File Dropzone */}
          <div 
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-[2rem] p-8 text-center cursor-pointer transition-all ${
              dragActive 
                ? 'border-blue-600 bg-blue-50/50' 
                : 'border-slate-200 bg-white hover:bg-slate-50/50 hover:border-slate-300'
            }`}
          >
            <input 
              ref={fileInputRef}
              type="file" 
              accept=".csv" 
              onChange={handleFileChange} 
              className="hidden" 
            />
            <div className="flex flex-col items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center text-blue-600">
                <Upload size={20} />
              </div>
              <p className="text-[11px] font-black text-slate-900 uppercase tracking-wider">Drag & Drop Waybill CSV here</p>
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">or click to browse computer</p>
            </div>
          </div>

          {/* Textarea Input Card */}
          <div className="bg-white rounded-[2rem] border border-slate-100 p-8 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Paste Waybill Numbers</p>
              {waybillInput && (
                <button 
                  onClick={() => setWaybillInput('')}
                  className="text-[9px] font-black text-rose-500 uppercase tracking-widest hover:underline flex items-center gap-1"
                >
                  <X size={10} /> Clear Input
                </button>
              )}
            </div>
            
            <textarea
              className="w-full h-44 bg-slate-50 rounded-2xl p-4 text-xs font-bold text-slate-800 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono no-scrollbar leading-relaxed"
              placeholder="API4488930&#10;API4488931&#10;ord-someid123&#10;(Enter one per line...)"
              value={waybillInput}
              onChange={e => setWaybillInput(e.target.value)}
            />

            <button
              onClick={executeTextSearch}
              disabled={loading || !waybillInput.trim()}
              className="w-full bg-slate-950 text-white py-4.5 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl flex items-center justify-center gap-2.5 active:scale-95 hover:bg-slate-900 transition-all disabled:opacity-30 disabled:pointer-events-none"
            >
              {loading ? (
                <>
                  <Database size={14} className="animate-spin" /> Querying Databases...
                </>
              ) : (
                <>
                  <Search size={14} /> Execute Bulk Search
                </>
              )}
            </button>
          </div>

        </div>

        {/* Results Metrics & List */}
        <div className="lg:col-span-7 space-y-6">
          {errorMsg && (
            <div className="bg-rose-50 border border-rose-100 p-6 rounded-2xl flex items-start gap-3.5 text-rose-700">
              <AlertCircle size={18} className="shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-black uppercase tracking-widest">Search Protocol Refused</p>
                <p className="text-[11px] font-medium text-rose-600 mt-1">{errorMsg}</p>
              </div>
            </div>
          )}

          {/* Quick Help Guide if no search results yet */}
          {results.length === 0 && !loading && (
            <div className="bg-white border border-slate-100 p-8 rounded-[2rem] space-y-4">
              <div className="flex items-center gap-3">
                <FileSearch className="text-blue-600" size={24} />
                <h4 className="text-[11px] font-black text-slate-800 uppercase tracking-widest">How to use Bulk Search</h4>
              </div>
              <ul className="space-y-2.5 text-[11px] text-slate-500 font-bold uppercase tracking-tight leading-relaxed">
                <li className="flex items-start gap-2">
                  <span className="w-5 h-5 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center text-[9px] shrink-0 font-black">1</span>
                  <span>Upload a courier CSV file, or paste a list of waybill numbers / barcode IDs (one per line).</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-5 h-5 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center text-[9px] shrink-0 font-black">2</span>
                  <span>Click "Execute Bulk Search" to run an automated check across all registered tenant databases.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-5 h-5 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center text-[9px] shrink-0 font-black">3</span>
                  <span>Review instant statistics showing exact DELIVERED and RETURNED counts with cross-shop mapping, and export back to CSV.</span>
                </li>
              </ul>
            </div>
          )}

          {/* Search Result Overview Cards */}
          {results.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="bg-white border border-slate-100 p-5 rounded-2xl text-center">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Searched</p>
                <p className="text-2xl font-black text-slate-900 leading-none">{totalCount}</p>
              </div>

              <div className="bg-emerald-500/10 border border-emerald-500/20 p-5 rounded-2xl text-center">
                <div className="flex items-center justify-center gap-1.5 mb-1.5">
                  <CheckCircle size={10} className="text-emerald-600" />
                  <p className="text-[9px] font-black text-emerald-700 uppercase tracking-widest">Delivered</p>
                </div>
                <p className="text-2xl font-black text-emerald-600 leading-none">{deliveredCount}</p>
              </div>

              <div className="bg-rose-500/10 border border-rose-500/20 p-5 rounded-2xl text-center">
                <div className="flex items-center justify-center gap-1.5 mb-1.5">
                  <RotateCcw size={10} className="text-rose-600" />
                  <p className="text-[9px] font-black text-rose-700 uppercase tracking-widest">Returned</p>
                </div>
                <p className="text-2xl font-black text-rose-600 leading-none">{returnedCount}</p>
              </div>

              <div className="bg-slate-100 border border-slate-200 p-5 rounded-2xl text-center">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Not Found</p>
                <p className="text-2xl font-black text-slate-500 leading-none">{notFoundCount}</p>
              </div>
            </div>
          )}

          {/* Results List */}
          {results.length > 0 && (
            <div className="bg-white border border-slate-100 rounded-[2rem] overflow-hidden shadow-sm">
              {/* Filters */}
              <div className="flex border-b border-slate-100 overflow-x-auto no-scrollbar">
                {(['ALL', 'DELIVERED', 'RETURNED', 'OTHER', 'NOT_FOUND'] as const).map(f => {
                  const label = f.replace('_', ' ');
                  let count = totalCount;
                  if (f === 'DELIVERED') count = deliveredCount;
                  if (f === 'RETURNED') count = returnedCount;
                  if (f === 'OTHER') count = otherCount;
                  if (f === 'NOT_FOUND') count = notFoundCount;

                  const isActive = activeFilter === f;

                  return (
                    <button
                      key={f}
                      onClick={() => setActiveFilter(f)}
                      className={`px-5 py-4.5 text-[10px] font-black uppercase tracking-widest border-b-2 whitespace-nowrap transition-all ${
                        isActive 
                          ? 'border-blue-600 text-blue-600 bg-blue-50/10' 
                          : 'border-transparent text-slate-400 hover:text-slate-600'
                      }`}
                    >
                      {label} <span className={`ml-1 text-[8px] px-1.5 py-0.5 rounded-full ${isActive ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500'}`}>{count}</span>
                    </button>
                  );
                })}
              </div>

              {/* Table List */}
              <div className="max-h-[380px] overflow-y-auto no-scrollbar">
                {filteredResults.length === 0 ? (
                  <div className="p-16 text-center text-[10px] font-black uppercase text-slate-300 tracking-widest">
                    No records found for current filter.
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {filteredResults.map((r, idx) => (
                      <div key={idx} className="p-5 hover:bg-slate-50/50 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-black text-slate-800 text-xs">{r.waybill}</span>
                            {r.found ? (
                              <span className="px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-tight bg-slate-100 text-slate-500 border border-slate-200">
                                {r.shopName}
                              </span>
                            ) : (
                              <span className="px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-tight bg-rose-50 text-rose-500 border border-rose-100">
                                Unregistered / Not Found
                              </span>
                            )}
                          </div>
                          {r.found && (
                            <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-tight">
                              <span>Customer: {r.customerName}</span>
                              <span>•</span>
                              <span>Phone: {r.customerPhone}</span>
                            </div>
                          )}
                        </div>

                        {r.found ? (
                          <div className="flex items-center gap-4">
                            <div className="text-right hidden sm:block">
                              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                                {r.status === 'DELIVERED' ? 'Delivered At' : isReturnedStatus(r.status) ? 'Returned At' : 'Created At'}
                              </p>
                              <p className="text-[10px] font-black text-slate-700 uppercase mt-0.5">
                                {r.status === 'DELIVERED' 
                                  ? (r.deliveredAt ? new Date(r.deliveredAt).toLocaleDateString() : 'N/A')
                                  : isReturnedStatus(r.status)
                                    ? (r.returnedAt ? new Date(r.returnedAt).toLocaleDateString() : 'N/A')
                                    : (r.createdAt ? new Date(r.createdAt).toLocaleDateString() : 'N/A')
                                }
                              </p>
                            </div>

                            <span className={`px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-wider text-center border whitespace-nowrap ${
                              r.status === 'DELIVERED'
                                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600'
                                : isReturnedStatus(r.status)
                                  ? 'bg-rose-500/10 border-rose-500/20 text-rose-600'
                                  : 'bg-blue-500/10 border-blue-500/20 text-blue-600'
                            }`}>
                              {r.status?.replace('_', ' ')}
                            </span>

                            {onSelectOrder && r.orderId && (
                              <button 
                                onClick={() => onSelectOrder(r.orderId!)}
                                className="text-[9px] font-black uppercase text-blue-600 tracking-widest hover:underline"
                              >
                                View Order
                              </button>
                            )}
                          </div>
                        ) : (
                          <span className="px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-wider bg-slate-50 border border-slate-100 text-slate-400">
                            No Matches
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

        </div>

      </div>
    </div>
  );
};
