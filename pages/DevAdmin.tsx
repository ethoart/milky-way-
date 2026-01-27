
import React, { useState, useEffect, useRef } from 'react';
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
  Fingerprint,
  X,
  Save,
  Server,
  Key,
  AlertTriangle,
  Lock,
  Zap,
  Activity,
  Terminal,
  MapPin,
  Upload
} from 'lucide-react';

export const DevAdmin: React.FC = () => {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [securityLogs, setSecurityLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'CLUSTERS' | 'DOMAINS' | 'SECURITY' | 'GLOBAL_DATA'>('CLUSTERS');
  const [copied, setCopied] = useState<string | null>(null);
  const [globalCities, setGlobalCities] = useState<string[]>([]);
  const cityInputRef = useRef<HTMLInputElement>(null);
  
  // Modal States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTenant, setEditingTenant] = useState<Tenant | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    shopName: '',
    logoUrl: '',
    mongoUri: '',
    domain: '',
    adminEmail: '',
    adminPass: ''
  });

  const dnsTarget = window.location.hostname; 
  const staticIp = "76.76.21.21"; 

  const load = async () => {
    setLoading(true);
    try {
      const [t, s, c] = await Promise.all([
          db.getTenants(),
          db.getSecurityLogs(),
          db.getGlobalCities()
      ]);
      setTenants(t);
      setSecurityLogs(s);
      setGlobalCities(c);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleCityCsvUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
        const text = event.target?.result as string;
        const lines = text.split('\n');
        const header = lines[0].toLowerCase().split(',');
        const cityIdx = header.indexOf('city_name');
        
        const finalCityIdx = cityIdx !== -1 ? cityIdx : 0;
        const result: string[] = [];

        for (let i = 1; i < lines.length; i++) {
          const line = lines[i].trim();
          if (!line) continue;
          const parts = line.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g);
          if (parts && parts[finalCityIdx]) {
            result.push(parts[finalCityIdx].replace(/^"|"$/g, '').trim());
          }
        }
        
        if (result.length > 0) {
            if (confirm(`Detected ${result.length} cities. Update global registry?`)) {
                setLoading(true);
                await db.updateGlobalCities(result);
                setGlobalCities(result);
                setLoading(false);
                alert("Global city list synchronized.");
            }
        } else {
            alert("No data found in 'city_name' column.");
        }
    };
    reader.readAsText(file);
  };

  const openCreateModal = () => {
    setEditingTenant(null);
    setFormData({
      name: '',
      shopName: '',
      logoUrl: '',
      mongoUri: '',
      domain: '',
      adminEmail: '',
      adminPass: ''
    });
    setIsModalOpen(true);
  };

  const openEditModal = (t: Tenant) => {
    setEditingTenant(t);
    setFormData({
      name: t.name,
      shopName: t.settings.shopName,
      logoUrl: t.settings.logoUrl || '',
      mongoUri: t.mongoUri,
      domain: t.domain || '',
      adminEmail: '', 
      adminPass: ''
    });
    setIsModalOpen(true);
  };

  const handleSaveCluster = async () => {
    if (!formData.name || !formData.mongoUri) return alert("Node Name and Database URI are required.");
    
    setLoading(true);
    try {
      if (editingTenant) {
        const updated: Tenant = {
          ...editingTenant,
          name: formData.name,
          mongoUri: formData.mongoUri,
          domain: formData.domain,
          settings: {
            ...editingTenant.settings,
            shopName: formData.shopName,
            logoUrl: formData.logoUrl
          }
        };
        await db.updateTenant(updated, formData.adminEmail || undefined, formData.adminPass || undefined);
      } else {
        await db.createTenant(formData);
      }
      setIsModalOpen(false);
      load();
    } catch (e: any) {
      alert("Sync Error: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteTenant = async (tenantId: string) => {
    if (!confirm("CRITICAL PROTOCOL: Purge this cluster dashboard and all associated credentials? This action is irreversible.")) return;
    setLoading(true);
    try {
      await db.deleteTenant(tenantId);
      await load();
    } catch (e: any) {
      alert("Purge failure: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  const addDomainRecord = async (tenantId: string) => {
    const host = prompt("Enter the custom domain (e.g., dashboard.brand.com):");
    if (!host) return;
    const t = tenants.find(x => x.id === tenantId);
    if (t) {
      const records = t.domainRecords || [];
      const updated: Tenant = { 
        ...t, 
        domainRecords: [...records, { host, type: 'CNAME', isActive: true }] 
      };
      await db.updateTenant(updated);
      load();
    }
  };

  const removeDomainRecord = async (tenantId: string, host: string) => {
    if (!confirm("Are you sure you want to delete this domain mapping?")) return;
    const t = tenants.find(x => x.id === tenantId);
    if (t) {
      const records = (t.domainRecords || []).filter(r => r.host !== host);
      const updated: Tenant = { ...t, domainRecords: records };
      await db.updateTenant(updated);
      load();
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-20 animate-slide-in">
      {/* Top Console */}
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
                <div className="flex gap-4">
                  <button onClick={openCreateModal} className="px-8 py-4 bg-blue-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest flex items-center gap-2 hover:bg-blue-700 shadow-xl transition-all active:scale-95">
                    <Plus size={18} /> New Dashboard
                  </button>
                  <button onClick={load} className="p-4 bg-white/10 rounded-full hover:bg-white/20 transition-all">
                    <RefreshCcw size={20} className={loading ? 'animate-spin' : ''} />
                  </button>
                </div>
            </div>
            <div className="flex flex-wrap gap-2 p-1.5 bg-white/5 rounded-2xl w-fit border border-white/10">
                <button onClick={() => setView('CLUSTERS')} className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${view === 'CLUSTERS' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}>Tenant Clusters</button>
                <button onClick={() => setView('DOMAINS')} className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${view === 'DOMAINS' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}>Domain Registry</button>
                <button onClick={() => setView('GLOBAL_DATA')} className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${view === 'GLOBAL_DATA' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}>Global Data</button>
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
                        <div className="flex gap-2">
                          <button onClick={() => openEditModal(t)} className="px-6 py-2 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 hover:bg-black transition-all">
                            <Edit size={14} /> Edit Node
                          </button>
                          <button onClick={() => handleDeleteTenant(t.id)} className="p-3 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all">
                            <Trash2 size={18} />
                          </button>
                        </div>
                    </div>
                ))}
                {tenants.length === 0 && !loading && (
                    <div className="py-32 text-center opacity-20 uppercase font-black text-xs tracking-[0.5em] flex flex-col items-center gap-6">
                        <Database size={60} strokeWidth={1} />
                        No Clusters Active
                    </div>
                )}
            </div>
        )}

        {view === 'GLOBAL_DATA' && (
          <div className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-sm space-y-10">
            <div className="flex items-center gap-4">
              <div className="p-4 bg-blue-600 text-white rounded-[1.5rem] shadow-xl">
                 <MapPin size={28} />
              </div>
              <div>
                <h2 className="text-2xl font-black text-slate-900 tracking-tighter uppercase leading-none">Global Region Management</h2>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2">Shared City Registry for all Clusters</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
               <div className="space-y-6">
                  <div className="bg-slate-50 p-8 rounded-[2.5rem] border border-slate-200">
                    <h4 className="text-[10px] font-black text-slate-900 uppercase tracking-widest mb-4 flex items-center gap-2">
                      <Upload size={14} className="text-blue-600"/> Import City Registry (CSV)
                    </h4>
                    <p className="text-[10px] font-bold text-slate-400 uppercase mb-6 leading-relaxed">
                      Upload a CSV file with a column named <b>city_name</b>. This list will be used by all Super Admins across the entire infrastructure.
                    </p>
                    <div 
                        onClick={() => cityInputRef.current?.click()}
                        className="border-4 border-dashed border-white rounded-[2rem] py-12 flex flex-col items-center justify-center cursor-pointer hover:border-blue-200 hover:bg-white transition-all"
                    >
                        <Upload size={32} className="text-slate-300 mb-3" />
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Select CSV Payload</span>
                        <input ref={cityInputRef} type="file" accept=".csv" onChange={handleCityCsvUpload} className="hidden" />
                    </div>
                  </div>
               </div>

               <div className="space-y-4">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Active City Registry ({globalCities.length})</h4>
                    <button onClick={async () => { if(confirm("Purge Registry?")) { await db.updateGlobalCities([]); setGlobalCities([]); } }} className="text-rose-500 hover:bg-rose-50 p-2 rounded-xl transition-all">
                      <Trash2 size={16} />
                    </button>
                  </div>
                  <div className="bg-slate-50 border border-slate-100 rounded-3xl p-6 max-h-[400px] overflow-y-auto no-scrollbar space-y-2 shadow-inner">
                    {globalCities.map((city, i) => (
                      <div key={i} className="bg-white px-4 py-2.5 rounded-xl border border-slate-200 text-[11px] font-black text-slate-700 uppercase flex items-center justify-between group">
                        {city}
                        <span className="text-[8px] font-mono text-slate-200 group-hover:text-slate-400">#00{i+1}</span>
                      </div>
                    ))}
                    {globalCities.length === 0 && (
                      <div className="py-20 text-center opacity-20">
                        <Zap size={48} className="mx-auto mb-4" />
                        <p className="text-[10px] font-black uppercase tracking-[0.3em]">Registry Empty</p>
                      </div>
                    )}
                  </div>
               </div>
            </div>
          </div>
        )}

        {view === 'DOMAINS' && (
          <div className="space-y-10">
            {/* Netlify & Cloudflare Setup Guide */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                <div className="lg:col-span-8 bg-blue-600 text-white p-10 rounded-[4rem] shadow-xl flex flex-col md:flex-row items-center gap-12">
                    <div className="w-24 h-24 bg-white/20 rounded-[2.5rem] flex items-center justify-center shrink-0 shadow-inner">
                        <Cloud size={48} />
                    </div>
                    <div className="flex-1 space-y-6">
                        <div>
                            <h3 className="text-3xl font-black uppercase tracking-tight">Deployment DNS Bridge</h3>
                            <p className="text-[11px] font-bold opacity-80 uppercase tracking-widest leading-relaxed mt-2">
                                Point custom domains to this cluster node using the following records:
                            </p>
                        </div>
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

                <div className="lg:col-span-4 bg-slate-900 border border-white/5 p-10 rounded-[3.5rem] space-y-6 shadow-2xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-5">
                         <Terminal size={120} />
                    </div>
                    <div className="flex items-center gap-3 text-rose-500 relative z-10">
                        <AlertTriangle size={24} />
                        <h3 className="text-sm font-black uppercase tracking-widest">Fixing 404 / 525 Errors</h3>
                    </div>
                    <div className="space-y-4 relative z-10">
                        <div className="p-4 bg-white/5 rounded-2xl border border-white/10">
                            <p className="text-[10px] font-black text-blue-400 uppercase mb-2">1. Site Not Found (404)</p>
                            <p className="text-[10px] font-bold text-slate-400 leading-relaxed">
                                You MUST add the domain in your <b>Netlify Dashboard</b> &gt; <b>Domain Management</b>. Netlify will reject traffic from unmapped domains.
                            </p>
                        </div>
                        <div className="p-4 bg-white/5 rounded-2xl border border-white/10">
                            <p className="text-[10px] font-black text-rose-400 uppercase mb-2">2. SSL Handshake (525)</p>
                            <p className="text-[10px] font-bold text-slate-400 leading-relaxed">
                                Set Cloudflare SSL to <b>"Full"</b> (NOT Strict). Disable "Always Use HTTPS" in Cloudflare to allow Netlify to verify the cert.
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {tenants.map(t => (
              <div key={t.id} className="bg-white p-10 rounded-[4rem] border border-slate-100 shadow-sm space-y-10">
                <div className="flex items-center justify-between border-b border-slate-50 pb-8">
                    <div className="flex items-center gap-5">
                        <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center border border-slate-100">
                             {t.settings.logoUrl ? <img src={t.settings.logoUrl} className="w-full h-full object-cover rounded-xl" /> : <Globe size={28} className="text-slate-300"/>}
                        </div>
                        <div>
                            <h3 className="text-3xl font-black text-slate-900 uppercase tracking-tight leading-none">{t.settings.shopName}</h3>
                            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mt-1">Active Hub: {t.id}</p>
                        </div>
                    </div>
                    <button onClick={() => addDomainRecord(t.id)} className="bg-slate-950 text-white px-8 py-4 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] shadow-xl flex items-center gap-2 hover:bg-black transition-all">
                        <Plus size={18} /> Bind Custom Host
                    </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {(t.domainRecords || []).map(r => (
                        <div key={r.host} className="group relative bg-slate-50 border border-slate-100 p-8 rounded-[2.5rem] transition-all hover:bg-white hover:shadow-2xl hover:border-blue-100">
                            <div className="flex justify-between items-start mb-6">
                                <div className="px-4 py-1.5 bg-blue-100 text-blue-600 rounded-xl text-[10px] font-black uppercase tracking-widest">{r.type} Record</div>
                                <button onClick={() => removeDomainRecord(t.id, r.host)} className="p-2 text-slate-300 hover:text-rose-500 bg-white rounded-xl shadow-sm opacity-0 group-hover:opacity-100 transition-all">
                                    <Trash2 size={18} />
                                </button>
                            </div>
                            <h4 className="text-xl font-black text-slate-900 truncate tracking-tight">{r.host}</h4>
                            <div className="mt-6 flex flex-wrap items-center gap-4">
                                <a href={`https://${r.host}`} target="_blank" className="text-[10px] font-black text-blue-600 uppercase flex items-center gap-2 hover:underline">
                                    <ExternalLink size={14} /> Verify Path
                                </a>
                                <div className="flex items-center gap-1 text-[10px] font-black text-emerald-600 uppercase">
                                    <ShieldCheck size={14} /> DNS Valid
                                </div>
                                <div className="flex items-center gap-1 text-[10px] font-black text-slate-300 uppercase">
                                    <Lock size={14} /> SSL Active
                                </div>
                            </div>
                        </div>
                    ))}
                    {(!t.domainRecords || t.domainRecords.length === 0) && (
                        <div className="col-span-full py-24 text-center border-4 border-dashed border-slate-50 rounded-[4rem] text-slate-300">
                            <Activity size={64} className="mx-auto mb-6 opacity-10" />
                            <p className="text-[11px] font-black uppercase tracking-[0.5em]">No active domains bound to this node</p>
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

      {/* Create/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white w-full max-w-2xl rounded-[3rem] shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-10 pt-10 pb-6 border-b border-slate-50 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-blue-600 text-white rounded-2xl shadow-xl">
                  {editingTenant ? <Edit size={24} /> : <Plus size={24} />}
                </div>
                <div>
                  <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tight leading-none">
                    {editingTenant ? 'Edit Cluster Node' : 'Deploy New Cluster'}
                  </h3>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                    {editingTenant ? `Cluster ID: ${editingTenant.id}` : 'Infrastructure Deployment'}
                  </p>
                </div>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="p-3 hover:bg-slate-100 rounded-full transition-all">
                <X size={24} className="text-slate-400" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-10 space-y-8 no-scrollbar">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">System Node Name (Slug)</label>
                  <input 
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-3.5 text-sm font-black outline-none focus:ring-2 focus:ring-blue-600 transition-all" 
                    value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} 
                    placeholder="Ex. arobazzar-main" 
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Display Shop Name</label>
                  <input 
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-3.5 text-sm font-black outline-none focus:ring-2 focus:ring-blue-600 transition-all" 
                    value={formData.shopName} onChange={e => setFormData({...formData, shopName: e.target.value})} 
                    placeholder="Ex. Aro Bazzar" 
                  />
                </div>
                <div className="md:col-span-2 space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2"><Server size={12}/> MongoDB Multi-Cluster URI</label>
                  <input 
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-3.5 text-xs font-mono font-bold text-blue-600 outline-none focus:ring-2 focus:ring-blue-600 transition-all" 
                    value={formData.mongoUri} onChange={e => setFormData({...formData, mongoUri: e.target.value})} 
                    placeholder="mongodb+srv://..." 
                  />
                </div>
                <div className="md:col-span-2 space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Logo URL (Icon)</label>
                  <input 
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-3.5 text-sm font-black outline-none focus:ring-2 focus:ring-blue-600 transition-all" 
                    value={formData.logoUrl} onChange={e => setFormData({...formData, logoUrl: e.target.value})} 
                    placeholder="https://..." 
                  />
                </div>
              </div>

              <div className="p-6 bg-slate-950 rounded-[2rem] border border-white/5 space-y-6">
                 <h4 className="text-[10px] font-black text-blue-400 uppercase tracking-widest flex items-center gap-2"><Key size={14}/> Super Admin Access Node</h4>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Admin Username/Email</label>
                      <input 
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm font-bold text-white outline-none focus:border-blue-500 transition-all" 
                        value={formData.adminEmail} onChange={e => setFormData({...formData, adminEmail: e.target.value})} 
                        placeholder="superadmin@email.com" 
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Initial Password</label>
                      <input 
                        type="password"
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm font-bold text-white outline-none focus:border-blue-500 transition-all" 
                        value={formData.adminPass} onChange={e => setFormData({...formData, adminPass: e.target.value})} 
                        placeholder="SecurePass123" 
                      />
                    </div>
                 </div>
              </div>
            </div>

            <div className="px-10 py-8 border-t border-slate-50 bg-slate-50 flex items-center justify-end gap-4">
               <button onClick={() => setIsModalOpen(false)} className="px-6 py-3 rounded-2xl text-[11px] font-black uppercase tracking-widest text-slate-500 hover:bg-slate-200 transition-all">Cancel</button>
               <button onClick={handleSaveCluster} className="px-10 py-4 bg-blue-600 text-white rounded-2xl font-black text-[11px] uppercase tracking-widest shadow-xl shadow-blue-500/20 hover:bg-blue-700 active:scale-95 transition-all flex items-center gap-2">
                 <Save size={16} /> {editingTenant ? 'Update Cluster' : 'Deploy Cluster'}
               </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
