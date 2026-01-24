
import React, { useState, useEffect } from 'react';
import { db } from '../services/mockBackend';
import { Tenant, User, Order, OrderStatus, Product, UserRole, DomainRecord } from '../types';
import { 
  Database, 
  ShieldCheck, 
  Edit, 
  RefreshCcw,
  Globe,
  Plus,
  Trash2,
  ExternalLink,
  Cloud,
  Copy,
  CheckCircle2,
  Info,
  Fingerprint
} from 'lucide-react';

export const DevAdmin: React.FC = () => {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [securityLogs, setSecurityLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'CLUSTERS' | 'DOMAINS' | 'SECURITY'>('CLUSTERS');
  const [copied, setCopied] = useState<string | null>(null);

  // The system's target for DNS records
  const dnsTarget = window.location.hostname; 
  const staticIp = "76.76.21.21"; // Vercel/Netlify/Custom IP target

  const load = async () => {
    setLoading(true);
    try {
      const [t, u, s] = await Promise.all([
          db.getTenants(),
          db.getAllUsers(),
          db.getSecurityLogs()
      ]);
      setTenants(t);
      setUsers(u);
      setSecurityLogs(s);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleUpdateTenant = async (t: Tenant) => {
    await db.updateTenant(t);
    load();
  };

  const addDomain = async (tenantId: string) => {
    const host = prompt("Enter the custom domain (e.g., store.arobazzar.com):");
    if (!host) return;
    const t = tenants.find(x => x.id === tenantId);
    if (t) {
      const records = t.domainRecords || [];
      const updated: Tenant = { 
        ...t, 
        domainRecords: [...records, { host, type: 'CNAME', isActive: true }] 
      };
      await handleUpdateTenant(updated);
    }
  };

  const removeDomain = async (tenantId: string, host: string) => {
    if (!confirm("Are you sure you want to delete this domain mapping?")) return;
    const t = tenants.find(x => x.id === tenantId);
    if (t) {
      const records = (t.domainRecords || []).filter(r => r.host !== host);
      const updated: Tenant = { ...t, domainRecords: records };
      await handleUpdateTenant(updated);
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-20 animate-slide-in">
      <div className="bg-slate-950 text-white p-10 rounded-[3rem] shadow-2xl relative overflow-hidden border border-white/5">
        <div className="relative z-10">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-10">
                <div>
                    <div className="flex items-center gap-3 mb-4">
                        <ShieldCheck size={32} className="text-blue-400" />
                        <span className="px-4 py-1.5 bg-blue-500/20 text-blue-400 rounded-full text-[10px] font-black uppercase tracking-[0.2em] border border-blue-500/30">Milky Way OMS Master</span>
                    </div>
                    <h2 className="text-5xl font-black mb-2 tracking-tighter uppercase leading-none">Global Infrastructure</h2>
                    <p className="text-slate-400 text-xs font-bold uppercase tracking-widest opacity-60">Multi-Domain & Cluster Control</p>
                </div>
                <button onClick={load} className="p-4 bg-white/10 rounded-full hover:bg-white/20 transition-all">
                  <RefreshCcw size={20} className={loading ? 'animate-spin' : ''} />
                </button>
            </div>
            <div className="flex gap-2 p-1.5 bg-white/5 rounded-2xl w-fit border border-white/10">
                <button onClick={() => setView('CLUSTERS')} className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${view === 'CLUSTERS' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}>Tenant Clusters</button>
                <button onClick={() => setView('DOMAINS')} className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${view === 'DOMAINS' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}>Domain Registry</button>
                <button onClick={() => setView('SECURITY')} className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${view === 'SECURITY' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}>Audit Logs</button>
            </div>
        </div>
      </div>

      <div className="space-y-6">
        {view === 'CLUSTERS' && (
            <div className="grid gap-4">
                {tenants.map(t => (
                    <div key={t.id} className="bg-white p-6 rounded-[2.5rem] border border-slate-100 flex items-center justify-between shadow-sm hover:shadow-lg transition-all">
                        <div className="flex items-center gap-6">
                            <div className="w-16 h-16 rounded-2xl bg-slate-50 flex items-center justify-center border border-slate-100 overflow-hidden">
                                {t.settings.logoUrl ? <img src={t.settings.logoUrl} className="w-full h-full object-cover" /> : <Database size={24} className="text-slate-300" />}
                            </div>
                            <div>
                                <h4 className="text-xl font-black text-slate-900 tracking-tighter uppercase">{t.settings.shopName || t.name}</h4>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Node ID: {t.id} • Domains: {(t.domainRecords || []).length}</p>
                                <p className="text-[9px] font-mono text-blue-500 mt-1 truncate max-w-[400px]">{t.mongoUri}</p>
                            </div>
                        </div>
                        <button className="px-6 py-2 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest">Edit Node</button>
                    </div>
                ))}
            </div>
        )}

        {view === 'DOMAINS' && (
          <div className="space-y-10">
            {/* Cloudflare Setup Instructions Box (Visibility for Super Admin via Dev Admin) */}
            <div className="bg-blue-600 text-white p-8 rounded-[3.5rem] shadow-xl flex flex-col lg:flex-row items-center gap-10">
                <div className="w-20 h-20 bg-white/20 rounded-[2rem] flex items-center justify-center shrink-0">
                    <Cloud size={40} />
                </div>
                <div className="flex-1 space-y-4">
                    <h3 className="text-2xl font-black uppercase tracking-tight">Cloudflare DNS Instructions</h3>
                    <p className="text-[11px] font-bold opacity-80 uppercase tracking-widest leading-relaxed">
                        To point a custom domain to this Milky Way Cluster, provide these details to the Super Admin for their Cloudflare dashboard:
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-white/10 p-5 rounded-2xl border border-white/20">
                            <div className="flex justify-between items-center mb-1">
                                <span className="text-[9px] font-black uppercase opacity-60">Record Type: CNAME</span>
                                <button onClick={() => copyToClipboard(dnsTarget, 'cname')} className="text-white/40 hover:text-white">
                                    {copied === 'cname' ? <CheckCircle2 size={14}/> : <Copy size={14}/>}
                                </button>
                            </div>
                            <span className="text-sm font-mono font-black">{dnsTarget}</span>
                        </div>
                        <div className="bg-white/10 p-5 rounded-2xl border border-white/20">
                            <div className="flex justify-between items-center mb-1">
                                <span className="text-[9px] font-black uppercase opacity-60">Record Type: A (Static)</span>
                                <button onClick={() => copyToClipboard(staticIp, 'a')} className="text-white/40 hover:text-white">
                                    {copied === 'a' ? <CheckCircle2 size={14}/> : <Copy size={14}/>}
                                </button>
                            </div>
                            <span className="text-sm font-mono font-black">{staticIp}</span>
                        </div>
                    </div>
                </div>
            </div>

            {tenants.map(t => (
              <div key={t.id} className="bg-white p-8 rounded-[3.5rem] border border-slate-100 shadow-sm space-y-8">
                <div className="flex items-center justify-between border-b border-slate-50 pb-6">
                    <div className="flex items-center gap-5">
                        <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center border border-slate-100">
                             {t.settings.logoUrl ? <img src={t.settings.logoUrl} className="w-full h-full object-cover rounded-xl" /> : <Globe size={24} className="text-slate-300"/>}
                        </div>
                        <div>
                            <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tight leading-none">{t.settings.shopName}</h3>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Tenant Cluster Binding</p>
                        </div>
                    </div>
                    <button onClick={() => addDomain(t.id)} className="bg-blue-600 text-white px-6 py-3 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] shadow-lg flex items-center gap-2 hover:bg-blue-700 transition-all">
                        <Plus size={16} /> Add Domain
                    </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {(t.domainRecords || []).map(r => (
                        <div key={r.host} className="group relative bg-slate-50 border border-slate-100 p-6 rounded-3xl transition-all hover:bg-white hover:shadow-2xl hover:border-blue-100">
                            <div className="flex justify-between items-start mb-6">
                                <div className="px-3 py-1 bg-blue-100 text-blue-600 rounded-lg text-[9px] font-black uppercase tracking-widest">{r.type} Record</div>
                                <button onClick={() => removeDomain(t.id, r.host)} className="p-2 text-slate-300 hover:text-rose-500 bg-white rounded-xl shadow-sm opacity-0 group-hover:opacity-100 transition-all">
                                    <Trash2 size={16} />
                                </button>
                            </div>
                            <h4 className="text-lg font-black text-slate-900 truncate tracking-tight">{r.host}</h4>
                            <div className="mt-4 flex items-center gap-4">
                                <a href={`https://${r.host}`} target="_blank" className="text-[9px] font-black text-blue-500 uppercase flex items-center gap-1.5 hover:underline">
                                    <ExternalLink size={12} /> Test Handshake
                                </a>
                                <div className="flex items-center gap-1 text-[9px] font-black text-emerald-600 uppercase">
                                    <ShieldCheck size={12} /> Live
                                </div>
                            </div>
                        </div>
                    ))}
                    {(!t.domainRecords || t.domainRecords.length === 0) && (
                        <div className="col-span-full py-16 text-center border-4 border-dashed border-slate-50 rounded-[3rem] text-slate-300">
                            <Globe size={48} className="mx-auto mb-4 opacity-10" />
                            <p className="text-[10px] font-black uppercase tracking-[0.4em]">No custom domains assigned</p>
                        </div>
                    )}
                </div>
              </div>
            ))}
          </div>
        )}

        {view === 'SECURITY' && (
          <div className="bg-slate-950 p-10 rounded-[3rem] h-[600px] flex flex-col border border-white/5">
              <h4 className="text-[11px] font-black text-slate-500 uppercase tracking-[0.3em] flex items-center gap-3 mb-8">
                  {/* Fixed Fingerprint component usage by importing it from lucide-react */}
                  <Fingerprint size={20} className="text-blue-500" /> Infrastructure Audit Trail
              </h4>
              <div className="flex-1 overflow-auto space-y-3 pr-4">
                  {securityLogs.slice().reverse().map((log, i) => (
                      <div key={i} className="bg-white/5 border border-white/10 p-4 rounded-2xl flex justify-between items-center group">
                          <div className="flex items-center gap-4">
                              <div className="w-1.5 h-1.5 rounded-full bg-blue-500 group-hover:animate-ping"></div>
                              <span className="text-[11px] font-black text-white uppercase tracking-tight">{log.event}</span>
                          </div>
                          <span className="text-[9px] font-mono text-slate-500">{new Date(log.timestamp).toLocaleString()}</span>
                      </div>
                  ))}
              </div>
          </div>
        )}
      </div>
    </div>
  );
};
