
import React, { useState, useEffect } from 'react';
import { db } from '../services/mockBackend';
import { User, UserRole } from '../types';
import { Plus, Trash2, UserPlus, Shield, Mail, Key, ShieldCheck, CheckCircle2, Users } from 'lucide-react';

interface TeamProps {
  tenantId: string;
  shopName: string;
}

const AVAILABLE_PERMISSIONS = [
    { id: 'dashboard', label: 'Dashboard Access' },
    { id: 'leads', label: 'Inbound Leads' },
    { id: 'shipping', label: 'Logistics Access' },
    { id: 'today_shipped', label: 'Daily Logs' },
    { id: 'return_mgmt', label: 'Returns Hub' },
    { id: 'residual_mgmt', label: 'Residual Hub' },
    { id: 'financials', label: 'Financial Center' },
    { id: 'inventory', label: 'Inventory Control' },
    { id: 'returns', label: 'Milky Way Scan' }
];

export const Team: React.FC<TeamProps> = ({ tenantId, shopName }) => {
  const [users, setUsers] = useState<User[]>([]);
  const [newUsername, setNewUsername] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<UserRole>(UserRole.ADMIN);
  const [newPermissions, setNewPermissions] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  const load = async () => {
    setUsers(await db.getTeamMembers(tenantId));
  };

  useEffect(() => { load(); }, [tenantId]);

  const togglePermission = (id: string) => {
    setNewPermissions(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const handleAdd = async () => {
      if(!newUsername || !newPassword) return;
      setIsSaving(true);
      try {
        await db.addTeamMember(tenantId, newUsername, newRole, newEmail, newPassword, newPermissions);
        setNewUsername('');
        setNewEmail('');
        setNewPassword('');
        setNewPermissions([]);
        load();
      } finally {
        setIsSaving(false);
      }
  };

  const handleRemove = async (id: string) => {
      if (!confirm("Remove staff access?")) return;
      await db.removeTeamMember(id);
      load();
  };

  return (
    <div className="max-w-6xl mx-auto space-y-10 pb-20 animate-slide-in">
        <div className="flex items-center gap-4">
            <div className="p-4 bg-slate-900 text-white rounded-[1.5rem] shadow-xl">
                <Users size={32} />
            </div>
            <div>
                <h2 className="text-4xl font-black text-slate-900 tracking-tighter uppercase leading-none">{shopName} Team</h2>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2">Staff Access & Permissions Delegation</p>
            </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
            <div className="lg:col-span-8 space-y-8">
                <div className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-sm space-y-10">
                    <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter flex items-center gap-3">
                        <UserPlus size={24} className="text-blue-600"/> Provision New Staff
                    </h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Account Username</label>
                            <input 
                                className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-3.5 text-sm font-black outline-none focus:ring-2 focus:ring-blue-600 transition-all"
                                value={newUsername}
                                onChange={e => setNewUsername(e.target.value)}
                                placeholder="Ex. agent_01"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Staff Email</label>
                            <input 
                                type="email"
                                className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-3.5 text-sm font-black outline-none focus:ring-2 focus:ring-blue-600 transition-all"
                                value={newEmail}
                                onChange={e => setNewEmail(e.target.value)}
                                placeholder="staff@brand.com"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Login Password</label>
                            <div className="relative">
                                <Key size={16} className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input 
                                    type="text"
                                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-12 pr-5 py-3.5 text-sm font-black outline-none focus:ring-2 focus:ring-blue-600 transition-all"
                                    value={newPassword}
                                    onChange={e => setNewPassword(e.target.value)}
                                    placeholder="••••••••"
                                />
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Security Role</label>
                            <select 
                                className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-3.5 text-sm font-black outline-none appearance-none"
                                value={newRole}
                                onChange={e => setNewRole(e.target.value as UserRole)}
                            >
                                <option value={UserRole.ADMIN}>Admin (Staff)</option>
                                <option value={UserRole.SUPER_ADMIN}>Super Admin (Partner)</option>
                            </select>
                        </div>
                    </div>

                    <button onClick={handleAdd} disabled={isSaving} className="w-full bg-black text-white py-5 rounded-[2rem] font-black uppercase text-[11px] tracking-widest shadow-2xl hover:scale-105 active:scale-95 transition-all disabled:opacity-50">
                        {isSaving ? 'Synchronizing Node...' : 'Inject Team Member'}
                    </button>
                </div>
            </div>
        </div>
    </div>
  );
};
