
import React, { useState, useEffect } from 'react';
import { db } from '../services/mockBackend';
import { Tenant, TenantSettings, CourierMode } from '../types';
// Fixed missing Fingerprint import from lucide-react
import { Save, Store, MapPin, Phone, Key, ShieldCheck, Truck, Link, Copy, CheckCircle2, QrCode, Zap, Globe, AlertCircle, Fingerprint } from 'lucide-react';

interface SettingsProps {
  tenantId: string;
  shopName: string;
}

export const Settings: React.FC<SettingsProps> = ({ tenantId, shopName }) => {
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [settings, setSettings] = useState<TenantSettings>({
      shopName: '', 
      shopAddress: '', 
      shopPhone: '', 
      courierApiKey: '', 
      courierApiUrl: '', 
      courierClientId: '', 
      courierMode: CourierMode.STANDARD,
      showBillQr: true
  });
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  const webhookUrl = `${window.location.origin}/.netlify/functions/api/courier-webhook`;

  useEffect(() => {
    const load = async () => {
        const t = await db.getTenant(tenantId);
        if (t) {
            setTenant(t);
            setSettings({
                ...t.settings,
                courierMode: t.settings.courierMode || CourierMode.STANDARD,
                courierApiUrl: t.settings.courierApiUrl || 'https://www.fdedomestic.com/api/parcel/new_api_v1.php'
            });
        }
    };
    load();
  }, [tenantId]);

  const handleSave = async () => {
      setSaving(true);
      await db.updateTenantSettings(tenantId, settings);
      setSaving(false);
      alert(`${shopName}: Cluster Parameters Synchronized.`);
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(webhookUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!tenant) return <div className="p-20 text-center font-black uppercase text-slate-300 tracking-[0.5em]">Syncing Cluster Nodes...</div>;

  const Field = ({ label, icon, value, onChange, placeholder, type = "text", mono = false }: any) => (
      <div className="space-y-2">
          <label className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
              {icon} {label}
          </label>
          <input 
            type={type}
            className={`w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 text-slate-900 font-bold focus:ring-2 focus:ring-blue-600 outline-none transition-all shadow-sm ${mono ? 'font-mono text-xs' : 'text-[13px]'}`}
            value={value}
            onChange={e => onChange(e.target.value)}
            placeholder={placeholder}
          />
      </div>
  );

  return (
    <div className="max-w-5xl mx-auto space-y-10 pb-20 animate-slide-in">
        <div className="flex justify-between items-center px-2">
            <div className="flex items-center gap-4">
                <div className="p-3 bg-blue-600 text-white rounded-2xl shadow-xl">
                    <ShieldCheck size={28} />
                </div>
                <div>
                    <h2 className="text-4xl font-black text-slate-900 tracking-tighter uppercase">Cluster Configuration</h2>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{shopName} OMS Core Parameters</p>
                </div>
            </div>
            <button 
                onClick={handleSave}
                disabled={saving}
                className="bg-black text-white px-10 py-5 rounded-[2rem] font-black uppercase tracking-widest text-[11px] shadow-2xl hover:scale-105 active:scale-95 transition-all flex items-center gap-3 disabled:opacity-50"
            >
                {saving ? <Zap size={18} className="animate-spin" /> : <Save size={18} />}
                {saving ? 'SYNCING...' : 'SAVE CONFIG'}
            </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
            <div className="lg:col-span-7 space-y-10">
                {/* Logistics Gateway */}
                <div className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-sm space-y-10">
                    <div className="flex items-center justify-between border-b border-slate-50 pb-6">
                        <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight flex items-center gap-3">
                            <Truck size={24} className="text-indigo-600"/> Logistics Gateway
                        </h3>
                        <div className={`px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest border ${settings.courierApiKey ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-rose-50 text-rose-600 border-rose-100'}`}>
                            {settings.courierApiKey ? 'API ONLINE' : 'API DISCONNECTED'}
                        </div>
                    </div>

                    <div className="space-y-6">
                        <div className="bg-indigo-50 p-6 rounded-[2.5rem] border border-indigo-100 space-y-4">
                            <p className="text-[10px] font-black text-indigo-900 uppercase tracking-widest flex items-center gap-2">
                                <Zap size={14} /> Bridge Protocol Selection
                            </p>
                            <div className="grid grid-cols-2 gap-3">
                                <button 
                                    onClick={() => setSettings({...settings, courierMode: CourierMode.STANDARD})}
                                    className={`py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all ${settings.courierMode === CourierMode.STANDARD ? 'bg-indigo-600 text-white shadow-lg' : 'bg-white text-indigo-400 border border-indigo-100 hover:bg-indigo-100/50'}`}
                                >
                                    Standard API
                                </button>
                                <button 
                                    onClick={() => setSettings({...settings, courierMode: CourierMode.EXISTING_WAYBILL})}
                                    className={`py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all ${settings.courierMode === CourierMode.EXISTING_WAYBILL ? 'bg-indigo-600 text-white shadow-lg' : 'bg-white text-indigo-400 border border-indigo-100 hover:bg-indigo-100/50'}`}
                                >
                                    Existing Waybill
                                </button>
                            </div>
                            <p className="text-[9px] font-bold text-indigo-400 uppercase leading-relaxed text-center px-4">
                                {settings.courierMode === CourierMode.STANDARD 
                                    ? "Standard Mode: Milky Way communicates with courier to generate New Tracking IDs automatically." 
                                    : "Existing Mode: You scan pre-printed courier labels; Milky Way links them to the internal order."}
                            </p>
                        </div>

                        <div className="grid md:grid-cols-2 gap-6">
                            <Field 
                                label="Logistics API Key" 
                                icon={<Key size={14}/>} 
                                value={settings.courierApiKey} 
                                onChange={(v: string) => setSettings({...settings, courierApiKey: v})} 
                                placeholder="Fardar API Token"
                                type="password"
                            />
                            <Field 
                                label="Gateway Client ID" 
                                icon={<Fingerprint size={14}/>} 
                                value={settings.courierClientId} 
                                onChange={(v: string) => setSettings({...settings, courierClientId: v})} 
                                placeholder="Your CID"
                            />
                        </div>
                        <Field 
                            label="Gateway API URL" 
                            icon={<Globe size={14}/>} 
                            value={settings.courierApiUrl} 
                            onChange={(v: string) => setSettings({...settings, courierApiUrl: v})} 
                            placeholder="https://..."
                            mono
                        />
                    </div>
                </div>

                {/* Merchant Identity */}
                <div className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-sm space-y-8">
                    <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight flex items-center gap-3">
                        <Store size={24} className="text-blue-600"/> Merchant Identity
                    </h3>
                    <div className="grid md:grid-cols-2 gap-6">
                        <Field 
                            label="Official Brand Name" 
                            icon={<Store size={14} />} 
                            value={settings.shopName} 
                            onChange={(v: string) => setSettings({...settings, shopName: v})} 
                            placeholder="Store Name"
                        />
                        <Field 
                            label="Merchant Contact" 
                            icon={<Phone size={14} />} 
                            value={settings.shopPhone} 
                            onChange={(v: string) => setSettings({...settings, shopPhone: v})} 
                            placeholder="07xxxxxxxx"
                        />
                        <div className="md:col-span-2">
                            <Field 
                                label="Store Head Office Address" 
                                icon={<MapPin size={14} />} 
                                value={settings.shopAddress} 
                                onChange={(v: string) => setSettings({...settings, shopAddress: v})} 
                                placeholder="Full physical address"
                            />
                        </div>
                    </div>
                </div>
            </div>

            <div className="lg:col-span-5 space-y-10">
                {/* Webhook Management */}
                <div className="bg-slate-950 text-white p-10 rounded-[3rem] shadow-2xl space-y-8 border border-white/5">
                    <h3 className="text-sm font-black uppercase tracking-widest flex items-center gap-3">
                        <Link size={20} className="text-emerald-400"/> Courier Callback
                    </h3>
                    <div className="p-6 bg-emerald-500/10 rounded-[2rem] border border-emerald-500/20 space-y-6">
                        <div className="flex items-start gap-4">
                            <AlertCircle size={20} className="text-emerald-400 shrink-0 mt-1" />
                            <p className="text-[10px] font-bold text-emerald-100 uppercase leading-relaxed tracking-tight">
                                Provide this endpoint to your courier partner's IT department. Status updates (Delivered/Returned) will sync instantly to your terminal.
                            </p>
                        </div>
                        <div className="space-y-2">
                            <div className="bg-black/50 border border-white/10 rounded-xl px-4 py-4 font-mono text-[10px] text-emerald-300 break-all select-all">
                                {webhookUrl}
                            </div>
                            <button 
                                onClick={copyToClipboard}
                                className="w-full bg-white text-black py-3 rounded-xl font-black uppercase text-[10px] tracking-widest flex items-center justify-center gap-2 hover:bg-emerald-50 transition-all active:scale-95"
                            >
                                {copied ? <CheckCircle2 size={16} className="text-emerald-600" /> : <Copy size={16} />}
                                {copied ? 'ENDPOINT COPIED' : 'COPY CALLBACK URL'}
                            </button>
                        </div>
                    </div>
                </div>

                {/* UI Protocols */}
                <div className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-sm space-y-8">
                    <h3 className="text-sm font-black uppercase tracking-widest flex items-center gap-3">
                        <QrCode size={20} className="text-blue-600"/> UI Protocols
                    </h3>
                    <div className="flex items-center justify-between p-6 bg-slate-50 rounded-[2rem] border border-slate-100">
                        <div className="flex-1">
                            <p className="text-xs font-black text-slate-900 uppercase tracking-tight">Generate Bill QR</p>
                            <p className="text-[10px] font-bold text-slate-400 uppercase mt-1">Embed ID tracking into physical labels</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input 
                                type="checkbox" 
                                className="sr-only peer" 
                                checked={settings.showBillQr}
                                onChange={(e) => setSettings({...settings, showBillQr: e.target.checked})}
                            />
                            <div className="w-14 h-7 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-blue-600"></div>
                        </label>
                    </div>
                </div>
            </div>
        </div>
    </div>
  );
};
