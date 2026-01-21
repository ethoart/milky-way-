import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../services/mockBackend';
import { Tenant, User, Order, OrderStatus, Product, UserRole } from '../types';
import { 
  Database, 
  ShieldCheck, 
  Edit, 
  RefreshCcw,
  Server,
  Fingerprint,
  Zap
} from 'lucide-react';
import { formatCurrency } from '../utils/helpers';

export const DevAdmin: React.FC = () => {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [securityLogs, setSecurityLogs] = useState<any[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'CLUSTERS' | 'USERS' | 'SECURITY'>('CLUSTERS');

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
    try {
      const [t, u, o, s] = await Promise.all([
          db.getTenants(),
          db.getAllUsers(),
          db.getAllOrders(),
          db.getSecurityLogs()
      ]);
      setTenants(t);
      setUsers(u);
      setOrders(o);
      setSecurityLogs(s);
    } catch (e) {
      console.error("Master Console Sync Failure", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { 
    load();
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, []);

  const metrics = useMemo(() => {
    const todayStr = new Date().toDateString();
    const totalGlobalDelivered = orders.filter(o => o.status === OrderStatus.DELIVERED).reduce((s, o) => s + o.totalAmount, 0);
    const userStats = users.map(u => ({ ...u, tenantName: tenants.find(t => t.id === u.tenantId)?.settings.shopName || 'Unknown' }));
    return { userStats, totalGlobalDelivered };
  }, [users, orders, tenants]);

  const handleCreate = async () => {
    if (!formData.name || !formData.adminEmail || !formData.adminPass) {
        alert("Provision Error: Required fields missing.");
        return;
    }
    await db.createTenant(formData);
    setFormData({ name: '', shopName: '', logoUrl: '', mongoUri: '', adminEmail: '', adminPass: '' });
    load();
    alert("System: Infrastructure deployed successfully.");
  };

  const handleUpdate = async () => {
      if(!editingId) return;
      const t = tenants.find(x => x.id === editingId);
      if(!t) return;
      
      const updatedTenant: Tenant = {
          ...t,
          name: formData.name,
          mongoUri: formData.mongoUri,
          settings: { ...t.settings, shopName: formData.shopName, logoUrl: formData.logoUrl }
      };
      
      try {
        await db.updateTenant(updatedTenant, formData.adminEmail, formData.adminPass);
        setEditingId(null);
        setFormData({ name: '', shopName: '', logoUrl: '', mongoUri: '', adminEmail: '', adminPass: '' });
        load();
        alert("System: Cluster and Super Admin identity updated successfully.");
      } catch (e: any) {
        alert(`Update Failed: ${e.message}`);
      }
  };

  const handleEditClick = (t: Tenant) => {
    // Find the current super admin for this tenant to pre-populate username
    const currentAdmin = users.find(u => u.tenantId === t.id && u.role === UserRole.SUPER_ADMIN);
    
    setEditingId(t.id);
    setFormData({
      ...formData,
      name: t.name,
      shopName: t.settings.shopName || '',
      logoUrl: t.settings.logoUrl || '',
      mongoUri: t.mongoUri || '',
      adminEmail: currentAdmin?.username || '',
      adminPass: '' // Keep password blank for security, only update if typed
    });
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-20 animate-slide-in">
      <div className="bg-slate-950 text-white p-10 rounded-[3rem] shadow-2xl relative overflow-hidden border border-white/5">
        <div className="relative z-10">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-10">
                <div>
                    <div className="flex items-center gap-3 mb-4">
                        <ShieldCheck size={32} className="text-blue-400" />
                        <span className="px-4 py-1.5 bg-blue-500/20 text-blue-400 rounded-full text-[10px] font-black uppercase tracking-[0.2em] border border-blue-500/30">Master Infrastructure</span>
                    </div>
                    <h2 className="text-5xl font-black mb-2 tracking-tighter uppercase">Milky Way Master</h2>
                    <p className="text-slate-400 text-xs font-bold uppercase tracking-widest opacity-60">Cross-Cluster Intelligence Command</p>
                </div>
                <div className="flex gap-4">
                   <div className="bg-white/5 backdrop-blur-md p-6 rounded-[2.5rem] border border-white/10 text-center min-w-[160px]">
                      <p className="text-[10px] font-black text-slate-500 uppercase mb-1 tracking-widest">Global Settle</p>
                      <p className="text-2xl font-black text-blue-400">{formatCurrency(metrics.totalGlobalDelivered)}</p>
                   </div>
                   <button onClick={load} className="p-4 bg-white/10 rounded-full hover:bg-white/20 transition-all">
                      <RefreshCcw size={20} className={loading ? 'animate-spin' : ''} />
                   </button>
                </div>
            </div>
            <div className="flex gap-2 p-1.5 bg-white/5 rounded-2xl w-fit border border-white/10">
                <button onClick={() => setView('CLUSTERS')} className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${view === 'CLUSTERS' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}>Active Clusters</button>
                <button onClick={() => setView('USERS')} className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${view === 'USERS' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}>Identity Registry</button>
                <button onClick={() => setView('SECURITY')} className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${view === 'SECURITY' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}>Security Grid</button>
            </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <div className="lg:col-span-8 space-y-6">
            {view === 'CLUSTERS' && (
                <div className="grid gap-4">
                    {tenants.map(t => (
                        <div key={t.id} className="bg-white p-6 rounded-[2.5rem] border border-slate-100 flex items-center justify-between shadow-sm hover:shadow-xl transition-all">
                            <div className="flex items-center gap-6">
                                <div className="w-16 h-16 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-300 border border-slate-100 overflow-hidden">
                                    {t.settings.logoUrl ? <img src={t.settings.logoUrl} className="w-full h-full object-cover" /> : <Database size={24} />}
                                </div>
                                <div>
                                    <h4 className="text-xl font-black text-slate-900 tracking-tighter uppercase">{t.settings.shopName || t.name}</h4>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Node Identifier: {t.id}</p>
                                    <p className="text-[9px] font-mono text-blue-500 mt-1 truncate max-w-[300px]">{t.mongoUri || 'Using Central Milky Way Pool'}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <button onClick={() => handleEditClick(t)} className="p-3 bg-slate-50 text-slate-400 hover:bg-blue-600 hover:text-white rounded-xl transition-all"><Edit size={16} /></button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
            {view === 'USERS' && (
                <div className="modern-card overflow-hidden">
                    <table className="w-full text-left compact-table">
                        <thead><tr className="bg-slate-50/50"><th>Identity</th><th>Cluster</th><th>Role</th></tr></thead>
                        <tbody className="divide-y divide-slate-100">
                            {metrics.userStats.map((u: any) => (
                                <tr key={u.id} className="hover:bg-slate-50">
                                    <td><span className="font-black text-slate-900 text-sm uppercase">{u.username}</span></td>
                                    <td><span className="text-[10px] font-black text-slate-500 uppercase bg-slate-100 px-2 py-1 rounded-md">{u.tenantName}</span></td>
                                    <td><span className="text-[10px] font-bold text-blue-600 uppercase tracking-widest">{u.role}</span></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
            {view === 'SECURITY' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="modern-card p-6 bg-slate-900 text-white border-none h-[400px] flex flex-col">
                        <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2 mb-4"><Fingerprint size={16}/> Protocol Logs</h4>
                        <div className="flex-1 overflow-auto space-y-3 pr-2">
                            {securityLogs.slice().reverse().map((log, i) => (
                                <div key={i} className="bg-white/5 border border-white/10 rounded-xl p-3 flex justify-between items-center">
                                    <span className="text-[10px] font-black text-blue-400 uppercase">{log.event}</span>
                                    <span className="text-[9px] font-mono text-slate-500">{new Date(log.timestamp).toLocaleTimeString()}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="modern-card p-8 flex flex-col items-center justify-center text-center space-y-6">
                        <Zap size={48} className="text-blue-500 animate-pulse" />
                        <h4 className="text-2xl font-black text-slate-900 tracking-tighter uppercase">Cluster Protection Active</h4>
                    </div>
                </div>
            )}
        </div>
        <div className="lg:col-span-4">
            <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm space-y-8 sticky top-10">
                <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">{editingId ? 'Edit Cluster' : 'Provision Cluster'}</h3>
                <div className="space-y-4">
                    <div>
                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1.5 ml-1">System Identifier</label>
                        <input className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 text-sm font-bold outline-none" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="t-xyz" disabled={!!editingId} />
                    </div>
                    <div>
                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1.5 ml-1">Branding Name</label>
                        <input className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 text-sm font-bold outline-none" value={formData.shopName} onChange={e => setFormData({...formData, shopName: e.target.value})} placeholder="Shop Name" />
                    </div>
                    <div>
                        <label className="text-[9px] font-black text-blue-500 uppercase tracking-widest block mb-1.5 ml-1 flex items-center gap-1.5"><Server size={10}/> Dedicated Mongo URI</label>
                        <input className="w-full bg-blue-50 border border-blue-100 rounded-2xl px-5 py-4 text-[10px] font-mono font-bold outline-none text-blue-600" value={formData.mongoUri} onChange={e => setFormData({...formData, mongoUri: e.target.value})} placeholder="mongodb+srv://..." />
                    </div>
                    <div className="pt-4 border-t border-slate-100">
                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1.5 ml-1">Super Admin Account</label>
                        <input className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 text-sm font-bold outline-none mb-2" value={formData.adminEmail} onChange={e => setFormData({...formData, adminEmail: e.target.value})} placeholder="Email/Username" />
                        <input className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 text-sm font-bold outline-none" type="password" value={formData.adminPass} onChange={e => setFormData({...formData, adminPass: e.target.value})} placeholder={editingId ? "New Key (leave blank to keep)" : "Security Key"} />
                    </div>
                    <button onClick={editingId ? handleUpdate : handleCreate} className="w-full bg-blue-600 text-white py-5 rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-xl hover:bg-blue-700 transition-all mt-4">
                        {editingId ? 'Update Identity' : 'Inject Infrastructure'}
                    </button>
                    {editingId && (
                      <button onClick={() => { setEditingId(null); setFormData({name: '', shopName: '', logoUrl: '', mongoUri: '', adminEmail: '', adminPass: ''}); }} className="w-full text-slate-400 font-bold text-[10px] uppercase tracking-widest py-2">Cancel Edit</button>
                    )}
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};