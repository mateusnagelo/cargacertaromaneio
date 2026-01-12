
import React, { useState, useEffect } from 'react';
import { Plus, Users, Trash2, Search, MapPin, Edit2 } from 'lucide-react';
import { Customer } from '../types';
import { getCustomers, addCustomer, deleteCustomer, updateCustomer } from '../api/customers';

const CustomerManager: React.FC = () => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [formData, setFormData] = useState<Partial<Customer>>({
    name: '', cnpj: '', city: '', state: '', address: '', neighborhood: '', ie: '/'
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    fetchCustomers(controller.signal);

    return () => {
      controller.abort();
    };
  }, []);

  const fetchCustomers = async (signal?: AbortSignal) => {
    try {
      setLoading(true);
      const data = await getCustomers(signal);
      if (data) {
        setCustomers(data);
      }
    } catch (error: any) {
      if (error.name !== 'AbortError' && !error.message?.includes('aborted')) {
        console.error('Error fetching customers:', error);
      }
    } finally {
      setLoading(false);
    }
  };

  const openCreate = () => {
    setEditingId(null);
    setFormData({ name: '', cnpj: '', city: '', state: '', address: '', neighborhood: '', ie: '/' });
    setIsAdding(true);
  };

  const openEdit = (c: Customer) => {
    setEditingId(c.id);
    setFormData({
      name: c.name || '',
      cnpj: c.cnpj || '',
      ie: c.ie || '/',
      neighborhood: c.neighborhood || '',
      city: c.city || '',
      address: c.address || '',
      state: c.state || '',
    });
    setIsAdding(true);
  };

  const handleSave = async () => {
    if (!formData.name) return;
    const controller = new AbortController();
    try {
      const addressParts = [formData.address, formData.neighborhood].filter(Boolean);
      const addressBase = addressParts.join(', ');
      const cityState = [formData.city, formData.state].filter(Boolean).join('/');
      const fullAddress = cityState ? `${addressBase} - ${cityState}` : addressBase;

      if (editingId) {
        await updateCustomer(editingId, {
          name: formData.name,
          cnpj: formData.cnpj || '',
          address: fullAddress,
        }, controller.signal);
      } else {
        await addCustomer({
          name: formData.name,
          cnpj: formData.cnpj || '',
          ie: formData.ie || '/',
          neighborhood: formData.neighborhood || '',
          city: formData.city || '',
          address: fullAddress,
          state: formData.state || '',
        }, controller.signal);
      }
      fetchCustomers(controller.signal); // Refresh list
      setFormData({ name: '', cnpj: '', city: '', state: '', address: '', neighborhood: '', ie: '/' });
      setIsAdding(false);
      setEditingId(null);
    } catch (error: any) {
      if (error.name !== 'AbortError' && !error.message?.includes('aborted')) {
        console.error('Error adding customer:', error);
      }
    }
  };

  const removeCustomer = async (id: string) => {
    const controller = new AbortController();
    try {
      await deleteCustomer(id, controller.signal);
      fetchCustomers(controller.signal); // Refresh list
    } catch (error: any) {
      if (error.name !== 'AbortError' && !error.message?.includes('aborted')) {
        console.error('Error deleting customer:', error);
      }
    }
  };

  const filtered = customers.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    (c.cnpj && c.cnpj.includes(searchTerm))
  );

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-black text-gray-800 dark:text-white uppercase tracking-tight">Gestão de Clientes</h1>
          <p className="text-gray-500 dark:text-slate-400">Administre sua base de clientes para emissão rápida de romaneios.</p>
        </div>
        <button 
          onClick={openCreate}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 dark:shadow-none"
        >
          <Plus size={20} /> Novo Cliente
        </button>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-sm overflow-hidden transition-colors">
        <div className="p-4 border-b border-gray-100 dark:border-slate-800 flex items-center gap-3 bg-gray-50/50 dark:bg-slate-800/20">
          <Search className="text-gray-400 dark:text-slate-500" size={18} />
          <input 
            type="text" 
            placeholder="Buscar cliente por nome ou CNPJ/CPF..." 
            className="bg-transparent border-none outline-none w-full text-sm text-gray-900 dark:text-white"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-6">
          {filtered.map(c => (
            <div key={c.id} className="border border-gray-100 dark:border-slate-800 rounded-2xl p-4 hover:shadow-md dark:hover:bg-slate-800/50 transition-all group relative bg-white dark:bg-slate-900">
              <div className="absolute top-4 right-4 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => openEdit(c)}
                  className="text-gray-300 dark:text-slate-700 hover:text-blue-600 transition-colors"
                  title="Editar cliente"
                >
                  <Edit2 size={16} />
                </button>
                <button 
                  onClick={() => removeCustomer(c.id)}
                  className="text-gray-300 dark:text-slate-700 hover:text-red-500 transition-colors"
                  title="Excluir cliente"
                >
                  <Trash2 size={16} />
                </button>
              </div>
              <div className="flex items-center gap-3 mb-3">
                <div className="bg-blue-50 dark:bg-blue-900/20 p-2.5 rounded-xl">
                  <Users className="text-blue-600 dark:text-blue-400" size={20} />
                </div>
                <div>
                  <h4 className="font-bold text-gray-800 dark:text-slate-200 leading-none">{c.name}</h4>
                  <span className="text-[10px] text-gray-400 dark:text-slate-500 font-mono">{c.cnpj}</span>
                </div>
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-slate-400">
                  <MapPin size={12} className="shrink-0 text-blue-400" />
                  <span className="truncate">{c.city}, {c.state}</span>
                </div>
                <div className="text-[10px] text-gray-400 dark:text-slate-500 uppercase truncate">
                  {c.address}, {c.neighborhood}
                </div>
              </div>
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="col-span-full py-20 text-center text-gray-400 dark:text-slate-600 italic border-2 border-dashed border-gray-100 dark:border-slate-800 rounded-3xl">
              Nenhum cliente cadastrado ainda.
            </div>
          )}
        </div>
      </div>

      {isAdding && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-gray-100 dark:border-slate-800 bg-blue-50 dark:bg-blue-900/20">
              <h3 className="text-lg font-bold text-blue-800 dark:text-blue-400 flex items-center gap-2">
                <Users className="text-blue-600 dark:text-blue-500" /> {editingId ? 'Editar Cliente' : 'Cadastrar Novo Cliente'}
              </h3>
            </div>
            <div className="p-6 grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="block text-xs font-bold text-gray-500 dark:text-slate-500 uppercase mb-1">Nome Completo / Razão Social</label>
                <input 
                  type="text" 
                  className="w-full p-2.5 border border-gray-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-800 text-gray-900 dark:text-white transition-all"
                  value={formData.name}
                  onChange={e => setFormData({...formData, name: e.target.value.toUpperCase()})}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 dark:text-slate-500 uppercase mb-1">CNPJ / CPF</label>
                <input 
                  type="text" 
                  className="w-full p-2.5 border border-gray-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-800 text-gray-900 dark:text-white transition-all"
                  value={formData.cnpj}
                  onChange={e => setFormData({...formData, cnpj: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 dark:text-slate-500 uppercase mb-1">Inscrição Estadual</label>
                <input 
                  type="text" 
                  className="w-full p-2.5 border border-gray-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-800 text-gray-900 dark:text-white transition-all"
                  value={formData.ie}
                  onChange={e => setFormData({...formData, ie: e.target.value})}
                />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-bold text-gray-500 dark:text-slate-500 uppercase mb-1">Logradouro / Endereço</label>
                <input 
                  type="text" 
                  className="w-full p-2.5 border border-gray-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-800 text-gray-900 dark:text-white transition-all"
                  value={formData.address}
                  onChange={e => setFormData({...formData, address: e.target.value.toUpperCase()})}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 dark:text-slate-500 uppercase mb-1">Bairro</label>
                <input 
                  type="text" 
                  className="w-full p-2.5 border border-gray-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-800 text-gray-900 dark:text-white transition-all"
                  value={formData.neighborhood}
                  onChange={e => setFormData({...formData, neighborhood: e.target.value.toUpperCase()})}
                />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2">
                  <label className="block text-xs font-bold text-gray-500 dark:text-slate-500 uppercase mb-1">Cidade</label>
                  <input 
                    type="text" 
                    className="w-full p-2.5 border border-gray-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-800 text-gray-900 dark:text-white transition-all"
                    value={formData.city}
                    onChange={e => setFormData({...formData, city: e.target.value.toUpperCase()})}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 dark:text-slate-500 uppercase mb-1">UF</label>
                  <input 
                    type="text" 
                    maxLength={2}
                    className="w-full p-2.5 border border-gray-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-800 text-gray-900 dark:text-white transition-all"
                    value={formData.state}
                    onChange={e => setFormData({...formData, state: e.target.value.toUpperCase()})}
                  />
                </div>
              </div>
            </div>
            <div className="p-6 bg-gray-50 dark:bg-slate-800/50 border-t border-gray-100 dark:border-slate-800 flex gap-3">
              <button 
                onClick={() => {
                  setIsAdding(false);
                  setEditingId(null);
                }}
                className="flex-1 py-2.5 rounded-xl text-gray-500 dark:text-slate-400 font-bold hover:bg-gray-100 dark:hover:bg-slate-800 transition-all"
              >
                Cancelar
              </button>
              <button 
                onClick={handleSave}
                className="flex-1 py-2.5 rounded-xl bg-blue-600 text-white font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 dark:shadow-none"
              >
                Salvar Cliente
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomerManager;
