import React, { useState, useEffect } from 'react';
import { db } from '../services/mockBackend';
import { Product } from '../types';
import { Plus, Trash2, Save, Package } from 'lucide-react';
import { formatCurrency } from '../utils/helpers';

interface StockProps {
  tenantId: string;
}

export const Stock: React.FC<StockProps> = ({ tenantId }) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  // New Product Form State
  const [newProd, setNewProd] = useState({ name: '', sku: '', price: 0, buyingPrice: 0, stock: 0 });

  const load = async () => {
    const data = await db.getProducts(tenantId);
    setProducts(data);
  };

  useEffect(() => { load(); }, [tenantId]);

  const handleAdd = async () => {
    if (!newProd.name || !newProd.sku) return;
    const p: Product = {
      id: `p-${Date.now()}`,
      tenantId,
      ...newProd
    };
    await db.updateProduct(p);
    setNewProd({ name: '', sku: '', price: 0, buyingPrice: 0, stock: 0 });
    load();
  };

  const handleUpdate = async (product: Product) => {
    await db.updateProduct(product);
    setEditingId(null);
    load();
  };

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      <div className="flex items-center gap-4">
          <div className="p-3 bg-black text-white rounded-2xl">
              <Package size={24} />
          </div>
          <div>
            <h2 className="text-2xl md:text-3xl font-bold text-black">Inventory</h2>
            <p className="text-gray-500">Manage products, stock levels, and costs.</p>
          </div>
      </div>

      {/* Add New */}
      <div className="bg-white p-6 rounded-3xl border border-gray-200 shadow-sm flex flex-col md:flex-row flex-wrap gap-4 md:items-end">
        <div>
           <label className="text-xs font-bold text-gray-500 uppercase block mb-2">SKU</label>
           <input className="w-full md:w-32 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-black focus:ring-2 focus:ring-black outline-none" 
                  value={newProd.sku} onChange={e => setNewProd({...newProd, sku: e.target.value})} placeholder="SKU" />
        </div>
        <div className="flex-1">
           <label className="text-xs font-bold text-gray-500 uppercase block mb-2">Product Name</label>
           <input className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-black focus:ring-2 focus:ring-black outline-none" 
                  value={newProd.name} onChange={e => setNewProd({...newProd, name: e.target.value})} placeholder="Item Name" />
        </div>
        <div className="flex gap-4">
            <div className="flex-1 md:flex-none">
                <label className="text-xs font-bold text-gray-500 uppercase block mb-2">Buy Price (Cost)</label>
                <input type="number" className="w-full md:w-32 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-black focus:ring-2 focus:ring-black outline-none" 
                        value={newProd.buyingPrice} onChange={e => setNewProd({...newProd, buyingPrice: parseFloat(e.target.value)})} />
            </div>
            <div className="flex-1 md:flex-none">
                <label className="text-xs font-bold text-gray-500 uppercase block mb-2">Sell Price</label>
                <input type="number" className="w-full md:w-32 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-black focus:ring-2 focus:ring-black outline-none" 
                        value={newProd.price} onChange={e => setNewProd({...newProd, price: parseFloat(e.target.value)})} />
            </div>
            <div className="flex-1 md:flex-none">
                <label className="text-xs font-bold text-gray-500 uppercase block mb-2">Stock</label>
                <input type="number" className="w-full md:w-24 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-black focus:ring-2 focus:ring-black outline-none" 
                        value={newProd.stock} onChange={e => setNewProd({...newProd, stock: parseInt(e.target.value)})} />
            </div>
        </div>
        <button onClick={handleAdd} className="w-full md:w-auto bg-black hover:bg-gray-800 text-white px-6 py-3 rounded-xl flex items-center justify-center gap-2 font-medium shadow-lg">
          <Plus size={18} /> Add
        </button>
      </div>

      {/* List */}
      <div className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
            <table className="w-full text-left text-gray-600 min-w-[1000px]">
            <thead className="bg-gray-50 text-xs uppercase font-bold text-gray-500">
                <tr>
                <th className="px-8 py-5">SKU</th>
                <th className="px-8 py-5">Name</th>
                <th className="px-8 py-5">Cost (Buy)</th>
                <th className="px-8 py-5">Price (Sell)</th>
                <th className="px-8 py-5">Stock</th>
                <th className="px-8 py-5">Actions</th>
                </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
                {products.map(p => (
                <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-8 py-5 font-mono text-sm text-black font-medium">{p.sku}</td>
                    <td className="px-8 py-5 font-bold text-black">{p.name}</td>
                    <td className="px-8 py-5 font-medium">{formatCurrency(p.buyingPrice || 0)}</td>
                    <td className="px-8 py-5 text-green-600 font-medium">{formatCurrency(p.price)}</td>
                    <td className="px-8 py-5">
                    {editingId === p.id ? (
                        <div className="flex items-center gap-2">
                            <input type="number" className="w-20 bg-white border border-black px-2 py-1 rounded-lg" 
                                    defaultValue={p.stock} 
                                    onBlur={(e) => handleUpdate({ ...p, stock: parseInt(e.target.value) })}
                                    autoFocus />
                        </div>
                    ) : (
                        <span onClick={() => setEditingId(p.id)} className="cursor-pointer hover:text-blue-600 border-b border-dashed border-gray-300">
                        {p.stock} units
                        </span>
                    )}
                    </td>
                    <td className="px-8 py-5">
                    <button className="p-2 hover:bg-red-50 text-red-400 hover:text-red-600 rounded-lg transition-colors"><Trash2 size={18} /></button>
                    </td>
                </tr>
                ))}
            </tbody>
            </table>
        </div>
      </div>
    </div>
  );
};