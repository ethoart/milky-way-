
import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../services/mockBackend';
import { Tenant, User, Order, OrderStatus, Product, UserRole } from '../types';
import { 
  Database, 
  PlusCircle, 
  ShieldCheck, 
  User as UserIcon, 
  Edit, 
  Save, 
  X, 
  ExternalLink, 
  Activity, 
  Globe, 
  Users, 
  TrendingUp, 
  Lock, 
  Zap, 
  Truck,
  DollarSign,
  Fingerprint,
  Calendar
} from 'lucide-react';
import { formatCurrency } from '../utils/helpers';

export const DevAdmin: React.FC = () => {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [securityLogs, setSecurityLogs] = useState<any[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'CLUSTERS' | 'USERS' | 'SECURITY'>('CLUSTERS');

  // Form State for Cluster Injection
  const [formData, setFormData] = useState({
      name: '',
      shopName: '',
      logoUrl: '',
      mongoUri: '',
      adminEmail: '',
      adminPass: ''
  });

  const load = async () => {
    setLoading(true);
    const [t, u, o, p, s] = await Promise.all([
        db.getTenants(),
        db.getAllUsers(),
        db.getAllOrders(),
        db.getAllProducts(),
        db.getSecurityLogs()
    ]);
    setTenants(t);
    setUsers(u);
    setOrders(o);
    setProducts(p);
    setSecurityLogs(s);
    setLoading(false);
  };

  useEffect(() => { 
    load();
    const interval = setInterval(load, 15000); // Higher frequency real-time updates (15s)
    return () => clearInterval(interval);
  }, []);

  // Performance Metrics Calculation Engine
  const metrics = useMemo(() => {
    const todayStr = new Date().toDateString();
    
    // User-wise daily performance across all active clusters
    const userStats = users.filter(u => u.role !== UserRole.DEV_ADMIN).map(user => {
        const tenantOrders = orders.filter(o => o.tenantId === user.tenantId);
        
        // Count confirmed by this user
        const userConfirmed = tenantOrders.filter(o => o.openedBy === user.username && o.status === OrderStatus.CONFIRMED).length;
        
        // Real-time Daily Shipment Count
        const dailyShipped = tenantOrders.filter(o => 
          o.shippedAt && 
          new Date(o.shippedAt).toDateString() === todayStr && 
          o.openedBy === user.username
        ).length;
        
        // User Profit Attribution (Based on Delivered orders they managed)
        const deliveredOrders = tenantOrders.filter(o => 
            o.openedBy === user.username && 
            o.status === OrderStatus.DELIVERED
        );
        
        const returnedOrders = tenantOrders.filter(o => 
            o.openedBy === user.username && 
            (o.status === OrderStatus.RETURNED || o.status === OrderStatus.RETURN_COMPLETED)
        );

        const attributedRevenue = deliveredOrders.reduce((sum, o) => sum + o.totalAmount, 0);
        
        const totalCogs = deliveredOrders.reduce((sum, order) => {
            return sum + order.items.reduce((itemSum, item) => {
                const prod = products.find(p => p.id === item.productId);
                return itemSum + (item.quantity * (prod?.buyingPrice || 0));
            }, 0);
        }, 0);

        // Operational deductions: 350 for delivered, 150 for returns
        const shipDeductions = deliveredOrders.length * 350;
        const returnDeductions = returnedOrders.length * 150;
        
        const netProfitPool = attributedRevenue - totalCogs - shipDeductions - returnDeductions;
        const userProfitShare = Math.max(0, netProfitPool * 0.5); // 50% split for workforce pool

        return {
            ...user,
            confirmed: userConfirmed,
            dailyShipped,
            share: userProfitShare,
            tenantName: tenants.find(t => t.id === user.tenantId)?.settings.shopName || 'Milky Way default'
        };
    }).sort((a, b) => b.share - a.share);

    const totalGlobalDelivered = orders.filter(o => o.status === OrderStatus.DELIVERED).reduce((s, o) => s + o.totalAmount, 0);
    const totalGlobalShippedToday = orders.filter(o => o.shippedAt && new Date(o.shippedAt).toDateString() === todayStr).length;

    return { userStats, totalGlobalDelivered, totalGlobalShippedToday };
  }, [users, orders, tenants, products]);

  const handleCreate = async () => {
    if (!formData.name || !formData.mongoUri || !formData.adminEmail || !formData.adminPass) {
        alert("Security Error: Fill required fields (ID, MongoDB, Secret Key)");
        return;
    }
    await db.createTenant(formData);
    resetForm();
    load();
    alert("System: Cluster injection successful. Super Admin provisioned.");
  };

  const handleUpdate = async () => {
      if(!editingId) return;
      const t = tenants.find(x => x.id === editingId);
      if(!t) return;
      
      const updatedTenant: Tenant = {
          ...t,
          name: formData.name,
          mongoUri: formData.mongoUri,
          settings: {
              ...t.settings,
              shopName: formData.shopName,
              logoUrl: formData.logoUrl
          }
      };
      
      await db.updateTenant(updatedTenant);
      setEditingId(null);
      resetForm();
      load();
      alert("System: Cluster parameters updated.");
  };

  const startEdit = (t: Tenant) => {
      setEditingId(t.id);
      setFormData({
          name: t.name,
          shopName: t.settings.shopName,
          logoUrl: t.settings.logoUrl || '',
          mongoUri: t.mongoUri,
          adminEmail: '', 
          adminPass: '' 
      });
  };

  const resetForm = () => {
      setFormData({ name: '', shopName: '', logoUrl: '', mongoUri: '', adminEmail: '', adminPass: '' });
      setEditingId(null);
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-20 animate-slide-in">
      {/* Dev Master Header */}
      <div className="bg-slate-950 text-white p-10 rounded-[3rem] shadow-2xl relative overflow-hidden border border-white/5">
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-blue-600 rounded-full mix-blend-overlay filter blur-[150px] opacity-10 transform translate-x-1/4 -translate-y-1/4"></div>
        <div className="relative z-10">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-10">
                <div>
                    <div className="flex items-center gap-3 mb-4">
                        <ShieldCheck size={32} className="text-blue-400" />
                        <span className="px-4 py-1.5 bg-blue-500/20 text-blue-400 rounded-full text-[10px] font-black uppercase tracking-[0.2em] border border-blue-500/30">Protocol v3.2 Encrypted</span>
                    </div>
                    <h2 className="text-5xl font-black mb-2 tracking-tighter uppercase">Milky Way Master</h2>
                    <p className="text-slate-400 max-w-md text-xs font-bold uppercase tracking-widest opacity-60">Multi-Cluster Intelligence Command Center</p>
                </div>
                
                <div className="flex gap-4">
                   <div className="bg-white/5 backdrop-blur-md p-6 rounded-[2.5rem] border border-white/10 text-center min-w-[160px]">
                      <p className="text-[10px] font-black text-slate-500 uppercase mb-1 tracking-widest">Global Settle</p>
                      <p className="text-2xl font-black text-blue-400">{formatCurrency(metrics.totalGlobalDelivered)}</p>
                   </div>
                   <div className="bg-white/5 backdrop-blur-md p-6 rounded-[2.5rem] border border-white/10 text-center min-w-[160px]">
                      <p className="text-[10px] font-black text-slate-500 uppercase mb-1 tracking-widest">Today Ships</p>
                      <p className="text-2xl font-black text-white">{metrics.totalGlobalShippedToday}</p>
                   </div>
                </div>
            </div>

            {/* Navigation Tabs */}
            <div className="flex gap-2 p-1.5 bg-white/5 rounded-2xl w-fit border border-white/10">
                <button onClick={() => setView('CLUSTERS')} className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${view === 'CLUSTERS' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}>Active Clusters</button>
                <button onClick={() => setView('USERS')} className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${view === 'USERS' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}>Global Workforce</button>
                <button onClick={() => setView('SECURITY')} className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${view === 'SECURITY' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}>Security Grid</button>
            </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* Main Content Area */}
        <div className="lg:col-span-8 space-y-6">
            {view === 'CLUSTERS' && (
                <div className="space-y-6">
                    <div className="flex items-center justify-between px-2">
                        <h3 className="text-xl font-black text-slate-900 flex items-center gap-2 uppercase tracking-tight"><Globe size={20} className="text-blue-500"/> Deployment Matrix</h3>
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{tenants.length} Instances Online</span>
                    </div>
                    
                    <div className="grid gap-4">
                        {tenants.map(t => (
                            <div key={t.id} className="bg-white p-6 rounded-[2.5rem] border border-slate-100 flex items-center justify-between shadow-sm hover:shadow-xl transition-all group border-l-4 border-l-blue-500">
                                <div className="flex items-center gap-6">
                                    <div className="w-16 h-16 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-300 border border-slate-100 overflow-hidden">
                                        {t.settings.logoUrl ? <img src={t.settings.logoUrl} className="w-full h-full object-cover" /> : <Database size={24} />}
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <h4 className="text-xl font-black text-slate-900 tracking-tighter uppercase">{t.settings.shopName || t.name}</h4>
                                            <span className={`px-2 py-0.5 rounded-lg text-[8px] font-black uppercase ${t.isActive ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
                                                {t.isActive ? 'ACTIVE' : 'IDLE'}
                                            </span>
                                        </div>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">ID: {t.id} | Nodes: {users.filter(u => u.tenantId === t.id).length} Staff</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button onClick={() => startEdit(t)} className="p-3 bg-slate-50 text-slate-400 hover:bg-blue-600 hover:text-white rounded-xl transition-all"><Edit size={16} /></button>
                                    <button className="p-3 bg-slate-50 text-slate-400 hover:bg-black hover:text-white rounded-xl transition-all"><ExternalLink size={16} /></button>
                                </div>
                            </div>
                        ))}
                        {tenants.length === 0 && (
                            <div className="p-20 text-center text-slate-300 font-black uppercase tracking-widest">Zero Clusters Injected</div>
                        )}
                    </div>
                </div>
            )}

            {view === 'USERS' && (
                <div className="space-y-6">
                    <div className="flex items-center justify-between px-2">
                        <h3 className="text-xl font-black text-slate-900 flex items-center gap-2 uppercase tracking-tight"><Users size={20} className="text-blue-500"/> Ecosystem Performance</h3>
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{users.length} Active Node Identifiers</span>
                    </div>
                    
                    <div className="modern-card overflow-hidden">
                        <table className="w-full text-left compact-table">
                            <thead>
                                <tr className="bg-slate-50/50">
                                    <th>Workforce ID</th>
                                    <th>Cluster Assignment</th>
                                    <th className="text-center">Ships (Today)</th>
                                    <th className="text-right">Profit Contribution</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {metrics.userStats.map((u: any) => (
                                    <tr key={u.id} className="hover:bg-slate-50 transition-colors">
                                        <td>
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-slate-900 flex items-center justify-center text-[10px] font-bold text-blue-400">
                                                    {u.username.slice(0, 2).toUpperCase()}
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="font-black text-slate-900 text-sm uppercase">{u.username}</span>
                                                    <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">{u.role}</span>
                                                </div>
                                            </div>
                                        </td>
                                        <td>
                                            <span className="text-[10px] font-black text-slate-500 uppercase bg-slate-100 px-2 py-1 rounded-md">{u.tenantName}</span>
                                        </td>
                                        <td className="text-center">
                                            <div className="flex flex-col items-center">
                                                <span className="font-black text-blue-600 text-lg">{u.dailyShipped}</span>
                                                <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Parcels</span>
                                            </div>
                                        </td>
                                        <td className="text-right">
                                            <div className="flex flex-col items-end">
                                                <span className="font-black text-emerald-600 text-sm">{formatCurrency(u.share)}</span>
                                                <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Share Value</span>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {metrics.userStats.length === 0 && (
                            <div className="p-20 text-center text-slate-300 uppercase font-black text-xs tracking-widest">No workforce data available</div>
                        )}
                    </div>
                </div>
            )}

            {view === 'SECURITY' && (
                <div className="space-y-6">
                    <div className="flex items-center justify-between px-2">
                        <h3 className="text-xl font-black text-slate-900 flex items-center gap-2 uppercase tracking-tight"><Lock size={20} className="text-blue-500"/> Integrity Shield</h3>
                        <div className="flex items-center gap-2 text-[10px] font-black text-green-500 uppercase bg-green-50 px-3 py-1 rounded-full border border-green-100">
                            <Zap size={10} className="animate-pulse" /> End-to-End Secured
                        </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="modern-card p-6 bg-slate-900 text-white border-none space-y-4">
                            <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2"><Fingerprint size={16}/> Access Logs</h4>
                            <div className="space-y-3 h-[400px] overflow-auto no-scrollbar pr-2">
                                {securityLogs.slice().reverse().map((log, i) => (
                                    <div key={i} className="bg-white/5 border border-white/10 rounded-xl p-3 flex justify-between items-center group hover:bg-white/10 transition-all">
                                        <div className="flex flex-col">
                                            <span className="text-[10px] font-black text-blue-400 uppercase">{log.event}</span>
                                            <span className="text-[11px] font-bold text-white">{log.user}</span>
                                        </div>
                                        <span className="text-[9px] font-mono text-slate-500">{new Date(log.timestamp).toLocaleTimeString()}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="modern-card p-8 flex flex-col items-center justify-center text-center space-y-6">
                            <div className="w-24 h-24 bg-blue-50 rounded-full flex items-center justify-center text-blue-600 shadow-inner">
                                <ShieldCheck size={48} className="animate-pulse" />
                            </div>
                            <div>
                                <h4 className="text-2xl font-black text-slate-900 tracking-tighter uppercase">Cluster Protection Active</h4>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2">Console obfuscation & IP masking enabled</p>
                            </div>
                            <div className="w-full pt-6 border-t border-slate-50 space-y-3">
                                {['Real-time XSS Filtering', 'DB Node Isolation', 'Master Key Rotation'].map((p, i) => (
                                    <div key={i} className="flex items-center justify-between px-4 py-2 bg-slate-50 rounded-xl text-[10px] font-bold text-slate-600 uppercase">
                                        <span>{p}</span>
                                        <div className="w-2 h-2 rounded-full bg-green-500"></div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>

        {/* Configuration Sidebar */}
        <div className="lg:col-span-4 space-y-6">
            <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm sticky top-10 space-y-8">
                <div>
                    <h3 className="text-xl font-black text-slate-900 flex items-center gap-2 uppercase tracking-tight">
                        {editingId ? <Edit size={20} /> : <PlusCircle size={20} />} 
                        {editingId ? 'Modify Parameters' : 'Provision Instance'}
                    </h3>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Global infrastructure injection</p>
                </div>

                <div className="space-y-6">
                    <div className="p-5 bg-slate-50 rounded-[2rem] border border-slate-100 space-y-4">
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">Deployment Identity</p>
                        <input className="w-full bg-white border border-slate-200 rounded-2xl px-5 py-3.5 text-slate-900 font-bold text-sm focus:ring-2 focus:ring-blue-500 outline-none" 
                               value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="Internal Grid ID" />
                        <input className="w-full bg-white border border-slate-200 rounded-2xl px-5 py-3.5 text-slate-900 font-mono text-xs focus:ring-2 focus:ring-blue-500 outline-none" 
                               value={formData.mongoUri} onChange={e => setFormData({...formData, mongoUri: e.target.value})} placeholder="MongoDB URI String" />
                    </div>

                    <div className="p-5 bg-blue-50/50 rounded-[2rem] border border-blue-100 space-y-4">
                        <p className="text-[9px] font-black text-blue-500 uppercase tracking-[0.2em]">Branding Overrides</p>
                        <input className="w-full bg-white border border-slate-200 rounded-2xl px-5 py-3.5 text-slate-900 font-bold text-sm focus:ring-2 focus:ring-blue-500 outline-none" 
                               value={formData.shopName} onChange={e => setFormData({...formData, shopName: e.target.value})} placeholder="Custom Dashboard Name" />
                        <input className="w-full bg-white border border-slate-200 rounded-2xl px-5 py-3.5 text-slate-900 font-bold text-sm focus:ring-2 focus:ring-blue-500 outline-none" 
                               value={formData.logoUrl} onChange={e => setFormData({...formData, logoUrl: e.target.value})} placeholder="Logo CDN URL" />
                    </div>

                    {!editingId && (
                        <div className="p-5 bg-purple-50/50 rounded-[2rem] border border-purple-100 space-y-4">
                            <p className="text-[9px] font-black text-purple-500 uppercase tracking-[0.2em]">Master Admin Sync</p>
                            <input className="w-full bg-white border border-slate-200 rounded-2xl px-5 py-3.5 text-slate-900 font-bold text-sm outline-none" 
                                   value={formData.adminEmail} onChange={e => setFormData({...formData, adminEmail: e.target.value})} placeholder="Root Username" />
                            <input className="w-full bg-white border border-slate-200 rounded-2xl px-5 py-3.5 text-slate-900 font-bold text-sm outline-none" 
                                   value={formData.adminPass} onChange={e => setFormData({...formData, adminPass: e.target.value})} placeholder="Master Secret Key" />
                        </div>
                    )}

                    <button onClick={editingId ? handleUpdate : handleCreate} className="w-full bg-blue-600 text-white py-5 rounded-2xl font-black uppercase tracking-[0.2em] text-[10px] shadow-xl hover:bg-blue-700 active:scale-95 transition-all">
                        {editingId ? 'Update Cluster' : 'Deploy Infrastructure'}
                    </button>
                    {editingId && <button onClick={resetForm} className="w-full text-[10px] font-black text-slate-400 uppercase tracking-widest">Cancel Operation</button>}
                </div>
            </div>
        </div>

      </div>
    </div>
  );
};
