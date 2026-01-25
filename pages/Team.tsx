
import React, { useState, useEffect } from 'react';
import { db } from '../services/mockBackend';
import { User, UserRole } from '../types';
// Fixed missing 'Users' import from lucide-react
import { Plus, Trash2, UserPlus, Shield, Mail, Key, ShieldCheck, CheckCircle2, Users } from 'lucide-react';

interface TeamProps {
  tenantId: string;
}

const AVAILABLE_PERMISSIONS = [
    { id: 'dashboard', label: 'Dashboard Access' },
    { id: 'leads', label: 'Inbound Leads' },
    { id: 'shipping', label: 'Logistics Access' },
    { id: 'today_shipped', label: 'Daily Logs' },
    { id: 'financials', label: 'Financial Center' },
    { id: 'inventory', label: 'Inventory Control' },
    { id: 'returns', label: 'Milky Way Scan' }
];

export const Team: React.FC<TeamProps> = ({ tenantId }) => {
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
                <h2 className="text-4xl font-black text-slate-900 tracking-tighter uppercase leading-none">Team Cluster</h2>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2">Staff Access & Permissions Delegation</p>
            </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
            {/* User Addition */}
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

                    {newRole === UserRole.ADMIN && (
                        <div className="space-y-6 pt-6 border-t border-slate-50">
                            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Section Permissions (Admin Role Only)</h4>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                {AVAILABLE_PERMISSIONS.map(perm => (
                                    <button 
                                        key={perm.id} 
                                        onClick={() => togglePermission(perm.id)}
                                        className={`flex items-center gap-2 px-4 py-3 rounded-xl text-[10px] font-black uppercase tracking-tight transition-all border ${newPermissions.includes(perm.id) ? 'bg-blue-600 text-white border-blue-600 shadow-lg' : 'bg-slate-50 text-slate-400 border-slate-200 hover:border-slate-300'}`}
                                    >
                                        {newPermissions.includes(perm.id) ? <CheckCircle2 size={14}/> : <ShieldCheck size={14} className="opacity-20"/>}
                                        {perm.label}
                                    </button>
                                ))}
                            </div>
                            <p className="text-[9px] font-bold text-slate-400 italic">Note: The "Selling" section is granted by default to all Admin roles.</p>
                        </div>
                    )}

                    <button onClick={handleAdd} disabled={isSaving} className="w-full bg-black text-white py-5 rounded-[2rem] font-black uppercase text-[11px] tracking-widest shadow-2xl hover:scale-105 active:scale-95 transition-all disabled:opacity-50">
                        {isSaving ? 'Synchronizing Node...' : 'Inject Team Member'}
                    </button>
                </div>
            </div>

            {/* Account List */}
            <div className="lg:col-span-4 space-y-4">
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2 mb-4">Active Staff Grid</h3>
                {users.map(u => (
                    <div key={u.id} className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex flex-col gap-4 group hover:shadow-xl transition-all">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${u.role === UserRole.SUPER_ADMIN ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-400'}`}>
                                    <Shield size={24} />
                                </div>
                                <div>
                                    <p className="text-lg font-black text-slate-900 uppercase leading-none">{u.username}</p>
                                    <p className="text-[9px] font-black text-blue-600 uppercase tracking-widest mt-1">{u.role.replace('_', ' ')}</p>
                                </div>
                            </div>
                            {u.role !== UserRole.SUPER_ADMIN && (
                                 <button onClick={() => handleRemove(u.id)} className="p-3 text-slate-300 hover:text-rose-600 bg-slate-50 rounded-xl transition-all opacity-0 group-hover:opacity-100">
                                    <Trash2 size={18} />
                                 </button>
                            )}
                        </div>
                        {u.role === UserRole.ADMIN && (
                            <div className="flex flex-wrap gap-1.5 pt-3 border-t border-slate-50">
                                <span className="px-2 py-1 bg-emerald-50 text-emerald-600 rounded-md text-[8px] font-black uppercase">Selling (Default)</span>
                                {u.permissions?.map(p => (
                                    <span key={p} className="px-2 py-1 bg-blue-50 text-blue-600 rounded-md text-[8px] font-black uppercase">{p.replace('_', ' ')}</span>
                                ))}
                                {(!u.permissions || u.permissions.length === 0) && (
                                    <span className="text-[8px] font-bold text-slate-300 uppercase italic">Limited Access Only</span>
                                )}
                            </div>
                        )}
                        <div className="flex items-center gap-2 text-[10px] text-slate-400 font-bold px-2">
                             <Mail size={12}/> {u.email}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    </div>
  );
};
