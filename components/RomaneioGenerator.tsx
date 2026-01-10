
import React, { useState, useMemo, useEffect } from 'react';
import { CompanyInfo, Customer, ProductStock, RomaneioData, Product, Expense, ExpenseStock, RomaneioStatus, Observation } from '../types';
import { DEFAULT_ROMANEIO } from '../constants';
import { FileDown, ChevronLeft, Edit3, Printer, Building2, Users, Package, Plus, DollarSign, Save, CheckCircle } from 'lucide-react';
import { formatCurrency, formatDate } from '../utils';
import RomaneioForm from './RomaneioForm';
import RomaneioPreview from './RomaneioPreview';

interface Props {
  companies: CompanyInfo[];
  customers: Customer[];
  stockProducts: ProductStock[];
  expenseStock: ExpenseStock[];
  observations: Observation[];
  onSave: (data: RomaneioData) => void;
  initialData?: RomaneioData | null;
}

const RomaneioGenerator: React.FC<Props> = ({ companies, customers, stockProducts, expenseStock, observations, onSave, initialData }) => {
  const [view, setView] = useState<'edit' | 'preview'>('edit');
  const [selectedCompanyId, setSelectedCompanyId] = useState(initialData?.companyId || companies[0]?.id || '');
  const [selectedCustomerId, setSelectedCustomerId] = useState(initialData?.customerId || '');
  
  const [romaneio, setRomaneio] = useState<RomaneioData>(() => {
    if (initialData) return { ...initialData };
    
    return {
      ...DEFAULT_ROMANEIO,
      id: Math.random().toString(36).substr(2, 9),
      companyId: companies[0]?.id || '',
      customerId: '',
      products: [],
      expenses: []
    };
  });

  useEffect(() => {
    if (initialData) {
      setRomaneio({ ...initialData });
      setSelectedCompanyId(initialData.companyId);
      setSelectedCustomerId(initialData.customerId);
    }
  }, [initialData]);

  const activeCompany = companies.find(c => c.id === selectedCompanyId);
  const activeCustomer = customers.find(c => c.id === selectedCustomerId);

  const totals = useMemo(() => {
    const productsTotal = romaneio.products.reduce((acc, p) => acc + ((p.quantity || 0) * (p.unitValue || 0)), 0);
    const expensesTotal = romaneio.expenses.reduce((acc, e) => acc + (Number(e.total) || 0), 0);
    return {
      products: productsTotal,
      expenses: expensesTotal,
      grand: productsTotal + expensesTotal
    };
  }, [romaneio.products, romaneio.expenses]);

  const handlePrint = () => {
    const originalTitle = document.title;
    const fileName = `Romaneio_${romaneio.number}_${romaneio.client?.name || 'Venda'}`;
    document.title = fileName;
    
    if (view === 'edit') {
      setView('preview');
      setTimeout(() => {
        window.print();
        document.title = originalTitle;
      }, 300);
    } else {
      window.print();
      document.title = originalTitle;
    }
  };

  const processSave = (forcedStatus?: RomaneioStatus) => {
    if (!romaneio.company?.name || !romaneio.client?.name) {
      alert('Certifique-se de preencher os nomes da Empresa e do Cliente no formulário.');
      return;
    }

    const finalData: RomaneioData = {
      ...romaneio,
      status: forcedStatus || romaneio.status || 'PENDENTE',
      companyId: selectedCompanyId,
      customerId: selectedCustomerId,
    };

    onSave(finalData);
    
    setRomaneio({
      ...DEFAULT_ROMANEIO,
      id: Math.random().toString(36).substr(2, 9),
      companyId: selectedCompanyId,
      products: [],
      expenses: []
    });
    setSelectedCustomerId('');
  };

  const handleAddStockProduct = (productId: string) => {
    const stockP = stockProducts.find(p => p.id === productId);
    if (!stockP) return;

    const newProduct: Product = {
      id: Math.random().toString(36).substr(2, 9),
      code: stockP.code,
      description: stockP.description,
      kg: stockP.kg,
      quantity: 1,
      unitValue: stockP.defaultUnitValue
    };
    setRomaneio(prev => ({...prev, products: [...prev.products, newProduct]}));
  };

  const handleAddStockExpense = (expenseId: string) => {
    const stockE = expenseStock.find(e => e.id === expenseId);
    if (!stockE) return;

    const newExpense: Expense = {
      id: Math.random().toString(36).substr(2, 9),
      code: stockE.code,
      description: stockE.description,
      quantity: '1',
      unitValue: stockE.defaultUnitValue?.toString() || '0',
      total: stockE.defaultUnitValue || 0
    };
    setRomaneio(prev => ({...prev, expenses: [...prev.expenses, newExpense]}));
  };

  useEffect(() => {
    if (activeCompany && !initialData) {
      setRomaneio(prev => ({
        ...prev,
        companyId: activeCompany.id,
        company: { ...activeCompany },
        banking: { ...activeCompany.banking }
      }));
    }
  }, [selectedCompanyId, initialData]);

  useEffect(() => {
    if (activeCustomer && !initialData) {
      setRomaneio(prev => ({
        ...prev,
        customerId: activeCustomer.id,
        client: { ...activeCustomer }
      }));
    }
  }, [selectedCustomerId, initialData]);

  return (
    <div className="flex flex-col min-h-full pb-32 transition-colors duration-300">
      <div className="no-print bg-white dark:bg-slate-900 p-6 border-b border-gray-100 dark:border-slate-800 flex flex-wrap gap-4 items-center justify-between sticky top-0 z-40 shadow-sm transition-colors">
        <div>
           <div className="flex items-center gap-2">
             <h2 className="text-xl font-black text-gray-800 dark:text-white uppercase tracking-tight">
               {initialData ? 'Clonagem de Romaneio' : 'Emissor de Romaneio'}
             </h2>
             {initialData && (
               <span className="bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 text-[10px] px-2 py-0.5 rounded-full font-black uppercase">Modo Clone</span>
             )}
           </div>
           <p className="text-xs text-gray-400 dark:text-slate-500">Monte o pedido e registre no histórico.</p>
        </div>
        
        <div className="flex items-center gap-2">
          {view === 'edit' ? (
            <button 
              onClick={() => setView('preview')}
              className="flex items-center gap-2 px-6 py-2.5 bg-green-600 text-white rounded-xl hover:bg-green-700 transition-all font-bold shadow-lg shadow-green-100 dark:shadow-none"
            >
              <Edit3 size={18} /> Visualizar
            </button>
          ) : (
            <button 
              onClick={() => setView('edit')}
              className="flex items-center gap-2 px-6 py-2.5 bg-gray-600 dark:bg-slate-700 text-white rounded-xl hover:bg-gray-700 dark:hover:bg-slate-600 transition-all font-bold"
            >
              <ChevronLeft size={18} /> Voltar para Edição
            </button>
          )}
          <button 
            onClick={handlePrint}
            className="flex items-center gap-2 px-6 py-2.5 bg-orange-500 text-white rounded-xl hover:bg-orange-600 transition-all font-bold shadow-lg shadow-orange-100 dark:shadow-none"
          >
            <Printer size={18} /> Imprimir
          </button>
          <button 
            onClick={() => processSave('PENDENTE')}
            className="flex items-center gap-2 px-6 py-2.5 bg-gray-800 dark:bg-slate-950 text-white rounded-xl hover:bg-black transition-all font-bold shadow-lg shadow-gray-200 dark:shadow-none"
          >
            <Save size={18} /> Salvar como Pendente
          </button>
        </div>
      </div>

      <div className="p-8 max-w-6xl mx-auto w-full space-y-6">
        {view === 'edit' ? (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            <div className="lg:col-span-1 space-y-6 no-print">
               <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-gray-100 dark:border-slate-800 shadow-sm space-y-4">
                  <div>
                    <label className="text-[10px] font-black text-indigo-400 uppercase flex items-center gap-2 mb-2">
                      <Building2 size={12} /> Selecionar Empresa
                    </label>
                    <select 
                      className="w-full p-2 text-sm border border-gray-100 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 text-gray-900 dark:text-white rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                      value={selectedCompanyId}
                      onChange={e => setSelectedCompanyId(e.target.value)}
                    >
                      <option value="">Selecione...</option>
                      {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-blue-400 uppercase flex items-center gap-2 mb-2">
                      <Users size={12} /> Selecionar Cliente
                    </label>
                    <select 
                      className="w-full p-2 text-sm border border-gray-100 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 text-gray-900 dark:text-white rounded-xl outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                      value={selectedCustomerId}
                      onChange={e => setSelectedCustomerId(e.target.value)}
                    >
                      <option value="">Selecione do Cadastro...</option>
                      {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
               </div>
               <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-gray-100 dark:border-slate-800 shadow-sm">
                  <label className="text-[10px] font-black text-green-500 uppercase flex items-center gap-2 mb-3">
                    <Package size={12} /> Produtos no Estoque
                  </label>
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1 scroll-hide">
                    {stockProducts.map(p => (
                      <button key={p.id} onClick={() => handleAddStockProduct(p.id)} className="w-full p-2.5 text-left bg-gray-50 dark:bg-slate-800 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-xl border border-gray-100 dark:border-slate-700 transition-colors group flex items-center justify-between">
                        <span className="text-[10px] font-bold text-gray-700 dark:text-slate-300 uppercase truncate">{p.description}</span>
                        <Plus size={12} className="text-gray-300 dark:text-slate-600 group-hover:text-green-500 shrink-0" />
                      </button>
                    ))}
                  </div>
                  <label className="text-[10px] font-black text-pink-500 uppercase flex items-center gap-2 mt-6 mb-3">
                    <DollarSign size={12} /> Despesas Cadastradas
                  </label>
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1 scroll-hide">
                    {expenseStock.map(e => (
                      <button key={e.id} onClick={() => handleAddStockExpense(e.id)} className="w-full p-2.5 text-left bg-gray-50 dark:bg-slate-800 hover:bg-pink-50 dark:hover:bg-pink-900/20 rounded-xl border border-gray-100 dark:border-slate-700 transition-colors group flex items-center justify-between">
                        <span className="text-[10px] font-bold text-gray-700 dark:text-slate-300 uppercase truncate">{e.description}</span>
                        <Plus size={12} className="text-gray-300 dark:text-slate-600 group-hover:text-pink-500 shrink-0" />
                      </button>
                    ))}
                  </div>
               </div>
            </div>
            <div className="lg:col-span-3">
               <RomaneioForm 
                  data={romaneio} 
                  setData={setRomaneio} 
                  totals={totals} 
                  observations={observations}
               />
            </div>
          </div>
        ) : (
          <div className="flex justify-center">
             <RomaneioPreview data={romaneio} totals={totals} />
          </div>
        )}
      </div>

      {view === 'edit' && (
        <div className="no-print fixed bottom-0 left-0 right-0 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-t border-gray-100 dark:border-slate-800 p-4 shadow-2xl z-50 transition-colors">
          <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
            <div className="flex gap-8 items-center">
               <div>
                 <span className="text-[10px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-widest block mb-1">Total da Venda</span>
                 <p className="text-2xl font-black text-green-600 dark:text-green-400 leading-none">{formatCurrency(totals.grand)}</p>
               </div>
               <div className="hidden sm:block border-l border-gray-100 dark:border-slate-800 pl-8">
                 <span className="text-[10px] font-black text-gray-400 dark:text-slate-500 uppercase block mb-1">Itens Adicionados</span>
                 <p className="text-lg font-bold text-gray-800 dark:text-slate-200 leading-none">
                    {romaneio.products.length} Prod. / {romaneio.expenses.length} Desp.
                 </p>
               </div>
            </div>
            <button 
              onClick={() => processSave('CONCLUÍDO')} 
              className="bg-green-600 text-white px-10 py-4 rounded-2xl font-black uppercase tracking-widest hover:bg-green-700 shadow-xl shadow-green-100 dark:shadow-none transition-all flex items-center gap-3"
            >
              <CheckCircle size={20} /> Concluir Venda
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default RomaneioGenerator;
