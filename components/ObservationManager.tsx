
import React, { useState } from 'react';
import { Plus, MessageSquareText, Trash2, Search, FileText, X, Save, Edit2 } from 'lucide-react';
import { Observation } from '../types';

interface Props {
  observations: Observation[];
  setObservations: React.Dispatch<React.SetStateAction<Observation[]>>;
}

const ObservationManager: React.FC<Props> = ({ observations, setObservations }) => {
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [formData, setFormData] = useState<Partial<Observation>>({
    title: '',
    content: ''
  });

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

  const handleSave = () => {
    if (!formData.title || !formData.content) return;

    if (editingId) {
      // Update existing
      setObservations(prev => prev.map(o => 
        o.id === editingId 
          ? { ...o, title: formData.title!.toUpperCase(), content: formData.content! } 
          : o
      ));
    } else {
      // Create new
      const newObs: Observation = {
        id: Math.random().toString(36).substr(2, 9),
        title: formData.title.toUpperCase(),
        content: formData.content
      };
      setObservations([...observations, newObs]);
    }

    setFormData({ title: '', content: '' });
    setEditingId(null);
    setIsAdding(false);
  };

  const removeObservation = (id: string) => {
    if (confirm('Deseja excluir este modelo de observação?')) {
      setObservations(observations.filter(o => o.id !== id));
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
                  onClick={() => removeObservation(o.id)}
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
    </div>
  );
};

export default ObservationManager;
