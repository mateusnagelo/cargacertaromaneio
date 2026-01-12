
import React, { useState, useMemo, useEffect } from 'react';
import { CatalogProduct, CompanyInfo, Customer, Product, RomaneioData, Expense, ExpenseStock, RomaneioStatus, Observation } from '../types';
import { DEFAULT_ROMANEIO } from '../constants';
import { FileDown, ChevronLeft, Edit3, Printer, Building2, Users, Package, Plus, DollarSign, Save, CheckCircle, X } from 'lucide-react';
import { formatCurrency, formatDate } from '../utils';
import RomaneioForm from './RomaneioForm';
import RomaneioPreview from './RomaneioPreview';
import ExpenseManager from './ExpenseManager';
import ObservationManager from './ObservationManager';
import { getCompanies } from '../api/companies';
import { getCustomers } from '../api/customers';
import { getProducts } from '../api/products';
import { getExpenses } from '../api/expenses';
import { getObservations } from '../api/observations';
import { addRomaneio } from '../api/romaneios';

interface Props {
  onSave: (data: RomaneioData) => void;
  initialData?: RomaneioData | null;
}

const RomaneioGenerator: React.FC<Props> = ({ onSave, initialData }) => {
  const [view, setView] = useState<'edit' | 'preview'>('edit');
  
  // Data fetched from API
  const [companies, setCompanies] = useState<CompanyInfo[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [stockProducts, setStockProducts] = useState<CatalogProduct[]>([]);
  const [expenseStock, setExpenseStock] = useState<ExpenseStock[]>([]);
  const [observations, setObservations] = useState<Observation[]>([]);
  const [loading, setLoading] = useState(true);

  const normalizeRomaneio = (input?: RomaneioData | null): RomaneioData => {
    const base: RomaneioData = { ...DEFAULT_ROMANEIO };
    if (!input) return base;
    const merged: any = { ...base, ...input };
    merged.company = input.company ?? base.company;
    merged.client = input.client ?? base.client;
    merged.banking = (input as any).banking ?? (input.company?.banking ?? base.banking);
    merged.products = Array.isArray((input as any).products) ? (input as any).products : [];
    merged.expenses = Array.isArray((input as any).expenses) ? (input as any).expenses : [];
    return merged as RomaneioData;
  };

  const [romaneio, setRomaneio] = useState<RomaneioData>(() => normalizeRomaneio(initialData || null));
  const [isExpenseManagerOpen, setIsExpenseManagerOpen] = useState(false);
  const [isObservationManagerOpen, setIsObservationManagerOpen] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    const signal = controller.signal;

    const fetchData = async () => {
      try {
        setLoading(true);
        const [companiesData, customersData, productsData, expensesData, observationsData] = await Promise.all([
          getCompanies(signal),
          getCustomers(signal),
          getProducts(signal),
          getExpenses(signal),
          getObservations(signal)
        ]);
        setCompanies(companiesData);
        setCustomers(customersData);
        setStockProducts(productsData);
        setExpenseStock(expensesData);
        setObservations(observationsData);

        // Set default company if not cloning and companies are loaded
        if (!initialData && companiesData.length > 0) {
          setRomaneio(prev => ({ ...prev, company: companiesData[0], banking: companiesData[0].banking }));
        }

      } catch (error: any) {
        if (error.name !== 'AbortError') {
          console.error("Failed to fetch initial data for Romaneio Generator", error);
        }
      } finally {
        setLoading(false);
      }
    };
    fetchData();

    return () => controller.abort();
  }, [initialData]);

  useEffect(() => {
    if (initialData) {
      setRomaneio(normalizeRomaneio(initialData));
    }
  }, [initialData]);

  const refreshExpenses = async () => {
    const controller = new AbortController();
    try {
      const expensesData = await getExpenses(controller.signal);
      setExpenseStock(expensesData);
    } catch (error: any) {
      if (error.name !== 'AbortError') console.error('Failed to refresh expenses', error);
    }
  };

  const refreshObservations = async () => {
    const controller = new AbortController();
    try {
      const observationsData = await getObservations(controller.signal);
      setObservations(observationsData);
    } catch (error: any) {
      if (error.name !== 'AbortError') console.error('Failed to refresh observations', error);
    }
  };

  const activeCompany = romaneio.company;
  const activeCustomer = romaneio.customer;

  const totals = useMemo(() => {
    const productsTotal = (romaneio.products || []).reduce((acc, p) => acc + ((p.quantity || 0) * (p.unitValue || 0)), 0);
    const expensesTotal = (romaneio.expenses || []).reduce((acc, e) => acc + (Number(e.total) || 0), 0);
    const dbGrand = Number((romaneio as any)?.montante_total ?? (romaneio as any)?.total_value ?? 0) || 0;
    const itemsGrand = productsTotal + expensesTotal;
    return {
      products: productsTotal,
      expenses: expensesTotal,
      grand: itemsGrand > 0 ? itemsGrand : dbGrand
    };
  }, [romaneio.products, romaneio.expenses, (romaneio as any)?.montante_total, (romaneio as any)?.total_value]);

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

  const processSave = async (forcedStatus?: RomaneioStatus) => {
    if (!romaneio.company?.id || !romaneio.customer?.id) {
      alert('Selecione uma empresa e um cliente antes de salvar.');
      return;
    }

    const finalData: Omit<RomaneioData, 'id' | 'created_at'> = {
      ...romaneio,
      status: forcedStatus || romaneio.status || 'PENDENTE',
      company_id: romaneio.company.id,
      customer_id: romaneio.customer.id,
    };

    const controller = new AbortController();
    try {
      const savedRomaneio = await addRomaneio(finalData, controller.signal);
      onSave(savedRomaneio as RomaneioData);
    } catch (error: any) {
      if (error.name !== 'AbortError') {
        console.error('Failed to save romaneio:', error);
        const message = error instanceof Error ? error.message : String(error);
        alert(`Erro ao salvar o romaneio: ${message}`);
      }
    }
  };

  const handleAddStockProduct = (productId: string) => {
    const stockP = stockProducts.find(p => String(p.id) === productId);
    if (!stockP) return;

    const newProduct: Product = {
      id: Math.random().toString(36).substr(2, 9),
      code: String(stockP.id),
      description: stockP.description || stockP.name,
      kg: 15,
      quantity: 1,
      unitValue: Number(stockP.price || 0)
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



  return (
    <div className="flex flex-col min-h-full pb-32 transition-colors duration-300">
      <div className="no-print bg-white dark:bg-slate-900 p-6 border-b border-gray-100 dark:border-slate-800 flex flex-wrap gap-4 items-center justify-between sticky top-0 z-40 shadow-sm transition-colors">
        <div>
           <div className="flex items-center gap-2">
             <h2 className="text-xl font-black text-gray-800 dark:text-white uppercase tracking-tight">
               {initialData ? 'Reimpressão de Romaneio' : 'Emissor de Romaneio'}
             </h2>
             {initialData && (
               <span className="bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 text-[10px] px-2 py-0.5 rounded-full font-black uppercase">Modo Visualização</span>
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
          <RomaneioForm 
            data={romaneio}
            setData={setRomaneio}
            companies={companies}
            customers={customers}
            stockProducts={stockProducts}
            expenseStock={expenseStock}
            observations={observations}
            onAddStockProduct={handleAddStockProduct}
            onAddStockExpense={handleAddStockExpense}
            onOpenExpenseManager={() => setIsExpenseManagerOpen(true)}
            onOpenObservationManager={() => setIsObservationManagerOpen(true)}
            totals={totals}
          />
        ) : (
          <div className="flex justify-center">
             <RomaneioPreview data={romaneio} totals={totals} />
          </div>
        )}
      </div>

      {isExpenseManagerOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[90] p-4 flex items-center justify-center"
          onClick={() => {
            setIsExpenseManagerOpen(false);
            refreshExpenses();
          }}
        >
          <div
            className="bg-white dark:bg-slate-900 rounded-[32px] w-full max-w-6xl h-[90vh] overflow-hidden shadow-2xl transition-colors"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-gray-100 dark:border-slate-800 flex items-center justify-between">
              <h3 className="text-sm font-black text-gray-800 dark:text-white uppercase tracking-widest">Catálogo de Despesas</h3>
              <button
                type="button"
                onClick={() => {
                  setIsExpenseManagerOpen(false);
                  refreshExpenses();
                }}
                className="p-2 rounded-xl text-gray-500 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800"
              >
                <X size={18} />
              </button>
            </div>
            <div className="h-[calc(90vh-57px)] overflow-y-auto">
              <ExpenseManager />
            </div>
          </div>
        </div>
      )}

      {isObservationManagerOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[90] p-4 flex items-center justify-center"
          onClick={() => {
            setIsObservationManagerOpen(false);
            refreshObservations();
          }}
        >
          <div
            className="bg-white dark:bg-slate-900 rounded-[32px] w-full max-w-6xl h-[90vh] overflow-hidden shadow-2xl transition-colors"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-gray-100 dark:border-slate-800 flex items-center justify-between">
              <h3 className="text-sm font-black text-gray-800 dark:text-white uppercase tracking-widest">Modelos de Observação</h3>
              <button
                type="button"
                onClick={() => {
                  setIsObservationManagerOpen(false);
                  refreshObservations();
                }}
                className="p-2 rounded-xl text-gray-500 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800"
              >
                <X size={18} />
              </button>
            </div>
            <div className="h-[calc(90vh-57px)] overflow-y-auto">
              <ObservationManager />
            </div>
          </div>
        </div>
      )}

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
                   {(romaneio.products?.length || 0)} Prod. / {(romaneio.expenses?.length || 0)} Desp.
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
