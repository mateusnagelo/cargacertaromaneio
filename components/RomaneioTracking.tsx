
import React, { useState, useEffect } from 'react';
import { RomaneioData, RomaneioStatus } from '../types';
import { 
  Search, 
  Calendar, 
  User, 
  CheckCircle2, 
  Clock, 
  XCircle, 
  Printer, 
  Trash2,
  TrendingUp,
  CreditCard,
  ClipboardList,
  Copy,
  Check,
  X,
  Info
} from 'lucide-react';
import { formatCurrency, formatDate } from '../utils';
import {
  addRomaneio,
  getRomaneios,
  deleteRomaneio as deleteRomaneioAPI,
  updateRomaneioStatus as updateStatusAPI,
  sendRomaneioEmailNotification,
} from '../api/romaneios';

interface Props {
  onView: (romaneio: RomaneioData) => void;
}

const RomaneioTracking: React.FC<Props> = ({ onView }) => {
  const [history, setHistory] = useState<RomaneioData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<RomaneioStatus | 'TODOS'>('TODOS');
  
  const [cloneTarget, setCloneTarget] = useState<RomaneioData | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<RomaneioData | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [cloneOptions, setCloneOptions] = useState({
    client: true,
    products: true,
    expenses: true,
    banking: true,
    documentInfo: true
  });

  const isConcluido = (status: unknown) => {
    const s = String(status ?? '').trim().toUpperCase();
    return s === 'CONCLUÍDO' || s === 'CONCLUIDO';
  };

  const toOptionalInt = (v: unknown) => {
    const s = String(v ?? '').trim();
    if (!s) return null;
    if (!/^\d+$/.test(s)) return null;
    const n = Number(s);
    if (!Number.isFinite(n)) return null;
    return n;
  };

  const sortByNewestId = (rows: RomaneioData[]) => {
    return [...rows].sort((a, b) => {
      const aId = toOptionalInt((a as any)?.id);
      const bId = toOptionalInt((b as any)?.id);
      if (aId !== null && bId !== null) return bId - aId;
      if (aId !== null) return -1;
      if (bId !== null) return 1;

      const aCreated = String((a as any)?.created_at ?? (a as any)?.criado_em ?? '');
      const bCreated = String((b as any)?.created_at ?? (b as any)?.criado_em ?? '');
      if (aCreated && bCreated && aCreated !== bCreated) return bCreated.localeCompare(aCreated);

      const aNum = toOptionalInt((a as any)?.number ?? (a as any)?.numero ?? (a as any)?.guia);
      const bNum = toOptionalInt((b as any)?.number ?? (b as any)?.numero ?? (b as any)?.guia);
      if (aNum !== null && bNum !== null) return bNum - aNum;
      if (aNum !== null) return -1;
      if (bNum !== null) return 1;
      return 0;
    });
  };

  useEffect(() => {
    const controller = new AbortController();
    fetchRomaneios(controller.signal);

    return () => {
      controller.abort();
    };
  }, []);

  const fetchRomaneios = async (signal?: AbortSignal) => {
    try {
      setLoading(true);
      const data = await getRomaneios(signal);
      setHistory(sortByNewestId(Array.isArray(data) ? data : []));
    } catch (error: any) {
      if (error.name !== 'AbortError' && !error.message?.includes('aborted')) {
        console.error('Error fetching romaneios:', error);
      }
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (id: string, status: RomaneioStatus) => {
    try {
      await updateStatusAPI(id, status);
      fetchRomaneios(); // Re-fetch to get the latest data
    } catch (error) {
      console.error('Error updating status:', error);
    }
  };

  const confirmDeleteRomaneio = async () => {
    if (!deleteTarget?.id || deleteLoading) return;
    setDeleteLoading(true);
    try {
      await deleteRomaneioAPI(deleteTarget.id);
      fetchRomaneios();
      setDeleteTarget(null);
    } catch (error) {
      console.error('Error deleting romaneio:', error);
    } finally {
      setDeleteLoading(false);
    }
  };

  const filtered = history.filter(r => {
    if (!r) return false;
    const num = String(r.number || "");
    const clientName = String(r.client?.name || "").toLowerCase();
    const term = searchTerm.toLowerCase();
    const matchesSearch = num.includes(term) || clientName.includes(term);
    const matchesStatus = statusFilter === 'TODOS' || r.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const totals = history.reduce((acc, r) => {
    if (!r) return acc;
    const productsTotal = Array.isArray(r.products) 
      ? r.products.reduce((pAcc, p) => pAcc + ((p.quantity || 0) * (p.unitValue || 0)), 0) 
      : 0;
    const expensesTotal = Array.isArray(r.expenses)
      ? r.expenses.reduce((eAcc, e) => eAcc + (Number(e.total) || 0), 0)
      : 0;
    const totalFromItems = productsTotal + expensesTotal;
    const totalFromDb = Number((r as any)?.montante_total ?? (r as any)?.total_value ?? 0) || 0;
    const total = totalFromItems > 0 ? totalFromItems : totalFromDb;
    if (r.status === 'CONCLUÍDO') acc.concluido += total;
    if (r.status === 'PENDENTE' || !r.status) acc.pendente += total;
    return acc;
  }, { concluido: 0, pendente: 0 });

  const getStatusBadge = (status: RomaneioStatus) => {
    const s = status || 'PENDENTE';
    switch (s) {
      case 'CONCLUÍDO':
        return <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-[10px] font-black uppercase border border-green-100 dark:border-green-800"><CheckCircle2 size={12}/> Concluído</span>;
      case 'PENDENTE':
        return <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-yellow-50 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 text-[10px] font-black uppercase border border-yellow-100 dark:border-yellow-800"><Clock size={12}/> Pendente</span>;
      case 'CANCELADO':
        return <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 text-[10px] font-black uppercase border border-red-100 dark:border-red-800"><XCircle size={12}/> Cancelado</span>;
      default:
        return <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gray-50 dark:bg-slate-800 text-gray-700 dark:text-slate-400 text-[10px] font-black uppercase border border-gray-100 dark:border-slate-700"><Clock size={12}/> Pendente</span>;
    }
  };

  const executeClone = async () => {
    if (!cloneTarget) return;

    // Construct the new romaneio object, omitting fields that the DB will generate
    const newRomaneioData: Omit<RomaneioData, 'id' | 'created_at'> = {
      ...cloneTarget,
      number: `CLONE-${cloneTarget.number}`, // Indicate it's a clone
      status: 'PENDENTE',
      emissionDate: new Date().toISOString().split('T')[0],
      saleDate: new Date().toISOString().split('T')[0],
      dueDate: '',
      // Ensure we are passing only IDs for relations
      customer_id: cloneOptions.client && cloneTarget.customer ? cloneTarget.customer.id : undefined,
      company_id: cloneTarget.company ? cloneTarget.company.id : undefined,
      products: cloneOptions.products ? cloneTarget.products.map(p => ({ ...p, id: Math.random().toString(36).substr(2, 9) })) : [],
      expenses: cloneOptions.expenses ? cloneTarget.expenses.map(exp => ({ ...exp, id: Math.random().toString(36).substr(2, 9) })) : [],
      banking: cloneOptions.banking ? { ...cloneTarget.banking } : undefined,
      natureOfOperation: cloneOptions.documentInfo ? cloneTarget.natureOfOperation : 'VENDA',
      terms: cloneOptions.documentInfo ? cloneTarget.terms : '30 DIAS',
      // Explicitly remove fields that should not be cloned directly
      customer: undefined,
      company: undefined,
    };

    try {
      const created = await addRomaneio(newRomaneioData);
      try {
        if (created?.id) {
          await sendRomaneioEmailNotification({ romaneioId: String(created.id), type: 'ROMANEIO_CRIADO' });
        }
      } catch (e) {
        console.error('Falha ao enviar e-mail (Romaneio criado):', e);
      }
      fetchRomaneios(); // Refresh the list
      setCloneTarget(null); // Close the modal
    } catch (error) {
      console.error('Failed to clone romaneio:', error);
      alert('Erro ao clonar o romaneio. Verifique o console para mais detalhes.');
    }
  };

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6 md:space-y-8 animate-in fade-in duration-500 pb-24 transition-colors">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-black text-gray-800 dark:text-white uppercase tracking-tight">Vendas Realizadas</h1>
          <p className="text-xs md:text-sm text-gray-500 dark:text-slate-400">Gestão completa de pedidos e faturamento.</p>
        </div>
        
        <div className="flex gap-2 md:gap-4 w-full md:w-auto">
          <div className="flex-1 bg-white dark:bg-slate-900 p-4 rounded-[24px] border border-gray-100 dark:border-slate-800 shadow-sm flex items-center gap-3">
             <div className="bg-green-50 dark:bg-green-900/30 p-2 rounded-xl text-green-600"><TrendingUp size={18}/></div>
             <div>
               <p className="text-[9px] font-black text-gray-400 dark:text-slate-500 uppercase">Recebido</p>
               <p className="text-xs md:text-sm font-black text-green-600 dark:text-green-400">{formatCurrency(totals.concluido)}</p>
             </div>
          </div>
          <div className="flex-1 bg-white dark:bg-slate-900 p-4 rounded-[24px] border border-gray-100 dark:border-slate-800 shadow-sm flex items-center gap-3">
             <div className="bg-yellow-50 dark:bg-yellow-900/30 p-2 rounded-xl text-yellow-600"><CreditCard size={18}/></div>
             <div>
               <p className="text-[9px] font-black text-gray-400 dark:text-slate-500 uppercase">A Receber</p>
               <p className="text-xs md:text-sm font-black text-yellow-600 dark:text-yellow-400">{formatCurrency(totals.pendente)}</p>
             </div>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-[32px] border border-gray-100 dark:border-slate-800 shadow-xl shadow-gray-200/50 dark:shadow-none overflow-hidden transition-colors">
        <div className="p-4 md:p-6 border-b border-gray-50 dark:border-slate-800 bg-gray-50/30 dark:bg-slate-800/20 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-500" size={18} />
            <input 
              type="text" 
              placeholder="Nº ou Cliente..." 
              className="w-full pl-12 pr-4 py-3.5 bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-2xl outline-none focus:ring-2 focus:ring-purple-500 transition-all text-sm text-gray-900 dark:text-white"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-1 overflow-x-auto pb-1 md:pb-0 scroll-hide">
            {(['TODOS', 'PENDENTE', 'CONCLUÍDO', 'CANCELADO'] as const).map(s => (
              <button 
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`whitespace-nowrap px-4 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all ${statusFilter === s ? 'bg-purple-600 text-white shadow-lg shadow-purple-100 dark:shadow-none' : 'bg-white dark:bg-slate-800 text-gray-400 dark:text-slate-400 border border-gray-100 dark:border-slate-700 hover:text-gray-600 dark:hover:text-slate-200'}`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px]">
            <thead>
              <tr className="text-left text-[10px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-widest border-b border-gray-50 dark:border-slate-800">
                <th className="px-6 py-5">Identificação</th>
                <th className="px-6 py-5">Cliente</th>
                <th className="px-6 py-5 text-center">Data</th>
                <th className="px-6 py-5">Total</th>
                <th className="px-6 py-5">Status</th>
                <th className="px-6 py-5 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-slate-800">
              {filtered.map(r => {
                const pSum = Array.isArray(r.products) ? r.products.reduce((acc, p) => acc + (p.quantity * p.unitValue), 0) : 0;
                const eSum = Array.isArray(r.expenses) ? r.expenses.reduce((acc, e) => acc + (Number(e.total) || 0), 0) : 0;
                const totalFromItems = pSum + eSum;
                const totalFromDb = Number((r as any)?.montante_total ?? (r as any)?.total_value ?? 0) || 0;
                const total = totalFromItems > 0 ? totalFromItems : totalFromDb;
                
                return (
                  <tr key={r.id} className="hover:bg-gray-50/50 dark:hover:bg-slate-800/50 transition-all">
                    <td className="px-6 py-5">
                      <div className="flex flex-col">
                        <span className="text-sm font-black text-gray-800 dark:text-white">#{r.number || (r as any)?.guia || (r as any)?.numero || ''}</span>
                        <span className="text-[10px] text-gray-400 dark:text-slate-500 uppercase font-bold truncate max-w-[120px]">{r.company?.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-purple-50 dark:bg-purple-900/30 rounded-xl flex items-center justify-center text-purple-600 shrink-0">
                          <User size={14} />
                        </div>
                        <span className="text-sm font-bold text-gray-700 dark:text-slate-300 uppercase truncate max-w-[180px]">{r.client?.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-5 text-center">
                      <span className="text-[10px] font-bold text-gray-500 dark:text-slate-500">{formatDate(r.saleDate || r.emissionDate || (r as any)?.data_de_emissao)}</span>
                    </td>
                    <td className="px-6 py-5">
                      <span className="text-sm font-black text-gray-800 dark:text-white">{formatCurrency(total)}</span>
                    </td>
                    <td className="px-6 py-5">
                      {isConcluido(r.status) ? (
                        <div>
                          {getStatusBadge(r.status)}
                        </div>
                      ) : (
                        <div className="relative group/status cursor-pointer">
                          {getStatusBadge(r.status)}
                          <div className="absolute top-full left-0 mt-2 bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-2xl shadow-2xl opacity-0 invisible group-hover/status:opacity-100 group-hover/status:visible transition-all z-20 p-2 min-w-[150px]">
                            <button onClick={() => r.id && updateStatus(r.id, 'PENDENTE')} className="w-full text-left px-4 py-2 text-[10px] font-bold text-yellow-600 hover:bg-yellow-50 dark:hover:bg-yellow-900/30 rounded-lg">Pendente</button>
                            <button onClick={() => r.id && updateStatus(r.id, 'CONCLUÍDO')} className="w-full text-left px-4 py-2 text-[10px] font-bold text-green-600 hover:bg-green-50 dark:hover:bg-green-900/30 rounded-lg">Concluído</button>
                            <button onClick={() => r.id && updateStatus(r.id, 'CANCELADO')} className="w-full text-left px-4 py-2 text-[10px] font-bold text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg">Cancelar</button>
                          </div>
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => setCloneTarget(r)} className="p-2.5 text-blue-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-xl transition-all"><Copy size={18} /></button>
                        <button onClick={() => onView(r)} className="p-2.5 text-purple-400 hover:text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-900/30 rounded-xl transition-all"><Printer size={18} /></button>
                        <button onClick={() => setDeleteTarget(r)} className="p-2.5 text-gray-300 dark:text-slate-600 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-xl transition-all"><Trash2 size={18} /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {loading && (
                <tr>
                  <td colSpan={6} className="py-20 text-center text-gray-400 dark:text-slate-600 italic">Carregando romaneios...</td>
                </tr>
              )}
              {!loading && filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-20 text-center text-gray-400 dark:text-slate-600 italic">Nenhum romaneio encontrado.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Clone Modal */}
      {cloneTarget && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-md flex items-end md:items-center justify-center z-[100] p-0 md:p-4 animate-in fade-in slide-in-from-bottom duration-300">
          <div className="bg-white dark:bg-slate-900 rounded-t-[40px] md:rounded-[40px] shadow-2xl w-full max-w-md overflow-hidden max-h-[90vh] flex flex-col">
            <div className="p-6 md:p-8 border-b border-gray-100 dark:border-slate-800 bg-blue-50/30 dark:bg-blue-900/20 shrink-0">
               <div className="flex items-center justify-between mb-4">
                 <div className="bg-blue-600 p-2 rounded-xl text-white shadow-lg shadow-blue-100 dark:shadow-none"><Copy size={20} /></div>
                 <button onClick={() => setCloneTarget(null)} className="p-2 hover:bg-blue-100/50 dark:hover:bg-slate-800 rounded-xl text-blue-600 dark:text-blue-400 transition-all"><X size={24} /></button>
               </div>
               <h3 className="text-xl font-black text-gray-800 dark:text-white uppercase tracking-tight leading-none">Clonar Pedido</h3>
               <p className="text-[10px] text-blue-600 dark:text-blue-400 font-black uppercase mt-2 tracking-widest">Personalizar Cópia</p>
            </div>

            <div className="p-6 md:p-8 space-y-4 overflow-y-auto">
              {[
                { id: 'client', label: 'Dados do Cliente' },
                { id: 'products', label: 'Produtos' },
                { id: 'expenses', label: 'Despesas' },
                { id: 'banking', label: 'Dados Bancários' },
                { id: 'documentInfo', label: 'Regras de Prazo/OP' }
              ].map((opt) => (
                <label key={opt.id} className="flex items-center gap-4 p-4 rounded-2xl hover:bg-gray-50 dark:hover:bg-slate-800 cursor-pointer transition-all border border-gray-50 dark:border-slate-800">
                  <input 
                    type="checkbox" 
                    className="h-6 w-6 rounded-lg accent-blue-600"
                    checked={cloneOptions[opt.id as keyof typeof cloneOptions]}
                    onChange={() => setCloneOptions(prev => ({...prev, [opt.id]: !prev[opt.id as keyof typeof cloneOptions]}))}
                  />
                  <span className="text-xs font-black text-gray-700 dark:text-slate-300 uppercase tracking-tight">{opt.label}</span>
                </label>
              ))}
            </div>

            <div className="p-6 md:p-8 bg-gray-50 dark:bg-slate-800/50 border-t border-gray-100 dark:border-slate-800 grid grid-cols-2 gap-4 shrink-0">
              <button onClick={() => setCloneTarget(null)} className="py-4 rounded-2xl text-gray-400 dark:text-slate-500 font-black uppercase tracking-widest text-[10px]">Cancelar</button>
              <button onClick={executeClone} className="py-4 rounded-2xl bg-blue-600 text-white font-black uppercase tracking-widest shadow-xl shadow-blue-100 dark:shadow-none text-[10px]">Criar Clone</button>
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
              <h3 className="text-xl font-black text-gray-800 dark:text-white uppercase tracking-tight leading-none">Excluir Romaneio</h3>
              <p className="text-[10px] text-red-600 dark:text-red-400 font-black uppercase mt-2 tracking-widest">Ação Irreversível</p>
            </div>

            <div className="p-6 md:p-8 space-y-4 overflow-y-auto">
              <div className="bg-gray-50 dark:bg-slate-800/50 border border-gray-100 dark:border-slate-800 rounded-3xl p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-xs font-black text-gray-900 dark:text-white uppercase truncate">
                      Romaneio #{String(deleteTarget.number || (deleteTarget as any)?.guia || (deleteTarget as any)?.numero || '')}
                    </p>
                    <p className="text-[10px] font-bold text-gray-500 dark:text-slate-400 uppercase truncate mt-1">
                      {String(deleteTarget.client?.name || deleteTarget.customer?.name || '')}
                    </p>
                  </div>
                  <span className="text-[10px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-widest shrink-0">
                    {formatDate(deleteTarget.saleDate || deleteTarget.emissionDate || (deleteTarget as any)?.data_de_emissao)}
                  </span>
                </div>
              </div>

              <div className="flex items-start gap-3 p-4 rounded-2xl bg-yellow-50/60 dark:bg-yellow-900/20 border border-yellow-100 dark:border-yellow-900/30">
                <div className="text-yellow-700 dark:text-yellow-300 pt-0.5"><Info size={18} /></div>
                <div className="text-[11px] font-bold text-yellow-800 dark:text-yellow-200">
                  Tem certeza que deseja deletar este romaneio?
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
                onClick={confirmDeleteRomaneio}
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

export default RomaneioTracking;
