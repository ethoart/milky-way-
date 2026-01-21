import React, { useState, useEffect } from 'react';
import { db } from '../services/mockBackend';
import { User, UserRole } from '../types';
import { Plus, Trash2, UserPlus, Shield, Mail } from 'lucide-react';

interface TeamProps {
  tenantId: string;
}

export const Team: React.FC<TeamProps> = ({ tenantId }) => {
  const [users, setUsers] = useState<User[]>([]);
  const [newUsername, setNewUsername] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<UserRole>(UserRole.ADMIN);

  const load = async () => {
    setUsers(await db.getTeamMembers(tenantId));
  };

  useEffect(() => { load(); }, [tenantId]);

  const handleAdd = async () => {
      if(!newUsername || !newPassword) return;
      await db.addTeamMember(tenantId, newUsername, newRole, newEmail, newPassword);
      setNewUsername('');
      setNewEmail('');
      setNewPassword('');
      load();
  };

  const handleRemove = async (id: string) => {
      await db.removeTeamMember(id);
      load();
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8">
        <div>
            <h2 className="text-3xl font-bold text-black">Team Management</h2>
            <p className="text-gray-500">Manage access, passwords, and roles for your team.</p>
        </div>

        {/* Add New Member Card */}
        <div className="bg-white p-8 rounded-[2rem] border border-gray-200 shadow-sm">
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                <UserPlus size={20} /> Add New Member
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label className="text-xs font-bold text-gray-500 uppercase block mb-2">Username</label>
                    <input 
                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-black focus:ring-2 focus:ring-black outline-none"
                        value={newUsername}
                        onChange={e => setNewUsername(e.target.value)}
                        placeholder="john_doe"
                    />
                </div>
                <div>
                    <label className="text-xs font-bold text-gray-500 uppercase block mb-2">Email</label>
                    <input 
                        type="email"
                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-black focus:ring-2 focus:ring-black outline-none"
                        value={newEmail}
                        onChange={e => setNewEmail(e.target.value)}
                        placeholder="john@example.com"
                    />
                </div>
                <div>
                    <label className="text-xs font-bold text-gray-500 uppercase block mb-2">Password</label>
                    <input 
                        type="text"
                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-black focus:ring-2 focus:ring-black outline-none"
                        value={newPassword}
                        onChange={e => setNewPassword(e.target.value)}
                        placeholder="Set password"
                    />
                </div>
                <div>
                    <label className="text-xs font-bold text-gray-500 uppercase block mb-2">Role</label>
                    <select 
                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-black focus:ring-2 focus:ring-black outline-none appearance-none"
                        value={newRole}
                        onChange={e => setNewRole(e.target.value as UserRole)}
                    >
                        <option value={UserRole.ADMIN}>Admin (Staff)</option>
                        <option value={UserRole.SUPER_ADMIN}>Super Admin</option>
                    </select>
                </div>
            </div>
            <button onClick={handleAdd} className="mt-6 w-full bg-black text-white px-6 py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-gray-800 shadow-lg">
                <Plus size={18} /> Add User
            </button>
        </div>

        {/* User List */}
        <div className="space-y-4">
            {users.map(u => (
                <div key={u.id} className="bg-white p-6 rounded-2xl border border-gray-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <div className={`p-3 rounded-full ${u.role === UserRole.SUPER_ADMIN ? 'bg-purple-100 text-purple-600' : 'bg-gray-100 text-gray-600'}`}>
                            <Shield size={20} />
                        </div>
                        <div>
                            <p className="font-bold text-lg text-black">{u.username}</p>
                            <div className="flex items-center gap-2 text-sm text-gray-500">
                                {u.email && (
                                    <div className="flex items-center gap-1">
                                        <Mail size={12} />
                                        <span>{u.email}</span>
                                    </div>
                                )}
                                <span className="text-gray-300">|</span>
                                <span className="font-mono text-xs">ID: {u.id}</span>
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-end">
                        <span className={`px-3 py-1 rounded-full text-xs font-bold ${u.role === UserRole.SUPER_ADMIN ? 'bg-purple-50 text-purple-700' : 'bg-blue-50 text-blue-700'}`}>
                            {u.role.replace('_', ' ')}
                        </span>
                        {u.role !== UserRole.SUPER_ADMIN && (
                             <button onClick={() => handleRemove(u.id)} className="p-2 text-red-400 hover:bg-red-50 rounded-lg transition-colors">
                                <Trash2 size={18} />
                             </button>
                        )}
                    </div>
                </div>
            ))}
        </div>
    </div>
  );
};