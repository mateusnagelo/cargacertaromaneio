
import React, { useState, useEffect } from 'react';
import { Plus, Package, Trash2, Edit2, Search, X, Info } from 'lucide-react';
import { CatalogProduct } from '../types';
import { formatCurrency } from '../utils';
import { getProducts, addProduct, deleteProduct, updateProduct } from '../api/products';

const ProductManager: React.FC = () => {
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CatalogProduct | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [formData, setFormData] = useState<Partial<CatalogProduct>>({
    name: '',
    description: '',
    price: 0,
    unit: 'caixa'
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    fetchProducts(controller.signal);
    return () => controller.abort();
  }, []);

  const fetchProducts = async (signal?: AbortSignal) => {
    try {
      setLoading(true);
      const data = await getProducts(signal);
      setProducts(data);
    } catch (error: any) {
      if (error.name !== 'AbortError' && !error.message?.includes('aborted')) {
        console.error('Error fetching products:', error);
      }
    } finally {
      setLoading(false);
    }
  };

  const openCreate = () => {
    setEditingId(null);
    setFormData({ name: '', description: '', price: 0, unit: 'caixa' });
    setIsAdding(true);
  };

  const openEdit = (p: CatalogProduct) => {
    setEditingId(p.id);
    setFormData({
      name: p.name || '',
      description: p.description ?? '',
      price: p.price ?? 0,
      unit: p.unit ?? 'caixa'
    });
    setIsAdding(true);
  };

  const handleSave = async () => {
    if (!formData.name) return;
    const controller = new AbortController();
    try {
      if (editingId) {
        await updateProduct(editingId, {
          name: formData.name,
          description: formData.description ?? null,
          price: formData.price ?? null,
          unit: formData.unit ?? null,
        });
      } else {
        await addProduct({
          name: formData.name,
          description: formData.description ?? null,
          price: formData.price ?? null,
          unit: formData.unit ?? null,
        }, controller.signal);
      }
      
      // Reset and refetch
      setFormData({ name: '', description: '', price: 0, unit: 'caixa' });
      setEditingId(null);
      setIsAdding(false);
      fetchProducts();

    } catch (error: any) {
      if (error.name !== 'AbortError' && !error.message?.includes('aborted')) {
        console.error('Error saving product:', error);
        const message = error instanceof Error ? error.message : 'Erro desconhecido';
        alert(`Erro ao salvar produto: ${message}`);
      }
    }
  };

  const removeProduct = async (id: number) => {
    try {
      await deleteProduct(id);
      fetchProducts();
    } catch (error) {
      console.error('Error deleting product:', error);
      const message = error instanceof Error ? error.message : 'Erro desconhecido';
      alert(`Erro ao excluir produto: ${message}`);
    }
  };

  const confirmDeleteProduct = async () => {
    if (!deleteTarget?.id) return;
    setDeleteLoading(true);
    try {
      await removeProduct(deleteTarget.id);
      setDeleteTarget(null);
    } finally {
      setDeleteLoading(false);
    }
  };

  const filtered = products.filter(p => 
    (p.name || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-8 max-w-6xl mx-auto">
      {loading && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 shadow-2xl rounded-[28px] px-8 py-8 flex flex-col items-center gap-4 w-[92%] max-w-sm">
            <div className="w-14 h-14 rounded-full border-4 border-gray-200 dark:border-slate-700 border-t-green-600 dark:border-t-green-500 animate-spin" />
            <div className="text-center">
              <div className="text-[11px] font-black uppercase tracking-widest text-gray-400 dark:text-slate-500">Carregando</div>
              <div className="text-sm font-black text-gray-900 dark:text-white mt-1">Atualizando estoque…</div>
            </div>
          </div>
        </div>
      )}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-black text-gray-800 dark:text-white uppercase tracking-tight">Estoque de Produtos</h1>
          <p className="text-gray-500 dark:text-slate-400">Cadastre os tipos de frutas e embalagens para o romaneio.</p>
        </div>
        <button 
          type="button"
          onClick={openCreate}
          className="bg-green-600 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 hover:bg-green-700 transition-all shadow-lg shadow-green-200 dark:shadow-none"
        >
          <Plus size={20} /> Novo Produto
        </button>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-sm overflow-hidden transition-colors">
        <div className="p-4 border-b border-gray-100 dark:border-slate-800 flex items-center gap-3 bg-gray-50/50 dark:bg-slate-800/20">
          <Search className="text-gray-400 dark:text-slate-500" size={18} />
          <input 
            type="text" 
            placeholder="Buscar produto por nome ou código..." 
            className="bg-transparent border-none outline-none w-full text-sm text-gray-900 dark:text-white"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left text-xs font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider bg-gray-50/50 dark:bg-slate-800/40 border-b border-gray-100 dark:border-slate-800">
                <th className="px-6 py-4">ID</th>
                <th className="px-6 py-4">Nome</th>
                <th className="px-6 py-4">Unidade</th>
                <th className="px-6 py-4 text-right">Preço</th>
                <th className="px-6 py-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
              {loading && (
                <tr>
                  <td colSpan={5} className="py-20 text-center text-gray-400 dark:text-slate-600 italic">Carregando produtos...</td>
                </tr>
              )}
              {!loading && filtered.map(p => (
                <tr key={p.id} className="hover:bg-gray-50 dark:hover:bg-slate-800/30 transition-colors group">
                  <td className="px-6 py-4 font-mono text-xs text-gray-500 dark:text-slate-500">{p.id}</td>
                  <td className="px-6 py-4 font-bold text-gray-700 dark:text-slate-200 uppercase">{p.name}</td>
                  <td className="px-6 py-4 text-gray-600 dark:text-slate-400">{p.unit}</td>
                  <td className="px-6 py-4 text-right font-bold text-green-600 dark:text-green-400">{formatCurrency(p.price || 0)}</td>
                  <td className="px-6 py-4 text-right space-x-2">
                    <button
                      onClick={() => openEdit(p)}
                      className="text-gray-300 dark:text-slate-600 hover:text-green-600 transition-colors p-1"
                      title="Editar produto"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button
                      onClick={() => setDeleteTarget(p)}
                      disabled={deleteLoading}
                      className="text-gray-300 dark:text-slate-600 hover:text-red-500 transition-colors p-1">
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
              {!loading && filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-20 text-center text-gray-400 dark:text-slate-600 italic">Nenhum produto encontrado.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isAdding && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-gray-100 dark:border-slate-800 bg-green-50 dark:bg-green-900/20">
              <h3 className="text-lg font-bold text-green-800 dark:text-green-400 flex items-center gap-2">
                <Package className="text-green-600 dark:text-green-500" /> {editingId ? 'Editar Produto' : 'Cadastrar Produto'}
              </h3>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 dark:text-slate-500 uppercase mb-1">Nome do Produto</label>
                <input 
                  type="text" 
                  placeholder="Ex: Uva Thompson"
                  className="w-full p-2.5 border border-gray-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-green-500 bg-white dark:bg-slate-800 text-gray-900 dark:text-white transition-all"
                  value={formData.name}
                  onChange={e => setFormData({...formData, name: e.target.value.toUpperCase()})}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 dark:text-slate-500 uppercase mb-1">Unidade</label>
                  <input 
                    type="text" 
                    placeholder="Ex: caixa"
                    className="w-full p-2.5 border border-gray-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-green-500 bg-white dark:bg-slate-800 text-gray-900 dark:text-white transition-all"
                    value={formData.unit}
                    onChange={e => setFormData({...formData, unit: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 dark:text-slate-500 uppercase mb-1">Preço</label>
                  <input 
                    type="number" 
                    step="0.01"
                    placeholder="0.00"
                    className="w-full p-2.5 border border-gray-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-green-500 bg-white dark:bg-slate-800 text-gray-900 dark:text-white transition-all"
                    value={formData.price}
                    onChange={e => setFormData({...formData, price: parseFloat(e.target.value) || 0})}
                  />
                </div>
              </div>
            </div>
            <div className="p-6 bg-gray-50 dark:bg-slate-800/50 border-t border-gray-100 dark:border-slate-800 flex gap-3">
              <button 
                type="button"
                onClick={() => {
                  setIsAdding(false);
                  setEditingId(null);
                }}
                className="flex-1 py-2.5 rounded-xl text-gray-500 dark:text-slate-400 font-bold hover:bg-gray-100 dark:hover:bg-slate-800 transition-all"
              >
                Cancelar
              </button>
              <button 
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleSave();
                }}
                className="flex-1 py-2.5 rounded-xl bg-green-600 text-white font-bold hover:bg-green-700 transition-all shadow-lg shadow-green-100 dark:shadow-none"
              >
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-md flex items-end md:items-center justify-center z-[110] p-0 md:p-4 animate-in fade-in slide-in-from-bottom duration-300">
          <div className="bg-white dark:bg-slate-900 rounded-t-[40px] md:rounded-[40px] shadow-2xl w-full max-w-md overflow-hidden max-h-[90vh] flex flex-col">
            <div className="p-6 md:p-8 border-b border-gray-100 dark:border-slate-800 bg-red-50/50 dark:bg-red-900/20 shrink-0">
              <div className="flex items-center justify-between mb-4">
                <div className="bg-red-600 p-2 rounded-xl text-white shadow-lg shadow-red-100 dark:shadow-none"><Trash2 size={20} /></div>
                <button
                  type="button"
                  onClick={() => setDeleteTarget(null)}
                  disabled={deleteLoading}
                  className="p-2 hover:bg-red-100/50 dark:hover:bg-slate-800 rounded-xl text-red-600 dark:text-red-400 transition-all disabled:opacity-60"
                >
                  <X size={24} />
                </button>
              </div>
              <h3 className="text-xl font-black text-gray-800 dark:text-white uppercase tracking-tight leading-none">Excluir Produto</h3>
              <p className="text-[10px] text-red-600 dark:text-red-400 font-black uppercase mt-2 tracking-widest">Ação Irreversível</p>
            </div>

            <div className="p-6 md:p-8 space-y-4 overflow-y-auto">
              <div className="bg-gray-50 dark:bg-slate-800/50 border border-gray-100 dark:border-slate-800 rounded-3xl p-5">
                <p className="text-xs font-black text-gray-900 dark:text-white uppercase truncate">
                  {String(deleteTarget.name || '')}
                </p>
                <p className="text-[10px] font-bold text-gray-500 dark:text-slate-400 uppercase truncate mt-1">
                  ID {String(deleteTarget.id)}
                </p>
              </div>

              <div className="flex items-start gap-3 p-4 rounded-2xl bg-yellow-50/60 dark:bg-yellow-900/20 border border-yellow-100 dark:border-yellow-900/30">
                <div className="text-yellow-700 dark:text-yellow-300 pt-0.5"><Info size={18} /></div>
                <div className="text-[11px] font-bold text-yellow-800 dark:text-yellow-200">
                  Ao excluir este produto, ele não poderá ser selecionado em novos romaneios. Deseja continuar?
                </div>
              </div>
            </div>

            <div className="p-6 md:p-8 bg-gray-50 dark:bg-slate-800/50 border-t border-gray-100 dark:border-slate-800 grid grid-cols-2 gap-4 shrink-0">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                disabled={deleteLoading}
                className="py-4 rounded-2xl text-gray-400 dark:text-slate-500 font-black uppercase tracking-widest text-[10px] disabled:opacity-60"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmDeleteProduct}
                disabled={deleteLoading}
                className="py-4 rounded-2xl bg-red-600 hover:bg-red-700 text-white font-black uppercase tracking-widest shadow-xl shadow-red-100 dark:shadow-none text-[10px] disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {deleteLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    Excluindo...
                  </>
                ) : (
                  'Deletar'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductManager;
