
import React, { useState, useEffect, useMemo } from 'react';
import { createRoot } from 'react-dom/client';
import { db } from '../services/mockBackend';
import { Order, TenantSettings } from '../types';
import { formatCurrency } from '../utils/helpers';
import { Printer, CalendarCheck, Search, Truck, Download, Calendar, Package } from 'lucide-react';
import { LabelPrintView } from '../components/LabelPrintView';

interface TodayShippedProps {
  tenantId: string;
}

export const TodayShipped: React.FC<TodayShippedProps> = ({ tenantId }) => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [tenantSettings, setTenantSettings] = useState<TenantSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [targetDate, setTargetDate] = useState(new Date().toISOString().split('T')[0]);

  const load = async () => {
    setLoading(true);
    const [fetchedOrders, fetchedTenant] = await Promise.all([
        db.getOrders(tenantId),
        db.getTenant(tenantId)
    ]);
    if (fetchedTenant) setTenantSettings(fetchedTenant.settings);
    setOrders(fetchedOrders);
    setLoading(false);
  };

  useEffect(() => { load(); }, [tenantId]);

  const dailyOrders = useMemo(() => {
      return orders.filter(o => {
          if (!o.shippedAt) return false;
          const orderShipDay = new Date(o.shippedAt).toDateString();
          const selectedDay = new Date(targetDate).toDateString();
          const matchesDate = orderShipDay === selectedDay;
          const matchesSearch = o.customerName.toLowerCase().includes(search.toLowerCase()) || o.id.includes(search) || o.trackingNumber?.includes(search);
          return matchesDate && matchesSearch;
      });
  }, [orders, targetDate, search]);

  const handlePrintAll = () => {
    if (!dailyOrders.length || !tenantSettings) return;
    const printContainer = document.createElement('div');
    document.body.appendChild(printContainer);
    const root = createRoot(printContainer);
    root.render(<LabelPrintView orders={dailyOrders} settings={tenantSettings} />);
    setTimeout(() => { window.print(); root.unmount(); document.body.removeChild(printContainer); }, 500);
  };

  const handlePrintSingle = (order: Order) => {
    if (!tenantSettings) return;
    const printContainer = document.createElement('div');
    document.body.appendChild(printContainer);
    const root = createRoot(printContainer);
    root.render(<LabelPrintView orders={[order]} settings={tenantSettings} />);
    setTimeout(() => { window.print(); root.unmount(); document.body.removeChild(printContainer); }, 500);
  };

  return (
    <div className="space-y-6 animate-slide-in max-w-[1400px] mx-auto pb-10">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-rose-500 text-white rounded-xl flex items-center justify-center shadow-md">
            <CalendarCheck size={20} />
          </div>
          <div>
            <h2 className="text-xl font-extrabold text-slate-900">Daily Dispatch</h2>
            <p className="text-xs text-slate-500 font-medium">Historical shipment logging & manifests</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
            <div className="bg-white px-3 py-1.5 rounded-xl border border-slate-200 shadow-sm flex items-center gap-2">
                 <Calendar size={14} className="text-rose-500" />
                 <input type="date" value={targetDate} onChange={e => setTargetDate(e.target.value)} className="text-[11px] font-bold text-slate-900 outline-none uppercase bg-transparent" />
            </div>
            <button onClick={handlePrintAll} className="px-4 py-2 bg-slate-900 text-white rounded-xl font-bold text-[10px] uppercase tracking-widest hover:bg-black transition-all shadow-md flex items-center gap-2">
                <Printer size={14} /> Manifest
            </button>
        </div>
      </div>

      <div className="modern-card overflow-hidden flex flex-col min-h-[500px]">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/30">
            <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                <input placeholder="Filter log..." value={search} onChange={e => setSearch(e.target.value)} className="w-full bg-white border border-slate-200 rounded-xl pl-9 pr-4 py-2 text-[12px] font-medium focus:ring-2 focus:ring-rose-500 outline-none" />
            </div>
            <span className="text-[10px] font-black text-rose-600 bg-rose-50 px-3 py-1 rounded-full uppercase tracking-widest">{dailyOrders.length} Records</span>
        </div>

        <div className="flex-1 overflow-x-auto no-scrollbar">
            <table className="w-full text-left compact-table">
                <thead>
                    <tr className="bg-slate-50/50">
                        <th>Invoice</th>
                        <th>Consignee</th>
                        <th>Inventory Details</th>
                        <th className="text-center">Tracking</th>
                        <th>Valuation</th>
                        <th className="text-right">Actions</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                    {dailyOrders.map(o => (
                        <tr key={o.id} className="hover:bg-slate-50 transition-colors">
                            <td className="font-mono text-[10px] text-slate-400 uppercase">#{o.id.slice(-6)}</td>
                            <td>
                                <div className="flex flex-col">
                                    <span className="font-bold text-slate-900 text-[13px]">{o.customerName}</span>
                                    <span className="text-[10px] font-medium text-slate-400">{o.customerPhone}</span>
                                </div>
                            </td>
                            <td>
                                <div className="flex flex-col gap-1">
                                    {o.items.map((item, idx) => (
                                        <div key={idx} className="flex items-center gap-1.5">
                                            <span className="bg-slate-100 text-slate-600 text-[9px] font-black px-1.5 py-0.5 rounded uppercase">{item.quantity}x</span>
                                            <span className="text-[11px] font-medium text-slate-600 truncate max-w-[150px]">{item.name}</span>
                                        </div>
                                    ))}
                                </div>
                            </td>
                            <td className="text-center">
                                <span className="bg-slate-900 text-white px-3 py-1 rounded-lg text-[9px] font-bold uppercase font-mono tracking-tight">
                                    {o.trackingNumber || 'PENDING'}
                                </span>
                            </td>
                            <td>
                                <span className="font-extrabold text-slate-900 text-[13px]">{formatCurrency(o.totalAmount)}</span>
                            </td>
                            <td className="text-right">
                                <div className="flex items-center justify-end gap-2">
                                    <button onClick={() => handlePrintSingle(o)} className="p-2 bg-white border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 shadow-sm"><Printer size={14} /></button>
                                    <button className="p-2 bg-white border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 shadow-sm"><Download size={14} /></button>
                                </div>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
            {dailyOrders.length === 0 && (
                <div className="flex flex-col items-center justify-center p-32 text-slate-200 opacity-20">
                    <Package size={80} strokeWidth={1} />
                    <p className="font-black uppercase tracking-[0.3em] text-[10px] mt-4">Empty Log</p>
                </div>
            )}
        </div>
      </div>
    </div>
  );
};
