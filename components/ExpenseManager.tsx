
import React, { useState, useEffect } from 'react';
import { Plus, DollarSign, Trash2, Search, Tag, Edit2 } from 'lucide-react';
import { ExpenseStock } from '../types';
import { formatCurrency } from '../utils';
import { getExpenses, addExpense, deleteExpense, updateExpense } from '../api/expenses';

const ExpenseManager: React.FC = () => {
  const [expenses, setExpenses] = useState<ExpenseStock[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [formData, setFormData] = useState<Partial<ExpenseStock>>({
    code: '',
    description: '',
    defaultUnitValue: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const abortController = new AbortController();
    fetchExpenses(abortController.signal);

    return () => {
      abortController.abort();
    };
  }, []);

  const fetchExpenses = async (signal?: AbortSignal) => {
    try {
      setLoading(true);
      const data = await getExpenses(signal);
      setExpenses(data);
    } catch (error: any) {
      if (error.name !== 'AbortError') {
        console.error('Error fetching expenses:', error);
      }
    } finally {
      setLoading(false);
    }
  };

  const openCreate = () => {
    setEditingId(null);
    setFormData({ code: '', description: '', defaultUnitValue: 0 });
    setIsAdding(true);
  };

  const openEdit = (e: ExpenseStock) => {
    setEditingId(e.id);
    setFormData({
      code: e.code,
      description: e.description,
      defaultUnitValue: e.defaultUnitValue ?? 0
    });
    setIsAdding(true);
  };

  const handleSave = async () => {
    if (!formData.description || !formData.code) return;
    try {
      if (editingId) {
        await updateExpense(editingId, {
          code: formData.code,
          description: formData.description.toUpperCase(),
          defaultUnitValue: formData.defaultUnitValue || 0
        });
      } else {
        await addExpense({
          code: formData.code,
          description: formData.description.toUpperCase(),
          defaultUnitValue: formData.defaultUnitValue || 0
        });
      }
      fetchExpenses();
      setFormData({ code: '', description: '', defaultUnitValue: 0 });
      setEditingId(null);
      setIsAdding(false);
    } catch (error) {
      console.error('Error saving expense:', error);
    }
  };

  const removeExpense = async (id: string) => {
    if (window.confirm('Tem certeza que deseja excluir esta despesa?')) {
      try {
        await deleteExpense(id);
        fetchExpenses();
      } catch (error) {
        console.error('Error deleting expense:', error);
      }
    }
  };

  const filtered = expenses.filter(e => 
    e.description.toLowerCase().includes(searchTerm.toLowerCase()) || 
    e.code.includes(searchTerm)
  );

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-black text-gray-800 dark:text-white uppercase tracking-tight">Catálogo de Despesas</h1>
          <p className="text-gray-500 dark:text-slate-400">Configure os modelos de despesas recorrentes (Fretes, Seguros, Taxas).</p>
        </div>
        <button 
          onClick={openCreate}
          className="bg-pink-600 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 hover:bg-pink-700 transition-all shadow-lg shadow-pink-200 dark:shadow-none"
        >
          <Plus size={20} /> Novo Modelo
        </button>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-sm overflow-hidden transition-colors">
        <div className="p-4 border-b border-gray-100 dark:border-slate-800 flex items-center gap-3 bg-gray-50/50 dark:bg-slate-800/20">
          <Search className="text-gray-400 dark:text-slate-500" size={18} />
          <input 
            type="text" 
            placeholder="Buscar despesa por descrição ou código..." 
            className="bg-transparent border-none outline-none w-full text-sm text-gray-900 dark:text-white"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 p-6">
          {filtered.map(e => (
            <div key={e.id} className="group relative border border-gray-100 dark:border-slate-800 rounded-2xl p-5 hover:border-pink-200 dark:hover:border-pink-800 hover:shadow-xl hover:shadow-pink-50 dark:hover:shadow-none transition-all bg-white dark:bg-slate-900">
              <div className="absolute top-4 right-4 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                <button
                  onClick={() => openEdit(e)}
                  className="text-gray-300 dark:text-slate-700 hover:text-pink-600 p-1.5"
                  title="Editar despesa"
                >
                  <Edit2 size={16} />
                </button>
                <button 
                  onClick={() => removeExpense(e.id)}
                  className="text-gray-300 dark:text-slate-700 hover:text-red-500 p-1.5"
                  title="Excluir despesa"
                >
                  <Trash2 size={16} />
                </button>
              </div>
              
              <div className="flex items-center gap-3 mb-4">
                <div className="bg-pink-50 dark:bg-pink-900/20 p-3 rounded-xl">
                  <Tag className="text-pink-500 dark:text-pink-400" size={24} />
                </div>
                <div>
                  <span className="text-[10px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-widest">Cód. {e.code}</span>
                  <h3 className="font-black text-gray-800 dark:text-slate-100 leading-tight uppercase">{e.description}</h3>
                </div>
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-gray-50 dark:border-slate-800">
                <span className="text-xs text-gray-400 dark:text-slate-500 font-bold uppercase">Preço Padrão</span>
                <span className="text-lg font-black text-pink-600 dark:text-pink-400">
                  {e.defaultUnitValue ? formatCurrency(e.defaultUnitValue) : 'Sob Consulta'}
                </span>
              </div>
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="col-span-full py-20 text-center text-gray-400 dark:text-slate-600 italic bg-gray-50 dark:bg-slate-800/30 rounded-3xl border-2 border-dashed border-gray-100 dark:border-slate-800">
              Nenhuma despesa cadastrada no catálogo.
            </div>
          )}
        </div>
      </div>

      {isAdding && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200 transition-colors">
            <div className="p-6 border-b border-gray-100 dark:border-slate-800 bg-pink-50 dark:bg-pink-900/20">
              <h3 className="text-lg font-bold text-pink-800 dark:text-pink-400 flex items-center gap-2">
                <DollarSign className="text-pink-600 dark:text-pink-500" /> {editingId ? 'Editar Modelo de Despesa' : 'Novo Modelo de Despesa'}
              </h3>
            </div>
            <div className="p-6 space-y-4 bg-white dark:bg-slate-900">
              <div>
                <label className="block text-xs font-black text-gray-400 dark:text-slate-500 uppercase mb-1">Código Identificador</label>
                <input 
                  type="text" 
                  placeholder="Ex: 701"
                  className="w-full p-3 border border-gray-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-pink-500 bg-gray-50 dark:bg-slate-800 text-gray-900 dark:text-white transition-all"
                  value={formData.code}
                  onChange={e => setFormData({...formData, code: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-xs font-black text-gray-400 dark:text-slate-500 uppercase mb-1">Descrição da Despesa</label>
                <input 
                  type="text" 
                  placeholder="Ex: FRETE INTERESTADUAL"
                  className="w-full p-3 border border-gray-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-pink-500 bg-gray-50 dark:bg-slate-800 text-gray-900 dark:text-white transition-all"
                  value={formData.description}
                  onChange={e => setFormData({...formData, description: e.target.value.toUpperCase()})}
                />
              </div>
              <div>
                <label className="block text-xs font-black text-gray-400 dark:text-slate-500 uppercase mb-1">Valor Unitário Sugerido (Opcional)</label>
                <input 
                  type="number" 
                  step="0.01"
                  placeholder="0,00"
                  className="w-full p-3 border border-gray-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-pink-500 bg-gray-50 dark:bg-slate-800 text-gray-900 dark:text-white transition-all"
                  value={formData.defaultUnitValue}
                  onChange={e => setFormData({...formData, defaultUnitValue: parseFloat(e.target.value)})}
                />
              </div>
            </div>
            <div className="p-6 bg-gray-50 dark:bg-slate-800/50 border-t border-gray-100 dark:border-slate-800 flex gap-3 transition-colors">
              <button 
                onClick={() => {
                  setIsAdding(false);
                  setEditingId(null);
                }}
                className="flex-1 py-3 rounded-xl text-gray-500 dark:text-slate-400 font-bold hover:bg-gray-200 dark:hover:bg-slate-800 transition-all"
              >
                Cancelar
              </button>
              <button 
                onClick={handleSave}
                className="flex-1 py-3 rounded-xl bg-pink-600 text-white font-bold hover:bg-pink-700 transition-all shadow-lg shadow-pink-100 dark:shadow-none"
              >
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ExpenseManager;
