
import React, { useState, useEffect } from 'react';
import { db } from '../services/mockBackend';
import { Tenant, TenantSettings } from '../types';
import { Save, Store, MapPin, Phone, Key, ShieldCheck, Truck, Link, Copy, CheckCircle2 } from 'lucide-react';

interface SettingsProps {
  tenantId: string;
}

export const Settings: React.FC<SettingsProps> = ({ tenantId }) => {
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [settings, setSettings] = useState<TenantSettings>({
      shopName: '', shopAddress: '', shopPhone: '', courierApiKey: '', courierApiUrl: '', courierClientId: ''
  });
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  const webhookUrl = `${window.location.origin}/.netlify/functions/api/courier-webhook`;

  useEffect(() => {
    const load = async () => {
        const t = await db.getTenant(tenantId);
        if (t) {
            setTenant(t);
            setSettings(t.settings);
        }
    };
    load();
  }, [tenantId]);

  const handleSave = async () => {
      setSaving(true);
      await db.updateTenantSettings(tenantId, settings);
      setSaving(false);
      alert("Milky Way: Global Settings Updated.");
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(webhookUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!tenant) return <div className="p-20 text-center font-black uppercase text-slate-300 tracking-[0.5em]">Loading Cluster Config...</div>;

  const Field = ({ label, icon, value, onChange, placeholder, type = "text" }: any) => (
      <div>
          <label className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase mb-2 tracking-widest">
              {icon} {label}
          </label>
          <input 
            type={type}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-900 font-bold focus:ring-2 focus:ring-blue-500 outline-none transition-all shadow-sm"
            value={value}
            onChange={e => onChange(e.target.value)}
            placeholder={placeholder}
          />
      </div>
  );

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-20">
        <div className="flex justify-between items-center">
            <div className="flex items-center gap-4">
                <div className="p-3 bg-blue-600 text-white rounded-2xl shadow-lg">
                    <ShieldCheck size={24} />
                </div>
                <div>
                    <h2 className="text-3xl font-black text-slate-900 tracking-tighter uppercase">Cluster Config</h2>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Global Milky Way OMS Parameters</p>
                </div>
            </div>
            <button 
                onClick={handleSave}
                disabled={saving}
                className="bg-black text-white px-10 py-4 rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl hover:scale-105 transition-all flex items-center gap-3 disabled:opacity-50"
            >
                <Save size={18} />
                {saving ? 'Syncing...' : 'Sync Config'}
            </button>
        </div>

        <div className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-sm space-y-12">
            {/* Courier Callback API Link Section */}
            <div>
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest mb-6 flex items-center gap-2">
                    <Link size={16} className="text-emerald-600"/> Courier Callback (Webhook)
                </h3>
                <div className="p-6 bg-emerald-50 rounded-3xl border border-emerald-100 space-y-4">
                    <p className="text-[11px] font-bold text-emerald-800 leading-relaxed uppercase tracking-tight">
                        Provide this URL to your courier partner (Fardar Express). They will use this endpoint to send automated status updates to your system.
                    </p>
                    <div className="flex items-center gap-2">
                        <div className="flex-1 bg-white border border-emerald-200 rounded-xl px-4 py-3 font-mono text-[11px] text-emerald-700 truncate shadow-inner">
                            {webhookUrl}
                        </div>
                        <button 
                            onClick={copyToClipboard}
                            className="bg-white border border-emerald-200 p-3 rounded-xl hover:bg-emerald-100 transition-colors text-emerald-600 shadow-sm flex items-center gap-2"
                        >
                            {copied ? <CheckCircle2 size={18} className="text-emerald-500" /> : <Copy size={18} />}
                            <span className="text-[10px] font-black uppercase">{copied ? 'Copied' : 'Copy'}</span>
                        </button>
                    </div>
                    <div className="grid grid-cols-3 gap-2 mt-2">
                        {['waybill_id', 'delivery_status', 'last_update_time'].map(param => (
                            <div key={param} className="bg-emerald-600/5 border border-emerald-600/10 px-3 py-1.5 rounded-lg text-center">
                                <span className="text-[8px] font-black text-emerald-600 uppercase tracking-tighter">{param}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            <div className="h-px bg-slate-100"></div>

            <div>
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest mb-8 flex items-center gap-2">
                    <Store size={16} className="text-blue-600"/> Merchant Identity
                </h3>
                <div className="grid md:grid-cols-2 gap-6">
                    <Field 
                        label="Official Shop Name" 
                        icon={<Store size={14} />} 
                        value={settings.shopName} 
                        onChange={(v: string) => setSettings({...settings, shopName: v})} 
                    />
                    <Field 
                        label="Merchant Hotline" 
                        icon={<Phone size={14} />} 
                        value={settings.shopPhone} 
                        onChange={(v: string) => setSettings({...settings, shopPhone: v})} 
                    />
                    <div className="md:col-span-2">
                        <Field 
                            label="Corporate HQ Address" 
                            icon={<MapPin size={14} />} 
                            value={settings.shopAddress} 
                            onChange={(v: string) => setSettings({...settings, shopAddress: v})} 
                        />
                    </div>
                </div>
            </div>

            <div>
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest mb-8 flex items-center gap-2">
                    <Truck size={16} className="text-indigo-600"/> Fardar Express Integration
                </h3>
                <div className="grid md:grid-cols-2 gap-6 p-6 bg-slate-50 rounded-[2rem] border border-slate-100">
                    <Field 
                        label="Courier Client ID" 
                        icon={<Key size={14} />} 
                        value={settings.courierClientId} 
                        onChange={(v: string) => setSettings({...settings, courierClientId: v})} 
                        placeholder="Ex. 1000"
                    />
                    <Field 
                        label="API Authorization Key" 
                        icon={<Key size={14} />} 
                        value={settings.courierApiKey} 
                        onChange={(v: string) => setSettings({...settings, courierApiKey: v})} 
                        placeholder="apkx...pykx"
                        type="password"
                    />
                     <div className="md:col-span-2">
                        <Field 
                            label="Gateway Endpoint" 
                            icon={<Key size={14} />} 
                            value={settings.courierApiUrl} 
                            onChange={(v: string) => setSettings({...settings, courierApiUrl: v})} 
                        />
                     </div>
                </div>
            </div>
        </div>
    </div>
  );
};
