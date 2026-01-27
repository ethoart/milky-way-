
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { db } from '../services/mockBackend';
import { Order, OrderStatus, OrderLog, Product, Tenant, CourierMode } from '../types';
import { 
  ArrowLeft, Truck, Check, Clock, User as UserIcon, Save, 
  Activity, MapPin, Package, Trash2, Plus, Printer, RefreshCcw, MessageSquare, Zap, Calendar, ShoppingBag, DollarSign, Search, ChevronDown, X
} from 'lucide-react';
import { formatCurrency } from '../utils/helpers';
import { LabelPrintView } from '../components/LabelPrintView';
import { createPortal } from 'react-dom';

const SRI_LANKA_CITIES_FALLBACK = [
  "Colombo", "Gampaha", "Kalutara", "Kandy", "Matale", "Nuwara Eliya", "Galle", "Matara", "Hambantota", 
  "Jaffna", "Kilinochchi", "Mannar", "Vavuniya", "Mullaitivu", "Batticaloa", "Ampara", "Trincomalee", 
  "Kurunegala", "Puttalam", "Anuradhapura", "Polonnaruwa", "Badulla", "Monaragala", "Ratnapura", "Kegalle",
  "Dehiwala-Mount Lavinia", "Moratuwa", "Negombo", "Sri Jayawardenepura Kotte", "Kaduwela", "Kolonnawa", 
  "Chilaw", "Wattala", "Welisara", "Ja-Ela", "Paliyagoda", "Gampola", "Nawalapitiya", "Haputale"
].sort();

interface OrderDetailProps {
  orderId: string;
  tenantId: string;
  onBack: () => void;
}

export const OrderDetail: React.FC<OrderDetailProps> = ({ orderId, tenantId, onBack }) => {
  const [order, setOrder] = useState<Order | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [cities, setCities] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [shippingLoading, setShippingLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [callNote, setCallNote] = useState('');
  const [showPrintPortal, setShowPrintPortal] = useState(false);

  // City Search States
  const [citySearch, setCitySearch] = useState('');
  const [showCityDropdown, setShowCityDropdown] = useState(false);
  const cityDropdownRef = useRef<HTMLDivElement>(null);

  const [localFormData, setLocalFormData] = useState({ 
    customerName: '', 
    customerPhone: '', 
    customerAddress: '', 
    customerCity: '', 
    parcelWeight: '1', 
    parcelDescription: '',
    trackingNumber: '',
    createdAt: ''
  });
  
  const [items, setItems] = useState<{ productId: string; quantity: number; price: number; name: string }[]>([]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [data, fetchedProducts, fetchedTenant, fetchedCities] = await Promise.all([
        db.getOrder(orderId, tenantId),
        db.getProducts(tenantId),
        db.getTenant(tenantId),
        db.getGlobalCities()
      ]);
      
      const cityList = fetchedCities.length > 0 ? fetchedCities : SRI_LANKA_CITIES_FALLBACK;
      setCities(cityList);

      if (data) {
        setOrder(data);
        setProducts(fetchedProducts);
        setTenant(fetchedTenant || null);
        const initialCity = data.customerCity || (cityList.includes('Colombo') ? 'Colombo' : cityList[0]);
        setLocalFormData({ 
          customerName: data.customerName || '', 
          customerPhone: data.customerPhone || '', 
          customerAddress: data.customerAddress || '', 
          customerCity: initialCity, 
          parcelWeight: data.parcelWeight || '1', 
          parcelDescription: data.parcelDescription || '',
          trackingNumber: data.trackingNumber || '',
          createdAt: data.createdAt ? new Date(data.createdAt).toISOString().slice(0, 16) : ''
        });
        setCitySearch(initialCity);
        setItems(data.items || []);
      }
    } finally {
      setLoading(false);
    }
  }, [orderId, tenantId]);

  useEffect(() => { loadData(); }, [loadData]);

  // Handle clicks outside city dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (cityDropdownRef.current && !cityDropdownRef.current.contains(event.target as Node)) {
        setShowCityDropdown(false);
        // Reset search to current selection if closed without selecting
        setCitySearch(localFormData.customerCity);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [localFormData.customerCity]);

  const filteredCities = useMemo(() => {
    if (!citySearch) return cities;
    return cities.filter(c => c.toLowerCase().includes(citySearch.toLowerCase()));
  }, [cities, citySearch]);

  const totalAmount = useMemo(() => {
    return items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  }, [items]);

  const handlePrintBill = () => {
    setShowPrintPortal(true);
    setTimeout(() => {
      window.print();
      setShowPrintPortal(false);
    }, 500);
  };

  const handleAddCallNote = async () => {
    if (!order || !callNote.trim()) return;
    const user = localStorage.getItem('mw_user') ? JSON.parse(localStorage.getItem('mw_user')!).username : 'System';
    const log: OrderLog = { 
      id: `call-${Date.now()}`, 
      message: `CALL NOTE: ${callNote}`, 
      timestamp: new Date().toISOString(), 
      user 
    };
    await db.updateOrder({ ...order, logs: [...(order.logs || []), log] });
    setCallNote('');
    loadData();
  };

  const handleItemChange = (index: number, field: string, value: any) => {
    const newItems = [...items];
    if (field === 'productId') {
        const prod = products.find(p => p.id === value);
        if (prod) {
            newItems[index] = { ...newItems[index], productId: value, name: prod.name, price: prod.price };
        }
    } else {
        newItems[index] = { ...newItems[index], [field]: value };
    }
    setItems(newItems);
  };

  const addItem = () => {
    if (products.length > 0) {
        setItems([...items, { productId: products[0].id, name: products[0].name, price: products[0].price, quantity: 1 }]);
    }
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const updateStatus = async (newStatus: OrderStatus) => {
    if (!order) return;
    
    if (newStatus === OrderStatus.CONFIRMED) {
      if (!localFormData.customerPhone || localFormData.customerPhone.trim().length < 9) return alert("Valid Phone Number Required.");
      if (items.length === 0) return alert("Product manifest cannot be empty.");
    }

    if (newStatus === OrderStatus.SHIPPED) {
      if (tenant?.settings.courierMode === CourierMode.EXISTING_WAYBILL && !localFormData.trackingNumber) {
          return alert("Existing Waybill ID is required to dispatch.");
      }
      setShippingLoading(true);
      try { 
        await db.shipOrder({ ...order, ...localFormData, items, totalAmount }, tenantId);
        loadData();
      } catch (e: any) { alert(e.message); } 
      finally { setShippingLoading(false); }
      return;
    }

    const log: OrderLog = { 
      id: `l-${Date.now()}`, 
      message: `Status Changed to ${newStatus}`, 
      timestamp: new Date().toISOString(), 
      user: localStorage.getItem('mw_user') ? JSON.parse(localStorage.getItem('mw_user')!).username : 'System'
    };
    
    setIsSaving(true);
    await db.updateOrder({ ...order, ...localFormData, items, totalAmount, status: newStatus, logs: [...(order.logs || []), log] });
    setIsSaving(false);
    loadData();
  };

  const getBtnColor = (status: OrderStatus) => {
    if (order?.status === status) {
        switch(status) {
          case OrderStatus.PENDING: return 'bg-blue-600 text-white shadow-lg';
          case OrderStatus.OPEN_LEAD: return 'bg-sky-400 text-white shadow-lg';
          case OrderStatus.CONFIRMED: return 'bg-emerald-600 text-white shadow-lg';
          case OrderStatus.HOLD: return 'bg-purple-600 text-white shadow-lg';
          case OrderStatus.NO_ANSWER: return 'bg-yellow-500 text-white shadow-lg';
          case OrderStatus.REJECTED: return 'bg-rose-600 text-white shadow-lg';
          case OrderStatus.RESIDUAL: return 'bg-slate-900 text-white shadow-lg';
          case OrderStatus.REARRANGE: return 'bg-indigo-600 text-white shadow-lg';
          default: return 'bg-blue-600 text-white shadow-lg';
        }
    }
    return 'bg-slate-50 text-slate-400 hover:text-slate-600';
  };

  if (loading || !order) return <div className="p-20 text-center font-black uppercase text-slate-300 text-xs tracking-widest">Synchronizing Node...</div>;

  const isExistingMode = tenant?.settings.courierMode === CourierMode.EXISTING_WAYBILL;

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-20 animate-slide-in no-print">
        {/* Header Controls */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
                <button onClick={onBack} className="p-4 bg-white border border-slate-100 rounded-3xl text-black shadow-sm hover:bg-slate-50 transition-all active:scale-90"><ArrowLeft size={20} /></button>
                <div>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight uppercase leading-none">Lead Terminal #{order.id.slice(-6)}</h1>
                    <div className="text-[10px] font-black text-blue-600 uppercase tracking-widest mt-2">Current State: {order.status} • Value: {formatCurrency(totalAmount)}</div>
                </div>
            </div>
            <div className="flex gap-2">
                <button 
                    onClick={handlePrintBill}
                    className="bg-white border border-slate-200 text-slate-900 px-6 py-4 rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-sm flex items-center gap-3 hover:bg-slate-50 transition-all active:scale-95"
                >
                    <Printer size={16} /> Print 2x3 Grid
                </button>
                <button onClick={async () => {
                    setIsSaving(true);
                    await db.updateOrder({ ...order, ...localFormData, items, totalAmount });
                    setIsSaving(false);
                    alert("Lead synchronization complete.");
                }} className="bg-black text-white px-8 py-4 rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-xl flex items-center gap-3 active:scale-95 transition-all">
                    {isSaving ? <RefreshCcw size={16} className="animate-spin" /> : <Save size={16} />} Force Save
                </button>
            </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-8">
                {/* Command Deck */}
                <div className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-sm space-y-6">
                    <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><Activity size={16}/> Pipeline Command</h3>
                    
                    {isExistingMode && (
                        <div className="bg-indigo-50 border border-indigo-100 p-6 rounded-[2rem] space-y-3 mb-4">
                            <p className="text-[10px] font-black text-indigo-600 uppercase tracking-widest flex items-center gap-2">
                                <Search size={14} /> Waybill ID Search & Assign
                            </p>
                            <div className="relative">
                                <input 
                                    className="w-full bg-white border-2 border-indigo-200 rounded-xl px-4 py-3 font-mono font-black text-slate-900 outline-none focus:border-indigo-600 shadow-sm"
                                    value={localFormData.trackingNumber}
                                    onChange={e => setLocalFormData({...localFormData, trackingNumber: e.target.value})}
                                    placeholder="Enter or Scan Fardar Waybill..."
                                />
                                <div className="absolute right-4 top-1/2 -translate-y-1/2 text-indigo-300">
                                    <Truck size={18} />
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="flex flex-wrap gap-2">
                        {[OrderStatus.OPEN_LEAD, OrderStatus.HOLD, OrderStatus.NO_ANSWER, OrderStatus.REJECTED, OrderStatus.RESIDUAL, OrderStatus.REARRANGE].map(s => (
                           <button key={s} onClick={() => updateStatus(s)} className={`px-5 py-3 rounded-2xl font-black text-[10px] uppercase transition-all ${getBtnColor(s)}`}>{s.replace('_', ' ')}</button>
                        ))}
                        <button onClick={() => updateStatus(OrderStatus.CONFIRMED)} className={`px-8 py-3 rounded-2xl font-black text-[10px] uppercase shadow-xl transition-all ${order.status === OrderStatus.CONFIRMED ? 'bg-emerald-600 text-white' : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'}`}>Confirm Order</button>
                        {(order.status === OrderStatus.CONFIRMED || order.status === OrderStatus.SHIPPED) && (
                             <button onClick={() => updateStatus(OrderStatus.SHIPPED)} disabled={shippingLoading} className="bg-slate-900 text-white px-10 py-4 rounded-2xl font-black text-[11px] uppercase flex items-center gap-3 hover:bg-black transition-all shadow-2xl">
                                <Truck size={20} className="text-blue-400" /> {shippingLoading ? 'SYNCING API...' : 'Handover to Fardar'}
                             </button>
                        )}
                    </div>
                </div>

                {/* Identity Deck */}
                <div className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-sm space-y-8">
                    <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><UserIcon size={16}/> Consignee Identity Deck</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-1.5">
                          <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Full Legal Name</label>
                          <input 
                            className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-3.5 font-bold text-slate-900 outline-none focus:ring-2 focus:ring-blue-500 transition-all shadow-sm" 
                            value={localFormData.customerName} 
                            onChange={e => setLocalFormData({...localFormData, customerName: e.target.value})} 
                            placeholder="Type Consignee Name..." 
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Contact Handset No</label>
                          <input 
                            className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-3.5 font-bold text-slate-900 outline-none focus:ring-2 focus:ring-blue-500 transition-all shadow-sm" 
                            value={localFormData.customerPhone} 
                            onChange={e => setLocalFormData({...localFormData, customerPhone: e.target.value})} 
                            placeholder="077xxxxxxx" 
                          />
                        </div>
                        <div className="space-y-1.5 md:col-span-2">
                          <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Physical Delivery Address</label>
                          <textarea 
                            className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 font-bold text-slate-900 outline-none min-h-[100px] focus:ring-2 focus:ring-blue-500 transition-all shadow-sm" 
                            value={localFormData.customerAddress} 
                            onChange={e => setLocalFormData({...localFormData, customerAddress: e.target.value})} 
                            placeholder="Detailed Street Address..." 
                          />
                        </div>
                        
                        {/* Searchable City Selector */}
                        <div className="space-y-1.5 relative" ref={cityDropdownRef}>
                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Target Distribution City</label>
                            <div className="relative">
                                <input 
                                    type="text"
                                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-3.5 font-bold text-slate-900 outline-none focus:ring-2 focus:ring-blue-500 transition-all shadow-sm pr-10"
                                    value={citySearch}
                                    onFocus={() => { setShowCityDropdown(true); setCitySearch(''); }}
                                    onChange={(e) => { setCitySearch(e.target.value); setShowCityDropdown(true); }}
                                    placeholder="Search & Select City..."
                                />
                                <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2">
                                  {citySearch !== localFormData.customerCity && citySearch !== '' && (
                                    <X size={14} className="text-slate-300 cursor-pointer hover:text-rose-500" onClick={() => { setCitySearch(localFormData.customerCity); setShowCityDropdown(false); }} />
                                  )}
                                  <ChevronDown size={16} className={`text-slate-400 transition-transform ${showCityDropdown ? 'rotate-180' : ''}`} />
                                </div>
                            </div>
                            
                            {showCityDropdown && (
                              <div className="absolute z-[100] left-0 right-0 mt-2 bg-white border border-slate-100 rounded-[1.5rem] shadow-2xl max-h-[300px] overflow-y-auto no-scrollbar animate-slide-in">
                                {filteredCities.length > 0 ? (
                                  filteredCities.map((city) => (
                                    <div 
                                      key={city} 
                                      className={`px-6 py-3.5 text-xs font-black uppercase cursor-pointer hover:bg-slate-50 transition-colors flex items-center justify-between ${localFormData.customerCity === city ? 'bg-blue-50 text-blue-600' : 'text-slate-700'}`}
                                      onClick={() => {
                                        setLocalFormData({...localFormData, customerCity: city});
                                        setCitySearch(city);
                                        setShowCityDropdown(false);
                                      }}
                                    >
                                      {city}
                                      {localFormData.customerCity === city && <Check size={14} />}
                                    </div>
                                  ))
                                ) : (
                                  <div className="px-6 py-8 text-center">
                                    <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">No matching regions</p>
                                    <button 
                                      onClick={() => {
                                        const customCity = citySearch.trim();
                                        if (customCity) {
                                          setLocalFormData({...localFormData, customerCity: customCity});
                                          setCitySearch(customCity);
                                          setShowCityDropdown(false);
                                        }
                                      }}
                                      className="mt-3 text-[10px] font-black text-blue-600 uppercase underline"
                                    >
                                      Use "{citySearch}" anyway
                                    </button>
                                  </div>
                                )}
                              </div>
                            )}
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Arrival Timestamp</label>
                            <div className="relative">
                                <input 
                                    type="datetime-local"
                                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-3.5 font-bold text-slate-900 outline-none shadow-sm"
                                    value={localFormData.createdAt}
                                    onChange={e => setLocalFormData({...localFormData, createdAt: e.target.value})}
                                />
                                <Calendar size={16} className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Inventory Deck */}
                <div className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-sm space-y-8">
                    <div className="flex items-center justify-between">
                        <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><ShoppingBag size={16}/> Product Manifest</h3>
                        <button onClick={addItem} className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-100 transition-all">
                            <Plus size={14}/> Add SKU
                        </button>
                    </div>
                    
                    <div className="space-y-4">
                        {items.map((item, idx) => (
                            <div key={idx} className="p-6 bg-slate-50 rounded-[2rem] border border-slate-200 grid grid-cols-1 md:grid-cols-12 gap-4 items-end animate-slide-in">
                                <div className="md:col-span-6 space-y-1.5">
                                    <label className="text-[8px] font-black text-slate-400 uppercase ml-1">SKU Identity</label>
                                    <select 
                                        className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 font-bold text-xs shadow-sm"
                                        value={item.productId}
                                        onChange={(e) => handleItemChange(idx, 'productId', e.target.value)}
                                    >
                                        {products.map(p => <option key={p.id} value={p.id}>{p.sku} - {p.name}</option>)}
                                    </select>
                                </div>
                                <div className="md:col-span-2 space-y-1.5">
                                    <label className="text-[8px] font-black text-slate-400 uppercase ml-1">Units</label>
                                    <input 
                                        type="number"
                                        className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 font-bold text-xs shadow-sm"
                                        value={item.quantity}
                                        onChange={(e) => handleItemChange(idx, 'quantity', parseInt(e.target.value) || 1)}
                                    />
                                </div>
                                <div className="md:col-span-3 space-y-1.5">
                                    <label className="text-[8px] font-black text-slate-400 uppercase ml-1">Unit Price (LKR)</label>
                                    <div className="relative">
                                        <input 
                                            type="number"
                                            className="w-full bg-white border border-slate-200 rounded-xl pl-8 pr-4 py-2.5 font-bold text-xs shadow-sm"
                                            value={item.price}
                                            onChange={(e) => handleItemChange(idx, 'price', parseFloat(e.target.value) || 0)}
                                        />
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-[9px]">Rs.</span>
                                    </div>
                                </div>
                                <div className="md:col-span-1 flex justify-center pb-2">
                                    <button onClick={() => removeItem(idx)} className="text-slate-300 hover:text-rose-500 transition-colors p-2"><Trash2 size={18}/></button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            <div className="space-y-8">
                 {/* Internal Notes */}
                 <div className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-sm space-y-6">
                    <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><MessageSquare size={16}/> Interaction Registry</h3>
                    <div className="space-y-4">
                        <textarea 
                            value={callNote}
                            onChange={e => setCallNote(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-[13px] font-bold outline-none focus:ring-2 focus:ring-blue-500 h-24 shadow-inner"
                            placeholder="Commit feedback or call log..."
                        />
                        <button onClick={handleAddCallNote} className="w-full bg-blue-600 text-white py-3 rounded-xl font-black text-[10px] uppercase shadow-lg hover:bg-blue-700 active:scale-95 transition-all">Log Note</button>
                    </div>
                 </div>

                 {/* Financial Summary */}
                 <div className="bg-slate-950 text-white p-10 rounded-[3rem] shadow-2xl border border-white/5 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-blue-600 rounded-full blur-[80px] opacity-20"></div>
                    <div className="relative z-10">
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 flex items-center gap-2"><DollarSign size={12}/> Net Payable Amount</p>
                        <h2 className="text-4xl font-black tracking-tighter">{formatCurrency(totalAmount)}</h2>
                        
                        {(order.trackingNumber || localFormData.trackingNumber) && (
                            <div className="mt-8 pt-8 border-t border-white/10 space-y-1">
                                <p className="text-[9px] font-black text-blue-400 uppercase tracking-widest">Handshake ID</p>
                                <p className="text-xl font-mono font-black">{order.trackingNumber || localFormData.trackingNumber}</p>
                                {order.courierStatus && (
                                    <p className="text-[8px] font-black text-emerald-400 uppercase mt-1">Status: {order.courierStatus}</p>
                                )}
                            </div>
                        )}

                        <div className="mt-8 grid grid-cols-2 gap-4">
                            <div className="bg-white/5 p-4 rounded-2xl border border-white/10">
                                <p className="text-[8px] font-black text-slate-500 uppercase mb-1">SKU Count</p>
                                <p className="text-lg font-black">{items.length}</p>
                            </div>
                            <div className="bg-white/5 p-4 rounded-2xl border border-white/10">
                                <p className="text-[8px] font-black text-slate-500 uppercase mb-1">Scale Mass</p>
                                <p className="text-lg font-black">{localFormData.parcelWeight} KG</p>
                            </div>
                        </div>
                    </div>
                 </div>

                 {/* History Registry */}
                 {order.logs && order.logs.length > 0 && (
                   <div className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-sm space-y-6">
                      <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><RefreshCcw size={16}/> Node Audit Trail</h3>
                      <div className="space-y-4 max-h-[350px] overflow-y-auto pr-2 no-scrollbar">
                         {order.logs.slice().reverse().map(log => (
                            <div key={log.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex justify-between items-start gap-4 hover:bg-white transition-colors">
                               <div>
                                  <p className="text-[11px] font-black text-slate-900 uppercase leading-tight">{log.message}</p>
                                  <p className="text-[8px] font-bold text-slate-400 uppercase mt-1">Handled By: {log.user}</p>
                               </div>
                               <span className="text-[8px] font-mono text-slate-300 whitespace-nowrap">{new Date(log.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                            </div>
                         ))}
                      </div>
                   </div>
                )}
            </div>
        </div>

        {/* Print Portal */}
        {showPrintPortal && tenant && (
          createPortal(
            <div className="print-only">
               <LabelPrintView orders={[{...order, ...localFormData, items, totalAmount}]} settings={tenant.settings} />
            </div>,
            document.body
          )
        )}
    </div>
  );
};
