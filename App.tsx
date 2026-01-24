
import React, { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { Dashboard } from './pages/Dashboard';
import { OrderDetail } from './pages/OrderDetail'; 
import { Stock } from './pages/Stock';
import { Returns } from './pages/Returns';
import { DevAdmin } from './pages/DevAdmin';
import { Settings } from './pages/Settings';
import { Team } from './pages/Team';
import { Leads } from './pages/Leads';
import { SellingPipeline } from './pages/SellingPipeline';
import { ShippingPipeline } from './pages/ShippingPipeline';
import { FinancialCenter } from './pages/FinancialCenter';
import { TodayShipped } from './pages/TodayShipped';
import { User, UserRole, Tenant } from './types';
import { db } from './services/mockBackend';
import { Lock, User as UserIcon, Menu, Globe, Shield } from 'lucide-react';

const LoginPage = ({ onLogin, branding }: { onLogin: (u: string, p: string) => Promise<void>, branding?: Tenant }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  
  const handleLoginClick = async () => {
    if (!username || !password) {
        alert('Please enter your credentials');
        return;
    }
    try {
      setLoading(true);
      await onLogin(username, password);
    } catch (e) {
      alert('Authentication failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  }

  const shopName = branding?.settings.shopName || 'Milky Way';
  const logoUrl = branding?.settings.logoUrl;

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f1f5f9] p-4 relative overflow-hidden">
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-500/10 rounded-full blur-[100px]"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-indigo-500/10 rounded-full blur-[100px]"></div>
      
      <div className="z-10 bg-white p-8 md:p-10 rounded-[2.5rem] shadow-2xl w-full max-w-sm border border-slate-100 animate-slide-in">
        <div className="flex flex-col items-center mb-10 text-center">
            {logoUrl ? (
                <img src={logoUrl} alt="Logo" className="w-16 h-16 rounded-2xl object-cover shadow-xl mb-5" />
            ) : (
                <div className="w-14 h-14 bg-blue-600 rounded-2xl flex items-center justify-center shadow-xl shadow-blue-200 mb-5">
                    <Globe className="text-white" size={28} />
                </div>
            )}
            <h1 className="text-2xl font-black text-slate-900 tracking-tighter uppercase leading-none">{shopName}</h1>
            <p className="text-[10px] font-black text-blue-600 uppercase tracking-[0.2em] mt-2">Enterprise OMS Engine</p>
        </div>
        
        <div className="space-y-4">
          <div className="bg-slate-50 rounded-2xl px-5 py-4 border border-slate-200 flex items-center gap-3 focus-within:ring-2 focus-within:ring-blue-500 transition-all">
            <UserIcon size={18} className="text-slate-400" />
            <input className="w-full bg-transparent text-slate-900 font-bold outline-none text-[13px]" value={username} onChange={e => setUsername(e.target.value)} placeholder="Username" />
          </div>
          <div className="bg-slate-50 rounded-2xl px-5 py-4 border border-slate-200 flex items-center gap-3 focus-within:ring-2 focus-within:ring-blue-500 transition-all">
            <Lock size={18} className="text-slate-400" />
            <input type="password" className="w-full bg-transparent text-slate-900 font-bold outline-none text-[13px]" value={password} onChange={e => setPassword(e.target.value)} placeholder="Password" />
          </div>
          <button onClick={handleLoginClick} disabled={loading} className="w-full bg-blue-600 text-white py-4 rounded-2xl font-black uppercase tracking-widest text-[11px] shadow-xl shadow-blue-200 hover:bg-blue-700 active:scale-95 transition-all disabled:opacity-50">
            {loading ? 'SYNCING...' : 'SIGN IN TO CLUSTER'}
          </button>
        </div>

        <div className="mt-10 text-center">
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.3em]">
                Authorized Entry Point
            </p>
        </div>
      </div>
    </div>
  );
};

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [tenant, setTenant] = useState<Tenant | null>(null); 
  const [brandedTenant, setBrandedTenant] = useState<Tenant | null>(null);
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const checkDomain = async () => {
        const tenants = await db.getTenants();
        const currentDomain = window.location.hostname;
        
        // Advanced lookup: check multiple domain records per tenant
        const match = tenants.find(t => 
            t.domain === currentDomain || 
            (t.domainRecords || []).some(r => r.host === currentDomain && r.isActive)
        );
        
        if (match) setBrandedTenant(match);
    };
    checkDomain();

    const saved = localStorage.getItem('mw_user');
    if (saved) {
        const u = JSON.parse(saved); 
        setUser(u);
        if (u.tenantId) db.getTenant(u.tenantId).then(t => t && setTenant(t));
        if (u.role === UserRole.DEV_ADMIN) setCurrentPage('dev_dashboard');
    }
  }, []);

  const handleLogin = async (u: string, p: string) => {
    const userObj = await db.login(u, p);
    if (userObj) {
      setUser(userObj);
      localStorage.setItem('mw_user', JSON.stringify(userObj));
      if (userObj.tenantId) db.getTenant(userObj.tenantId).then(t => t && setTenant(t));
      setCurrentPage(userObj.role === UserRole.DEV_ADMIN ? 'dev_dashboard' : 'dashboard');
    } else {
        throw new Error("Invalid credentials");
    }
  };

  if (!user) return <LoginPage onLogin={handleLogin} branding={brandedTenant || undefined} />;

  const renderPage = () => {
    if (user.role === UserRole.DEV_ADMIN) return <DevAdmin />;
    if (currentPage === 'order_detail' && selectedOrderId) return <OrderDetail orderId={selectedOrderId} tenantId={user.tenantId!} onBack={() => {setSelectedOrderId(null); setCurrentPage('selling');}} />;
    switch(currentPage) {
        case 'dashboard': return <Dashboard tenantId={user.tenantId!} />;
        case 'leads': return <Leads tenantId={user.tenantId!} />;
        case 'selling': return <SellingPipeline tenantId={user.tenantId!} onSelectOrder={(id) => { setSelectedOrderId(id); setCurrentPage('order_detail'); }} />;
        case 'shipping': return <ShippingPipeline tenantId={user.tenantId!} onSelectOrder={(id) => { setSelectedOrderId(id); setCurrentPage('order_detail'); }} />;
        case 'today_shipped': return <TodayShipped tenantId={user.tenantId!} />;
        case 'financials': return <FinancialCenter tenantId={user.tenantId!} />;
        case 'inventory': return <Stock tenantId={user.tenantId!} />;
        case 'returns': return <Returns tenantId={user.tenantId!} />;
        case 'settings': return <Settings tenantId={user.tenantId!} />;
        case 'team': return <Team tenantId={user.tenantId!} />;
        case 'dev_dashboard': return <DevAdmin />;
        case 'dev_tenants': return <DevAdmin />;
        default: return <Dashboard tenantId={user.tenantId!} />;
    }
  };

  const defaultTitle = user.role === UserRole.DEV_ADMIN ? 'Master Console' : 'Milky Way';
  const displayShopName = tenant?.settings.shopName || brandedTenant?.settings.shopName || defaultTitle;

  return (
    <div className="flex h-screen bg-[#f1f5f9] text-slate-900 overflow-hidden">
      <div className="no-print">
        <Sidebar 
            user={user} 
            shopName={displayShopName} 
            logoUrl={tenant?.settings.logoUrl || brandedTenant?.settings.logoUrl} 
            activePage={currentPage} 
            onNavigate={setCurrentPage}
            onLogout={() => { setUser(null); setTenant(null); localStorage.removeItem('mw_user'); }}
            isOpen={mobileMenuOpen} onClose={() => setMobileMenuOpen(false)}
        />
      </div>
      <main className="flex-1 overflow-auto relative p-4 no-scrollbar no-print">
         <div className="md:hidden flex items-center justify-between mb-4 px-2 py-3 bg-white rounded-2xl shadow-sm border border-slate-100">
            <button onClick={() => setMobileMenuOpen(true)} className="p-2 bg-slate-50 rounded-xl text-slate-600"><Menu size={18} /></button>
            <span className="font-black text-sm uppercase tracking-tighter">{displayShopName}</span>
            <div className="w-8"></div>
         </div>
         {renderPage()}
      </main>
    </div>
  );
}
