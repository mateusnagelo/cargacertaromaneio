
import React, { useState, useEffect } from 'react';
import { Plus, MessageSquareText, Trash2, Search, FileText, X, Save, Edit2, Info } from 'lucide-react';
import { Observation } from '../types';
import { getObservations, addObservation, updateObservation, deleteObservation } from '../api/observations';

const ObservationManager: React.FC = () => {
  const [observations, setObservations] = useState<Observation[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Observation | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [formData, setFormData] = useState<Partial<Observation>>({
    title: '',
    content: ''
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const abortController = new AbortController();
    fetchObservations(abortController.signal);

    return () => {
      abortController.abort();
    };
  }, []);

  const fetchObservations = async (signal?: AbortSignal) => {
    try {
      setLoading(true);
      const data = await getObservations(signal);
      setObservations(data);
    } catch (error: any) {
      if (error.name !== 'AbortError') {
        console.error('Error fetching observations:', error);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleOpenAdd = () => {
    setEditingId(null);
    setFormData({ title: '', content: '' });
    setIsAdding(true);
  };

  const handleEdit = (obs: Observation) => {
    setEditingId(obs.id);
    setFormData({ title: obs.title, content: obs.content });
    setIsAdding(true);
  };

  const handleSave = async () => {
    if (!formData.title || !formData.content) return;

    try {
      if (editingId) {
        await updateObservation(editingId, { 
          title: formData.title.toUpperCase(), 
          content: formData.content 
        });
      } else {
        await addObservation({
          title: formData.title.toUpperCase(),
          content: formData.content
        });
      }
      fetchObservations();
      setFormData({ title: '', content: '' });
      setEditingId(null);
      setIsAdding(false);
    } catch (error) {
      console.error('Error saving observation:', error);
    }
  };

  const removeObservation = async (id: string) => {
    try {
      await deleteObservation(id);
      fetchObservations();
    } catch (error) {
      console.error('Error deleting observation:', error);
    }
  };

  const confirmDeleteObservation = async () => {
    if (!deleteTarget?.id) return;
    setDeleteLoading(true);
    try {
      await removeObservation(deleteTarget.id);
      setDeleteTarget(null);
    } finally {
      setDeleteLoading(false);
    }
  };

  const filtered = observations.filter(o => 
    o.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
    o.content.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-black text-gray-800 dark:text-white uppercase tracking-tight">Modelos de Observação</h1>
          <p className="text-gray-500 dark:text-slate-400">Cadastre e edite textos padrões que aparecem no rodapé do romaneio.</p>
        </div>
        <button 
          onClick={handleOpenAdd}
          className="bg-cyan-600 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 hover:bg-cyan-700 transition-all shadow-lg shadow-cyan-200 dark:shadow-none"
        >
          <Plus size={20} /> Novo Modelo
        </button>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-sm overflow-hidden transition-colors">
        <div className="p-4 border-b border-gray-100 dark:border-slate-800 flex items-center gap-3 bg-gray-50/50 dark:bg-slate-800/20">
          <Search className="text-gray-400 dark:text-slate-500" size={18} />
          <input 
            type="text" 
            placeholder="Buscar modelos por título ou conteúdo..." 
            className="bg-transparent border-none outline-none w-full text-sm text-gray-900 dark:text-white"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6">
          {filtered.map(o => (
            <div key={o.id} className="group relative border border-gray-100 dark:border-slate-800 rounded-2xl p-6 hover:border-cyan-200 dark:hover:border-cyan-800 hover:shadow-xl transition-all bg-white dark:bg-slate-900">
              <div className="absolute top-4 right-4 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                <button 
                  onClick={() => handleEdit(o)}
                  className="text-gray-400 dark:text-slate-500 hover:text-cyan-600 p-1.5"
                  title="Editar modelo"
                >
                  <Edit2 size={16} />
                </button>
                <button 
                  onClick={() => setDeleteTarget(o)}
                  className="text-gray-400 dark:text-slate-500 hover:text-red-500 p-1.5"
                  title="Excluir modelo"
                >
                  <Trash2 size={16} />
                </button>
              </div>
              
              <div className="flex items-center gap-3 mb-4">
                <div className="bg-cyan-50 dark:bg-cyan-900/20 p-2 rounded-xl">
                  <FileText className="text-cyan-600 dark:text-cyan-400" size={20} />
                </div>
                <h3 className="font-black text-gray-800 dark:text-slate-100 uppercase tracking-tight max-w-[80%] truncate">{o.title}</h3>
              </div>
              
              <p className="text-xs text-gray-500 dark:text-slate-400 leading-relaxed line-clamp-4 italic">
                "{o.content}"
              </p>
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="col-span-full py-20 text-center text-gray-400 dark:text-slate-600 italic bg-gray-50 dark:bg-slate-800/30 rounded-3xl border-2 border-dashed border-gray-100 dark:border-slate-800">
              Nenhum modelo de observação encontrado.
            </div>
          )}
        </div>
      </div>

      {isAdding && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-[100] p-4">
          <div className="bg-white dark:bg-slate-900 rounded-[32px] shadow-2xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in duration-300">
            <div className="p-6 border-b border-gray-100 dark:border-slate-800 bg-cyan-50 dark:bg-cyan-900/20 flex justify-between items-center">
              <h3 className="text-lg font-bold text-cyan-800 dark:text-cyan-400 flex items-center gap-2">
                <MessageSquareText className="text-cyan-600 dark:text-cyan-500" /> 
                {editingId ? 'Editar Modelo de Observação' : 'Criar Novo Modelo'}
              </h3>
              <button onClick={() => setIsAdding(false)} className="text-gray-400 dark:text-slate-500 hover:text-gray-600"><X size={24} /></button>
            </div>
            
            <div className="p-8 space-y-6">
              <div>
                <label className="block text-[10px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-widest mb-1.5 px-1">Título do Modelo</label>
                <input 
                  type="text" 
                  placeholder="EX: PADRÃO PARA VENDAS A PRAZO"
                  className="w-full p-3 border border-gray-200 dark:border-slate-700 rounded-2xl bg-gray-50 dark:bg-slate-800 focus:bg-white dark:focus:bg-slate-700 focus:ring-2 focus:ring-cyan-500 outline-none font-bold text-gray-900 dark:text-white transition-all"
                  value={formData.title}
                  onChange={e => setFormData({...formData, title: e.target.value.toUpperCase()})}
                />
              </div>
              <div>
                <label className="block text-[10px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-widest mb-1.5 px-1">Conteúdo da Observação</label>
                <textarea 
                  rows={8}
                  placeholder="Digite aqui o texto que aparecerá no rodapé do romaneio..."
                  className="w-full p-4 border border-gray-200 dark:border-slate-700 rounded-2xl bg-gray-50 dark:bg-slate-800 focus:bg-white dark:focus:bg-slate-700 focus:ring-2 focus:ring-cyan-500 outline-none text-xs text-gray-800 dark:text-slate-200 transition-all leading-relaxed"
                  value={formData.content}
                  onChange={e => setFormData({...formData, content: e.target.value})}
                />
              </div>
            </div>

            <div className="p-8 bg-gray-50 dark:bg-slate-800/50 border-t border-gray-100 dark:border-slate-800 flex gap-4">
              <button 
                onClick={() => setIsAdding(false)}
                className="flex-1 py-4 rounded-2xl text-gray-500 dark:text-slate-400 font-black uppercase tracking-widest hover:bg-gray-200 dark:hover:bg-slate-700 transition-all text-[10px]"
              >
                Cancelar
              </button>
              <button 
                onClick={handleSave}
                className="flex-1 py-4 rounded-2xl bg-cyan-600 text-white font-black uppercase tracking-widest hover:bg-cyan-700 shadow-xl shadow-cyan-100 dark:shadow-none transition-all flex items-center justify-center gap-2 text-[10px]"
              >
                <Save size={16} /> {editingId ? 'Salvar Alterações' : 'Salvar Modelo'}
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
                  onClick={() => setDeleteTarget(null)}
                  disabled={deleteLoading}
                  className="p-2 hover:bg-red-100/50 dark:hover:bg-slate-800 rounded-xl text-red-600 dark:text-red-400 transition-all disabled:opacity-60"
                >
                  <X size={24} />
                </button>
              </div>
              <h3 className="text-xl font-black text-gray-800 dark:text-white uppercase tracking-tight leading-none">Excluir Observação</h3>
              <p className="text-[10px] text-red-600 dark:text-red-400 font-black uppercase mt-2 tracking-widest">Ação Irreversível</p>
            </div>

            <div className="p-6 md:p-8 space-y-4 overflow-y-auto">
              <div className="bg-gray-50 dark:bg-slate-800/50 border border-gray-100 dark:border-slate-800 rounded-3xl p-5">
                <p className="text-xs font-black text-gray-900 dark:text-white uppercase truncate">
                  {String(deleteTarget.title || '')}
                </p>
              </div>

              <div className="flex items-start gap-3 p-4 rounded-2xl bg-yellow-50/60 dark:bg-yellow-900/20 border border-yellow-100 dark:border-yellow-900/30">
                <div className="text-yellow-700 dark:text-yellow-300 pt-0.5"><Info size={18} /></div>
                <div className="text-[11px] font-bold text-yellow-800 dark:text-yellow-200">
                  Ao excluir este modelo de observação, ele não aparecerá mais no rodapé do romaneio. Deseja continuar?
                </div>
              </div>
            </div>

            <div className="p-6 md:p-8 bg-gray-50 dark:bg-slate-800/50 border-t border-gray-100 dark:border-slate-800 grid grid-cols-2 gap-4 shrink-0">
              <button
                onClick={() => setDeleteTarget(null)}
                disabled={deleteLoading}
                className="py-4 rounded-2xl text-gray-400 dark:text-slate-500 font-black uppercase tracking-widest text-[10px] disabled:opacity-60"
              >
                Cancelar
              </button>
              <button
                onClick={confirmDeleteObservation}
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

export default ObservationManager;
