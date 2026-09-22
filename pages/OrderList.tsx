
import React, { useState, useEffect, useCallback } from 'react';
import { db } from '../services/mockBackend';
import { Order, OrderStatus } from '../types';
import { formatCurrency } from '../utils/helpers';
import { Search, ChevronRight, Trash2, CheckSquare, Square, Truck, Printer, ExternalLink, ChevronLeft, Loader2, Download, Share2, XCircle, CheckCircle } from 'lucide-react';

interface OrderListProps {
  tenantId: string;
  onSelectOrder: (orderId: string) => void;
  status?: OrderStatus | 'ALL' | 'TODAY_SHIPPED';
  productId?: string | null;
  startDate?: string;
  endDate?: string;
  logisticsOnly?: boolean;
  onBulkAction?: (orderIds: string[]) => void;
  onRefresh?: () => void;
  data?: Order[]; // OPTIONAL: Pass pre-filtered data to skip internal fetching
}

export const OrderList: React.FC<OrderListProps> = ({ 
  tenantId, 
  onSelectOrder, 
  status = 'ALL', 
  productId, 
  startDate, 
  endDate, 
  logisticsOnly = false, 
  onBulkAction, 
  onRefresh,
  data: externalData
}) => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [limit] = useState(50);
  
  const [customerHistories, setCustomerHistories] = useState<{[key: string]: any}>({});
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [bulkProcessing, setBulkProcessing] = useState(false);
  const [bulkProgressMsg, setBulkProgressMsg] = useState('');

  // Share Lead States
  const [showShareModal, setShowShareModal] = useState(false);
  const [tenants, setTenants] = useState<any[]>([]);
  const [selectedTenantIds, setSelectedTenantIds] = useState<string[]>([]);
  const [shareAllShops, setShareAllShops] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [shareResult, setShareResult] = useState<any | null>(null);

  useEffect(() => {
    if (showShareModal) {
      db.getTenants().then(res => {
        setTenants((res || []).filter((t: any) => t.id !== tenantId && t.isActive));
      }).catch(err => {
        console.error("Error loading tenants for sharing:", err);
      });
    }
  }, [showShareModal, tenantId]);

  const handleShareLeads = async () => {
    if (!shareAllShops && selectedTenantIds.length === 0) {
      alert("Please select at least one destination shop.");
      return;
    }
    
    setIsSharing(true);
    setShareResult(null);

    const currentUserStr = localStorage.getItem('mw_user') 
      ? JSON.parse(localStorage.getItem('mw_user')!).username 
      : 'System';

    const targetIds = shareAllShops ? ['all'] : selectedTenantIds;

    try {
      const res = await db.shareLeads(tenantId, targetIds, selectedIds, currentUserStr);
      setShareResult(res);
    } catch (err: any) {
      alert(err.message || "Failed to share leads");
    } finally {
      setIsSharing(false);
    }
  };

  useEffect(() => {
    setCurrentPage(1);
    setSelectedIds([]);
  }, [status, productId, startDate, endDate, debouncedSearch, externalData]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 400);
    return () => clearTimeout(timer);
  }, [search]);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      let finalOrders: Order[] = [];
      let total = 0;

      if (externalData) {
          // CLIENT-SIDE MODE (Parent provides filtered data)
          let filtered = [...externalData];
          
          // Apply Search
          if (debouncedSearch) {
              const term = debouncedSearch.toLowerCase();
              filtered = filtered.filter(o => 
                  o.id.toLowerCase().includes(term) ||
                  o.customerName.toLowerCase().includes(term) ||
                  o.customerPhone.includes(term) ||
                  (o.trackingNumber || '').toLowerCase().includes(term)
              );
          }

          // Status Filter (if not handled by parent or for extra safety)
          if (status !== 'ALL') {
             if (status === 'LOGISTICS_ALL') {
                 // Handled by parent usually, but fallback here
             } else {
                 filtered = filtered.filter(o => o.status === status);
             }
          }

          // Sort (Newest First)
          filtered.sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

          total = filtered.length;
          finalOrders = filtered.slice((currentPage - 1) * limit, currentPage * limit);
          
      } else {
          // SERVER-SIDE MODE (Standard Fetch)
          const response = await db.getOrders({
            tenantId,
            page: currentPage,
            limit,
            search: debouncedSearch,
            status: status,
            productId: productId || undefined,
            startDate,
            endDate
          });
          finalOrders = response.data;
          total = response.total;
      }

      setOrders(finalOrders);
      setTotalCount(total);
      
      if (finalOrders.length > 0) {
        const uniquePhones = [...new Set(finalOrders.map(o => o.customerPhone))].filter(Boolean);
        if (uniquePhones.length > 0) {
            const batchHistory = await db.getCustomerHistoryBatch(uniquePhones, tenantId);
            
            const historyMap: any = {};
            uniquePhones.forEach(phone => {
               if (batchHistory[phone]) {
                   historyMap[phone.slice(-8)] = batchHistory[phone];
               }
            });
            setCustomerHistories(historyMap);
        }
      }
    } finally {
      setIsLoading(false);
    }
  }, [tenantId, currentPage, limit, debouncedSearch, status, productId, startDate, endDate, externalData]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleOrderClick = (e: React.MouseEvent, orderId: string) => {
    if (e.ctrlKey || e.metaKey) {
      const url = `${window.location.origin}${window.location.pathname}?orderId=${orderId}#${orderId}`;
      window.open(url, '_blank');
    } else {
      onSelectOrder(orderId);
    }
  };

  const handleBulkDelete = async () => {
    if (!confirm(`CRITICAL: Registry Wipe. Permanent removal of ${selectedIds.length} nodes. Continue?`)) return;
    setBulkProcessing(true);
    setBulkProgressMsg('EXECUTING WIPE...');
    try {
      await db.deleteOrder(selectedIds.join(','), tenantId);
      setSelectedIds([]);
      await loadData();
      if (onRefresh) onRefresh();
      alert(`Wipe Successful: Clusters purged.`);
    } catch (e: any) {
      alert(`Protocol Denied: ${e.message}`);
    } finally { 
      setBulkProcessing(false); 
      setBulkProgressMsg('');
    }
  };

  const handleBulkShip = async () => {
    if (!confirm(`Logistics Sync: Transmit selected leads to Courier? Note: Only CONFIRMED orders will be processed.`)) return;
    setBulkProcessing(true);
    
    let successCount = 0;
    let failCount = 0;
    let skipCount = 0;
    let lastError = '';

    const targetIds = [...selectedIds];
    for (let i = 0; i < targetIds.length; i++) {
        const id = targetIds[i];
        const order = orders.find(o => o.id === id);
        
        if (order) {
            if (order.status !== OrderStatus.CONFIRMED) {
                console.warn(`Skipping ${order.id}: Status is ${order.status}, expected CONFIRMED.`);
                skipCount++;
                continue;
            }

            setBulkProgressMsg(`SHIPPING ${i+1}/${targetIds.length}: ${order.customerName}`);
            try {
                await db.shipOrder(order, tenantId);
                successCount++;
            } catch (err: any) {
                failCount++;
                lastError = err.message;
                console.error(`FDE Handshake failed for ${order.id}:`, err);
            }
            await new Promise(r => setTimeout(r, 800));
        }
    }

    setBulkProcessing(false);
    setBulkProgressMsg('');
    
    let summary = `Logistics Summary:\n- Processed: ${successCount}\n- Failed: ${failCount}\n- Skipped (Not Confirmed/Already Shipped): ${skipCount}`;
    if (failCount > 0) summary += `\n\nLast Error: ${lastError}`;
    alert(summary);
    
    setSelectedIds([]);
    await loadData();
    if (onRefresh) onRefresh();
  };

  const handleExportCSV = () => {
    const selectedOrders = orders.filter(o => selectedIds.includes(o.id));
    if (selectedOrders.length === 0) return;

    const headers = [
      "Order ID",
      "Date",
      "Customer Name",
      "Phone",
      "Secondary Phone",
      "Address",
      "City",
      "Weight",
      "Status",
      "Items (SKU x Qty)",
      "Total Amount",
      "Tracking Number"
    ];

    const rows = selectedOrders.map(o => {
      const dateStr = o.createdAt ? new Date(o.createdAt).toISOString().split('T')[0] : '';
      const itemsStr = o.items.map(i => `${i.name} (x${i.quantity})`).join(' | ');

      const escape = (val: string | number | undefined | null) => {
        if (val === undefined || val === null) return '';
        const str = String(val);
        if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      };

      return [
        escape(o.id),
        escape(dateStr),
        escape(o.customerName),
        escape(o.customerPhone),
        escape(o.customerPhone2 || ''),
        escape(o.customerAddress),
        escape(o.customerCity || ''),
        escape(o.parcelWeight || ''),
        escape(o.status),
        escape(itemsStr),
        escape(o.totalAmount),
        escape(o.trackingNumber || '')
      ];
    });

    const csvContent = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `orders_export_${status.toLowerCase()}_${Date.now()}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setSelectedIds([]);
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === orders.length && orders.length > 0) setSelectedIds([]);
    else setSelectedIds(orders.map(o => o.id));
  };

  const getStatusColor = (status: OrderStatus) => {
    switch(status) {
      case OrderStatus.PENDING: return 'bg-blue-600 text-white';
      case OrderStatus.OPEN_LEAD: return 'bg-sky-500 text-white';
      case OrderStatus.CONFIRMED: return 'bg-emerald-500 text-white';
      case OrderStatus.REJECTED: return 'bg-rose-600 text-white';
      case OrderStatus.NO_ANSWER_REJECT: return 'bg-rose-800 text-white';
      case OrderStatus.NO_ANSWER: return 'bg-amber-400 text-black';
      case OrderStatus.NO_ANSWER_OPEN: return 'bg-amber-500 text-white';
      case OrderStatus.SHIPPED: return 'bg-indigo-600 text-white';
      case OrderStatus.HOLD: return 'bg-purple-600 text-white';
      case OrderStatus.RETURN_TRANSFER: return 'bg-indigo-500 text-white';
      case OrderStatus.TRANSFER: return 'bg-indigo-600 text-white';
      default: return 'bg-slate-200 text-slate-600';
    }
  };

  const getStatusDisplay = (status: OrderStatus) => {
      if (status === OrderStatus.RESIDUAL) return 'RESCHEDULE';
      if (status === OrderStatus.RETURN_TRANSFER) return 'RETURN TRANSFER';
      return status.replace('_', ' ');
  };

  const totalPages = Math.ceil(totalCount / limit);

  return (
    <div className="flex flex-col h-full bg-white animate-slide-in relative">
      {selectedIds.length > 0 && (
        <div className="absolute top-0 left-0 right-0 z-20 bg-slate-950 text-white p-4 flex items-center justify-between shadow-2xl rounded-b-2xl border-b border-white/10">
          <div className="flex items-center gap-4 ml-4">
              {bulkProcessing ? <Loader2 className="animate-spin text-blue-400" size={20}/> : <CheckSquare className="text-blue-500" size={20}/>}
              <div className="flex flex-col">
                <span className="text-[10px] font-black uppercase tracking-widest">{selectedIds.length} Nodes Locked</span>
                {bulkProgressMsg && <span className="text-[8px] font-bold text-blue-400 uppercase animate-pulse">{bulkProgressMsg}</span>}
              </div>
          </div>
          <div className="flex gap-2">
            {(status === OrderStatus.PENDING || status === OrderStatus.NO_ANSWER || status === OrderStatus.NO_ANSWER_OPEN || status === OrderStatus.CONFIRMED) && (
              <button disabled={bulkProcessing} onClick={handleExportCSV} className="bg-emerald-600 px-6 py-2.5 rounded-xl text-[10px] font-black uppercase flex items-center gap-2 shadow-lg hover:bg-emerald-700 transition-all disabled:opacity-50">
                <Download size={14} /> Export CSV
              </button>
            )}
            <button disabled={bulkProcessing} onClick={() => setShowShareModal(true)} className="bg-purple-600 px-6 py-2.5 rounded-xl text-[10px] font-black uppercase flex items-center gap-2 shadow-lg hover:bg-purple-700 transition-all disabled:opacity-50">
              <Share2 size={14} /> Share Leads
            </button>
            {status === OrderStatus.CONFIRMED && (
              <button disabled={bulkProcessing} onClick={handleBulkShip} className="bg-blue-600 px-6 py-2.5 rounded-xl text-[10px] font-black uppercase flex items-center gap-2 shadow-lg hover:bg-blue-700 transition-all disabled:opacity-50">
                <Truck size={14} /> Bulk Ship
              </button>
            )}
            {onBulkAction && (
              <button disabled={bulkProcessing} onClick={() => { onBulkAction(selectedIds); setSelectedIds([]); }} className="bg-slate-800 px-6 py-2.5 rounded-xl text-[10px] font-black uppercase flex items-center gap-2 shadow-lg hover:bg-black transition-all disabled:opacity-50">
                <Printer size={14} /> Label Print
              </button>
            )}
            <button disabled={bulkProcessing} onClick={handleBulkDelete} className="bg-rose-600 px-4 py-2.5 rounded-xl text-[10px] font-black uppercase flex items-center gap-2 hover:bg-rose-700 transition-all disabled:opacity-50">
              <Trash2 size={14} /> Wipe Registry
            </button>
            <button disabled={bulkProcessing} onClick={() => setSelectedIds([])} className="bg-white/10 px-6 py-2.5 rounded-xl text-[10px] font-black uppercase disabled:opacity-30">Cancel</button>
          </div>
        </div>
      )}

      <div className="p-5 border-b border-slate-100 flex flex-col md:flex-row items-center justify-between gap-4 bg-slate-50/20">
        <div className="relative flex-1 md:w-80">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input 
              placeholder="Registry Search..." 
              value={search} 
              onChange={(e) => setSearch(e.target.value)} 
              className="w-full bg-white border border-slate-200 pl-11 pr-4 py-3 rounded-2xl outline-none text-[13px] font-bold focus:ring-2 focus:ring-blue-500 shadow-sm" 
            />
        </div>
        <div className="flex items-center gap-4">
            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
              Total: {totalCount.toLocaleString()} Nodes
            </div>
            <div className="flex items-center gap-1">
               <button disabled={currentPage === 1 || isLoading} onClick={() => setCurrentPage(p => Math.max(1, p - 1))} className="p-2 rounded-lg hover:bg-slate-200 disabled:opacity-30"><ChevronLeft size={16}/></button>
               <span className="text-[11px] font-black text-slate-900 bg-white border border-slate-200 px-3 py-1 rounded-lg">Page {currentPage} of {totalPages || 1}</span>
               <button disabled={currentPage === totalPages || totalPages === 0 || isLoading} onClick={() => setCurrentPage(p => p + 1)} className="p-2 rounded-lg hover:bg-slate-200 disabled:opacity-30"><ChevronRight size={16}/></button>
            </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto no-scrollbar">
        <table className="w-full text-left compact-table">
          <thead className="sticky top-0 bg-white/95 backdrop-blur-sm z-10 border-b border-slate-100">
            <tr>
              <th className="w-12 text-center" onClick={toggleSelectAll}>
                <div className={`cursor-pointer ${selectedIds.length === orders.length && orders.length > 0 ? 'text-blue-600' : 'text-slate-300'}`}>
                   {selectedIds.length === orders.length && orders.length > 0 ? <CheckSquare size={18}/> : <Square size={18}/>}
                </div>
              </th>
              <th>Reference / Waybill</th>
              <th>Consignee</th>
              <th className="text-center">History Intel</th>
              <th>Total</th>
              <th className="text-center">Status</th>
              <th className="text-right pr-6">Action</th>
            </tr>
          </thead>
          <tbody className={`divide-y divide-slate-100 ${isLoading ? 'opacity-50' : ''}`}>
            {orders.length === 0 && !isLoading && (
              <tr><td colSpan={7} className="py-20 text-center text-[10px] font-black text-slate-300 uppercase tracking-widest">No Records Found</td></tr>
            )}
            {orders.map((order) => {
              const last8 = order.customerPhone.slice(-8);
              const history = customerHistories[last8];
              const isSelected = selectedIds.includes(order.id);
              return (
                <tr 
                  key={order.id} 
                  className={`hover:bg-slate-50 transition-colors cursor-pointer group ${isSelected ? 'bg-blue-50/50' : ''}`} 
                  onClick={(e) => handleOrderClick(e, order.id)}
                  onAuxClick={(e) => { if (e.button === 1) handleOrderClick({ ...e, ctrlKey: true } as any, order.id) }}
                >
                  <td onClick={(e) => { e.stopPropagation(); setSelectedIds(prev => prev.includes(order.id) ? prev.filter(x => x !== order.id) : [...prev, order.id]); }} className="text-center">
                    <div className={`p-1 transition-all ${isSelected ? 'text-blue-600' : 'text-slate-300'}`}>
                      {isSelected ? <CheckSquare size={18}/> : <Square size={18}/>}
                    </div>
                  </td>
                  <td>
                    <div className="flex flex-col">
                        <span className="font-mono text-[10px] font-bold text-slate-400">#{order.id.slice(-8)}</span>
                        {order.trackingNumber && (
                            <span className="text-[9px] font-black text-blue-600 mt-0.5 tracking-wider">{order.trackingNumber}</span>
                        )}
                    </div>
                  </td>
                  <td>
                    <div className="flex flex-col">
                      <span className="text-[13px] font-black uppercase text-slate-900">{order.customerName}</span>
                      <span className="text-[10px] font-bold text-slate-400">{order.customerPhone}</span>
                    </div>
                  </td>
                  <td className="text-center">
                      <div className="flex flex-col gap-1 items-center">
                        {history?.returns > 0 ? (
                          <div className="bg-rose-600 text-white px-2 py-0.5 rounded text-[8px] font-black uppercase">RISK ({history.returns})</div>
                        ) : history?.count >= 2 ? (
                          <div className="bg-blue-600 text-white px-2 py-0.5 rounded text-[8px] font-black uppercase">REPEAT ({history.count})</div>
                        ) : <span className="text-[10px] font-bold text-slate-300">-</span>}
                      </div>
                  </td>
                  <td><span className="text-sm font-black text-slate-900">{formatCurrency(order.totalAmount)}</span></td>
                  <td className="text-center">
                    <span className={`px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest ${getStatusColor(order.status)}`}>
                        {getStatusDisplay(order.status)}
                    </span>
                  </td>
                  <td className="text-right pr-6">
                    <div className="flex items-center justify-end gap-2">
                        <a 
                            href={`?orderId=${order.id}#${order.id}`} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="text-slate-300 hover:text-blue-600 transition-all p-2"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <ExternalLink size={14} />
                        </a>
                        <button className="p-2.5 rounded-xl bg-slate-50 text-slate-400 group-hover:text-blue-600 transition-all"><ChevronRight size={16}/></button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      
      <div className="p-4 border-t border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Showing {orders.length} of {totalCount.toLocaleString()} results</div>
          <div className="flex items-center gap-2">
            <button disabled={currentPage === 1 || isLoading} onClick={() => setCurrentPage(1)} className="px-3 py-1.5 rounded-lg border border-slate-200 text-[10px] font-black uppercase hover:bg-slate-200 disabled:opacity-30">First</button>
            <button disabled={currentPage === totalPages || totalPages === 0 || isLoading} onClick={() => setCurrentPage(totalPages)} className="px-3 py-1.5 rounded-lg border border-slate-200 text-[10px] font-black uppercase hover:bg-slate-200 disabled:opacity-30">Last</button>
          </div>
      </div>

      {showShareModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-2xl p-10 max-w-xl w-full mx-4 space-y-6 relative overflow-hidden">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-50">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-purple-50 text-purple-600 rounded-2xl flex items-center justify-center border border-purple-100">
                  <Share2 size={24} />
                </div>
                <div>
                  <h3 className="text-xl font-black text-slate-900 tracking-tighter uppercase">Share Leads</h3>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-1">Cross-Shop Distribution</p>
                </div>
              </div>
              <button 
                onClick={() => { setShowShareModal(false); setShareResult(null); setSelectedTenantIds([]); setShareAllShops(false); }}
                className="p-2 text-slate-400 hover:text-slate-900 rounded-xl hover:bg-slate-50 transition-all"
              >
                <XCircle size={20} />
              </button>
            </div>

            {/* Modal Content */}
            {!shareResult ? (
              <div className="space-y-6">
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                    Select target shops to receive <strong className="text-purple-600">{selectedIds.length}</strong> selected leads:
                  </p>
                </div>

                {/* Option 1: Share all shops */}
                <div 
                  onClick={() => {
                    setShareAllShops(!shareAllShops);
                    if (!shareAllShops) setSelectedTenantIds([]);
                  }}
                  className={`p-5 rounded-2xl border-2 transition-all cursor-pointer flex items-center justify-between ${shareAllShops ? 'border-purple-600 bg-purple-50/20' : 'border-slate-100 bg-slate-50/50 hover:border-slate-200'}`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${shareAllShops ? 'bg-purple-600 text-white' : 'bg-slate-200 text-slate-500'}`}>
                      <CheckCircle size={16} />
                    </div>
                    <div>
                      <span className="text-sm font-black uppercase text-slate-900">Share with ALL shops</span>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight mt-0.5">Publish to every active node in cluster</p>
                    </div>
                  </div>
                  <div className={shareAllShops ? 'text-purple-600' : 'text-slate-300'}>
                    {shareAllShops ? <CheckSquare size={22} /> : <Square size={22} />}
                  </div>
                </div>

                {/* Divider */}
                <div className="flex items-center gap-4 text-[10px] font-black text-slate-300 uppercase tracking-widest my-2">
                  <div className="flex-1 h-px bg-slate-100"></div>
                  <span>OR SELECT SPECIFIC SHOPS</span>
                  <div className="flex-1 h-px bg-slate-100"></div>
                </div>

                {/* Specific Tenants List */}
                <div className="max-h-[220px] overflow-y-auto space-y-3 pr-1 no-scrollbar">
                  {tenants.length === 0 ? (
                    <div className="text-center py-6 text-xs text-slate-400 font-bold uppercase tracking-wider">No other active shops available</div>
                  ) : (
                    tenants.map(t => {
                      const isSelected = selectedTenantIds.includes(t.id);
                      return (
                        <div 
                          key={t.id}
                          onClick={() => {
                            if (shareAllShops) setShareAllShops(false);
                            setSelectedTenantIds(prev => 
                              prev.includes(t.id) ? prev.filter(id => id !== t.id) : [...prev, t.id]
                            );
                          }}
                          className={`p-4 rounded-xl border-2 transition-all cursor-pointer flex items-center justify-between ${isSelected ? 'border-purple-600 bg-purple-50/10' : 'border-slate-100 bg-white hover:border-slate-200'}`}
                        >
                          <div className="flex items-center gap-3">
                            <span className="text-xs font-black uppercase text-slate-900">{t.settings?.shopName || t.name}</span>
                            <span className="text-[9px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full uppercase">ID: {t.id}</span>
                          </div>
                          <div className={isSelected ? 'text-purple-600' : 'text-slate-300'}>
                            {isSelected ? <CheckSquare size={20} /> : <Square size={20} />}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-4 pt-4 border-t border-slate-50">
                  <button 
                    disabled={isSharing}
                    onClick={() => { setShowShareModal(false); setSelectedTenantIds([]); setShareAllShops(false); }}
                    className="flex-1 py-4 bg-slate-50 border border-slate-200 hover:bg-slate-100 text-slate-500 rounded-2xl font-black text-[11px] uppercase tracking-[0.2em] transition-all"
                  >
                    Cancel
                  </button>
                  <button 
                    disabled={isSharing || (!shareAllShops && selectedTenantIds.length === 0)}
                    onClick={handleShareLeads}
                    className="flex-[2] py-4 bg-purple-600 hover:bg-purple-700 text-white rounded-2xl font-black text-[11px] uppercase tracking-[0.2em] shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isSharing ? (
                      <>
                        <Loader2 className="animate-spin" size={16} />
                        SHARING...
                      </>
                    ) : (
                      <>
                        <Share2 size={16} />
                        Confirm Share
                      </>
                    )}
                  </button>
                </div>
              </div>
            ) : (
              // Results Display
              <div className="space-y-6">
                <div className="bg-emerald-50 border border-emerald-100 p-6 rounded-[1.5rem] flex items-center gap-4 text-emerald-800">
                  <CheckCircle size={32} className="text-emerald-500 shrink-0" />
                  <div>
                    <h4 className="text-sm font-black uppercase tracking-wider">Sharing Pipeline Triggered</h4>
                    <p className="text-[11px] font-bold text-emerald-600 mt-1 uppercase">Distribution execution complete</p>
                  </div>
                </div>

                <div className="space-y-3">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Distribution Report</p>
                  <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1 no-scrollbar">
                    {shareResult.summary?.map((report: any) => (
                      <div key={report.tenantId} className="p-4 bg-slate-50 border border-slate-100 rounded-xl flex items-center justify-between">
                        <div>
                          <span className="text-xs font-black uppercase text-slate-900">{report.tenantId}</span>
                          <div className="flex gap-2 mt-1">
                            <span className="text-[9px] font-bold text-slate-500 uppercase">{report.shared} SHARED</span>
                            {report.duplicate > 0 && (
                              <span className="text-[9px] font-bold text-amber-600 uppercase">{report.duplicate} DUPLICATES SKIPPED</span>
                            )}
                          </div>
                        </div>
                        <div>
                          {report.success ? (
                            <span className="px-2 py-1 bg-emerald-100 text-emerald-800 border border-emerald-200 rounded text-[9px] font-black uppercase">Success</span>
                          ) : (
                            <span className="px-2 py-1 bg-rose-100 text-rose-800 border border-rose-200 rounded text-[9px] font-black uppercase">Failed: {report.error}</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <button 
                  onClick={() => {
                    setShowShareModal(false);
                    setShareResult(null);
                    setSelectedTenantIds([]);
                    setShareAllShops(false);
                    setSelectedIds([]);
                    if (onRefresh) onRefresh();
                  }}
                  className="w-full py-4 bg-black text-white rounded-2xl font-black text-[11px] uppercase tracking-[0.2em] shadow-lg transition-all"
                >
                  Close & Refresh Registry
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
