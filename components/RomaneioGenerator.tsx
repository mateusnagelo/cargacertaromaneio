
import React, { useState, useMemo, useEffect } from 'react';
import { CatalogProduct, CompanyInfo, Customer, CustomerRole, Product, RomaneioData, Expense, ExpenseStock, RomaneioKind, RomaneioStatus, Observation } from '../types';
import { DEFAULT_ROMANEIO } from '../constants';
import { FileDown, ChevronLeft, Edit3, Building2, Users, Package, Plus, DollarSign, Save, CheckCircle, X, AlertTriangle } from 'lucide-react';
import { formatCurrency, formatDate, toLocalDateInput } from '../utils';
import RomaneioForm from './RomaneioForm';
import RomaneioPreview from './RomaneioPreview';
import ExpenseManager from './ExpenseManager';
import ObservationManager from './ObservationManager';
import { getCompanies } from '../api/companies';
import { getCustomers, getProducers } from '../api/customers';
import { getProducts } from '../api/products';
import { getExpenses } from '../api/expenses';
import { getObservations } from '../api/observations';
import { addRomaneio, sendRomaneioEmailNotification, updateRomaneio } from '../api/romaneios';

interface Props {
  onSave: (data: RomaneioData) => void;
  initialData?: RomaneioData | null;
  onCreateNew?: () => void;
  initialKind?: RomaneioKind;
  allowEditConcluded?: boolean;
}

const RomaneioGenerator: React.FC<Props> = ({ onSave, initialData, onCreateNew, initialKind = 'VENDA' as RomaneioKind, allowEditConcluded = false }) => {
  const [view, setView] = useState<'edit' | 'preview'>('edit');
  
  // Data fetched from API
  const [companies, setCompanies] = useState<CompanyInfo[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [stockProducts, setStockProducts] = useState<CatalogProduct[]>([]);
  const [expenseStock, setExpenseStock] = useState<ExpenseStock[]>([]);
  const [observations, setObservations] = useState<Observation[]>([]);
  const [loading, setLoading] = useState(true);

  const isConcluido = (status: unknown) => {
    const s = String(status ?? '').trim().toUpperCase();
    return s === 'CONCLUÍDO' || s === 'CONCLUIDO';
  };

  const isReadOnly = useMemo(() => {
    if (!initialData) return false;
    if (allowEditConcluded) return false;
    return isConcluido((initialData as any)?.status);
  }, [allowEditConcluded, initialData]);

  const effectiveView = isReadOnly ? 'preview' : view;

  const inferKind = (r?: Partial<RomaneioData> | null): RomaneioKind => {
    const k = String((r as any)?.kind ?? '').trim().toUpperCase();
    if (k === 'COMPRA') return 'COMPRA';
    if (k === 'VENDA') return 'VENDA';
    const nature = String((r as any)?.natureOfOperation ?? '').trim().toUpperCase();
    if (nature.includes('COMPRA')) return 'COMPRA';
    return 'VENDA';
  };

  const normalizeRomaneio = (input?: RomaneioData | null): RomaneioData => {
    const base: RomaneioData = { ...DEFAULT_ROMANEIO };
    const today = toLocalDateInput();
    base.emissionDate = today;
    base.saleDate = today;
    base.kind = initialKind;
    base.natureOfOperation = initialKind === 'COMPRA' ? 'COMPRA' : 'VENDA';
    base.observationEnabled = initialKind !== 'COMPRA';
    base.bankingEnabled = initialKind !== 'COMPRA';
    if (initialKind === 'COMPRA') {
      (base as any).paymentStatus = (base as any).paymentStatus || 'EM_ABERTO';
      (base as any).paymentDate = (base as any).paymentDate || '';
    }
    if (!input) return base;
    const merged: any = { ...base, ...input };
    merged.kind = inferKind(input);
    merged.company = input.company ?? base.company;
    merged.client = input.client ?? base.client;
    merged.banking = (input as any).banking ?? (input.company?.banking ?? base.banking);
    if (merged.observationEnabled === undefined) {
      merged.observationEnabled = merged.kind !== 'COMPRA' ? true : !!String(merged.observation || '').trim();
    }
    if (merged.bankingEnabled === undefined) merged.bankingEnabled = merged.kind !== 'COMPRA';
    merged.products = Array.isArray((input as any).products) ? (input as any).products : [];
    merged.expenses = Array.isArray((input as any).expenses) ? (input as any).expenses : [];
    if (!String(merged.emissionDate || '').trim()) merged.emissionDate = today;
    if (!String(merged.saleDate || '').trim()) merged.saleDate = merged.emissionDate || today;
    return merged as RomaneioData;
  };

  const [romaneio, setRomaneio] = useState<RomaneioData>(() => normalizeRomaneio(initialData || null));
  const [isExpenseManagerOpen, setIsExpenseManagerOpen] = useState(false);
  const [isObservationManagerOpen, setIsObservationManagerOpen] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);
  const [isSaveSuccessOpen, setIsSaveSuccessOpen] = useState(false);
  const [successNavigateToHistory, setSuccessNavigateToHistory] = useState(false);
  const [successSavedRomaneio, setSuccessSavedRomaneio] = useState<RomaneioData | null>(null);
  const [isSelectBeforeSaveOpen, setIsSelectBeforeSaveOpen] = useState(false);
  const [isRequiredFieldsOpen, setIsRequiredFieldsOpen] = useState(false);
  const [missingRequiredFields, setMissingRequiredFields] = useState<string[]>([]);

  useEffect(() => {
    const controller = new AbortController();
    const signal = controller.signal;

    const fetchData = async () => {
      try {
        setLoading(true);
        const [companiesData, customersData, productsData, expensesData, observationsData] = await Promise.all([
          getCompanies(signal),
          initialKind === 'COMPRA' ? getProducers(signal) : getCustomers(signal),
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
          const first = companiesData[0] as any;
          setRomaneio((prev) => ({
            ...prev,
            company: { ...first, banking: first?.banking },
            companyId: String(first?.id ?? ''),
            company_id: String(first?.id ?? ''),
            banking: first?.banking ?? prev.banking,
          }));
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
      setView(isConcluido((initialData as any)?.status) && !allowEditConcluded ? 'preview' : 'edit');
    }
  }, [allowEditConcluded, initialData]);

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

  const onlyDigits = (v: unknown) => String(v ?? '').replace(/\D/g, '');

  const handleCompanyCreated = (company: CompanyInfo) => {
    setCompanies((prev) => {
      const companyId = String(company?.id ?? '');
      const companyCnpj = onlyDigits((company as any)?.cnpj);
      const idx = prev.findIndex((c) => String(c?.id ?? '') === companyId || (!!companyCnpj && onlyDigits((c as any)?.cnpj) === companyCnpj));
      if (idx === -1) return [company, ...prev];
      const next = [...prev];
      next[idx] = company;
      return next;
    });
  };

  const handleCustomerCreated = (customer: Customer) => {
    setCustomers((prev) => {
      const customerId = String(customer?.id ?? '');
      const customerCnpj = onlyDigits((customer as any)?.cnpj);
      const idx = prev.findIndex((c) => String(c?.id ?? '') === customerId || (!!customerCnpj && onlyDigits((c as any)?.cnpj) === customerCnpj));
      if (idx === -1) return [customer, ...prev];
      const next = [...prev];
      next[idx] = customer;
      return next;
    });
  };

  const activeCompany = romaneio.company;
  const activeCustomer = romaneio.customer;
  const romaneioKind = inferKind(romaneio);

  const customerRoleFilter: CustomerRole = romaneioKind === 'COMPRA' ? 'PRODUTOR_RURAL' : 'CLIENTE';
  const customersForSelect = useMemo(() => {
    return (customers || []).filter((c) => (c?.role ?? 'CLIENTE') === customerRoleFilter);
  }, [customers, customerRoleFilter]);

  const totals = useMemo(() => {
    const productsTotal = (romaneio.products || []).reduce((acc, p) => acc + ((p.quantity || 0) * (p.unitValue || 0)), 0);
    const expensesTotal = (romaneio.expenses || []).reduce((acc, e) => acc + (Number(e.total) || 0), 0);
    const dbGrand = Number((romaneio as any)?.montante_total ?? (romaneio as any)?.total_value ?? 0) || 0;
    const hasItems = (romaneio.products || []).length > 0 || (romaneio.expenses || []).length > 0;
    const itemsGrand = romaneioKind === 'COMPRA' ? productsTotal - expensesTotal : productsTotal + expensesTotal;
    return {
      products: productsTotal,
      expenses: expensesTotal,
      grand: hasItems ? itemsGrand : dbGrand
    };
  }, [romaneio.products, romaneio.expenses, (romaneio as any)?.montante_total, (romaneio as any)?.total_value, romaneioKind]);

  const waitForPrintLayout = async (container: HTMLElement) => {
    const img = container.querySelector('img') as HTMLImageElement | null;
    const imgReady =
      img && !img.complete
        ? new Promise<void>((resolve) => {
            const done = () => resolve();
            img.addEventListener('load', done, { once: true });
            img.addEventListener('error', done, { once: true });
          })
        : Promise.resolve();

    const fontsReady = (document as any).fonts?.ready ? (document as any).fonts.ready : Promise.resolve();
    await Promise.all([imgReady, fontsReady]);
    await new Promise<void>((r) => requestAnimationFrame(() => r()));
    await new Promise<void>((r) => requestAnimationFrame(() => r()));
  };

  const computeAndApplyA4PrintScale = async () => {
    const container = document.querySelector('.print-container') as HTMLElement | null;
    const scaleTarget = document.querySelector('.print-scale') as HTMLElement | null;
    if (!container || !scaleTarget) return () => {};

    const prev = {
      minHeight: container.style.minHeight,
      height: container.style.height,
      width: container.style.width,
      maxWidth: container.style.maxWidth,
    };

    const probe = document.createElement('div');
    probe.style.position = 'absolute';
    probe.style.visibility = 'hidden';
    probe.style.top = '0';
    probe.style.left = '0';
    probe.style.width = '210mm';
    probe.style.height = '297mm';
    document.body.appendChild(probe);
    const pageRect = probe.getBoundingClientRect();
    probe.remove();

    container.style.minHeight = '0';
    container.style.height = 'auto';
    container.style.width = '210mm';
    container.style.maxWidth = '210mm';

    document.documentElement.style.setProperty('--print-scale', '1');
    await waitForPrintLayout(scaleTarget);

    let scale = 1;
    for (let i = 0; i < 8; i++) {
      const contentHeight = scaleTarget.scrollHeight;
      const contentWidth = scaleTarget.scrollWidth;

      let next = 1;
      if (pageRect.height > 0 && contentHeight > 0) next = Math.min(next, pageRect.height / contentHeight);
      if (pageRect.width > 0 && contentWidth > 0) next = Math.min(next, pageRect.width / contentWidth);

      next = Math.min(1, Math.max(0.3, next * 0.99));
      if (Math.abs(next - scale) < 0.01) break;
      scale = next;
      document.documentElement.style.setProperty('--print-scale', String(scale));
      await waitForPrintLayout(scaleTarget);
    }

    return () => {
      document.documentElement.style.removeProperty('--print-scale');
      container.style.minHeight = prev.minHeight;
      container.style.height = prev.height;
      container.style.width = prev.width;
      container.style.maxWidth = prev.maxWidth;
    };
  };

  const exportPdf = async () => {
    const kindLabel = romaneioKind === 'COMPRA' ? 'Compra' : 'Venda';
    const fileName = `Romaneio_${kindLabel}_${romaneio.number}_${romaneio.client?.name || kindLabel}`.replaceAll(/[<>:"/\\|?*]+/g, '_');
    document.documentElement.classList.add('pdf-export');

    const ensurePreview = async () => {
      if (view !== 'preview') {
        setView('preview');
        await new Promise<void>((r) => setTimeout(() => r(), 0));
      }
      const target = document.querySelector('.print-scale') as HTMLElement | null;
      if (!target) throw new Error('Pré-visualização não encontrada');
      await waitForPrintLayout(target);
      return target;
    };

    let target: HTMLElement;
    try {
      target = await ensurePreview();
    } catch (error: any) {
      const message = error instanceof Error ? error.message : String(error);
      alert(`Erro ao gerar PDF: ${message}`);
      document.documentElement.classList.remove('pdf-export');
      return;
    }

    const prevStyle = {
      boxShadow: (target.parentElement as HTMLElement | null)?.style.boxShadow ?? '',
      border: (target.parentElement as HTMLElement | null)?.style.border ?? '',
      overflow: (target.parentElement as HTMLElement | null)?.style.overflow ?? '',
    };
    const container = target.closest('.print-container') as HTMLElement | null;
    if (container) {
      container.style.boxShadow = 'none';
      container.style.border = 'none';
      container.style.overflow = 'visible';
    }

    try {
      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import('html2canvas'), import('jspdf')]);

      const captureRoot = (target.closest('.print-container') as HTMLElement | null) ?? target;
      const canvas = await html2canvas(captureRoot, {
        backgroundColor: '#ffffff',
        scale: Math.max(2, Math.floor(window.devicePixelRatio || 1)),
        useCORS: true,
        logging: false,
        windowWidth: captureRoot.scrollWidth,
        windowHeight: captureRoot.scrollHeight,
      });

      const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 2;
      const availW = pageWidth - margin * 2;
      const availH = pageHeight - margin * 2;

      const imgWpx = canvas.width;
      const imgHpx = canvas.height;

      const imgData = canvas.toDataURL('image/jpeg', 0.95);
      const aspect = imgHpx > 0 ? imgWpx / imgHpx : 1;

      let renderW = availW;
      let renderH = renderW / aspect;
      if (renderH > availH) {
        renderH = availH;
        renderW = renderH * aspect;
      }

      const x = (pageWidth - renderW) / 2;
      const y = (pageHeight - renderH) / 2;
      pdf.addImage(imgData, 'JPEG', x, y, renderW, renderH, undefined, 'FAST');
      pdf.save(`${fileName}.pdf`);
    } catch (error: any) {
      const message = error instanceof Error ? error.message : String(error);
      alert(`Erro ao gerar PDF: ${message}`);
    } finally {
      document.documentElement.classList.remove('pdf-export');
      if (container) {
        container.style.boxShadow = prevStyle.boxShadow;
        container.style.border = prevStyle.border;
        container.style.overflow = prevStyle.overflow;
      }
    }
  };

  const processSave = async (forcedStatus?: RomaneioStatus) => {
    if (saveLoading) return;
    if (!allowEditConcluded && initialData && isConcluido((initialData as any)?.status)) {
      alert('Este romaneio está CONCLUÍDO e não pode ser editado. Use CLONAR no Histórico para criar um novo.');
      return;
    }
    if (!romaneio.company?.id || !romaneio.customer?.id) {
      setIsSelectBeforeSaveOpen(true);
      return;
    }
    if (romaneioKind === 'COMPRA') {
      const missing: string[] = [];
      const dueDate = String(romaneio.dueDate || '').trim();
      if (!dueDate) missing.push('Vencimento');

      const rawPaymentStatus = String((romaneio as any).paymentStatus || '').trim();
      const paymentStatus = rawPaymentStatus.toUpperCase().replaceAll(' ', '_');
      if (!paymentStatus) missing.push('Status do Pagamento');

      const paymentDate = String((romaneio as any).paymentDate || '').trim();
      if (paymentStatus === 'PAGO' && !paymentDate) missing.push('Data do Pagamento');

      if (missing.length > 0) {
        setMissingRequiredFields(missing);
        setIsRequiredFieldsOpen(true);
        return;
      }
    }

    if (initialData?.id) {
      const controller = new AbortController();
      setIsSaveSuccessOpen(false);
      setSuccessNavigateToHistory(false);
      setSuccessSavedRomaneio(null);
      setSaveLoading(true);
      try {
        const updated = await updateRomaneio(
          String(initialData.id),
          {
            ...romaneio,
            status: forcedStatus || romaneio.status || initialData.status || 'PENDENTE',
            company_id: romaneio.company.id,
            customer_id: romaneioKind === 'COMPRA' ? null : romaneio.customer.id,
            producer_id: romaneioKind === 'COMPRA' ? romaneio.customer.id : null,
          } as any,
          controller.signal
        );
        const normalized = normalizeRomaneio(updated);
        setRomaneio(normalized);
        setView('preview');
        onSave(normalized as RomaneioData);
      } catch (error: any) {
        if (error.name !== 'AbortError') {
          console.error('Failed to update romaneio:', error);
          const message = error instanceof Error ? error.message : String(error);
          alert(`Erro ao salvar alterações: ${message}`);
        }
      } finally {
        setSaveLoading(false);
      }
      return;
    }

    const finalData: Omit<RomaneioData, 'id' | 'created_at'> = {
      ...romaneio,
      status: forcedStatus || romaneio.status || 'PENDENTE',
      company_id: romaneio.company.id,
      customer_id: romaneioKind === 'COMPRA' ? null : romaneio.customer.id,
      producer_id: romaneioKind === 'COMPRA' ? romaneio.customer.id : null,
    };

    const controller = new AbortController();
    setSaveLoading(true);
    try {
      const savedRomaneio = await addRomaneio(finalData, controller.signal);
      try {
        if (savedRomaneio?.id && !initialData) {
          await sendRomaneioEmailNotification({ romaneioId: String(savedRomaneio.id), type: 'ROMANEIO_CRIADO' }, controller.signal);
        }
      } catch (e) {
        console.error('Falha ao enviar e-mail (Romaneio criado):', e);
      }
      if (!initialData) {
        setRomaneio(normalizeRomaneio(null));
        setView('edit');
      }
      onSave(savedRomaneio as RomaneioData);
    } catch (error: any) {
      if (error.name !== 'AbortError') {
        console.error('Failed to save romaneio:', error);
        const message = error instanceof Error ? error.message : String(error);
        alert(`Erro ao salvar o romaneio: ${message}`);
      }
    } finally {
      setSaveLoading(false);
    }
  };

  const closeSaveSuccess = () => {
    setIsSaveSuccessOpen(false);
    if (successNavigateToHistory && successSavedRomaneio) {
      setSuccessNavigateToHistory(false);
      setSuccessSavedRomaneio(null);
      onSave(successSavedRomaneio);
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
               {initialData ? 'Reimpressão de Romaneio' : romaneioKind === 'COMPRA' ? 'Emissor de Romaneio de Compra' : 'Emissor de Romaneio de Venda'}
             </h2>
             {initialData && (
               <span className="bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 text-[10px] px-2 py-0.5 rounded-full font-black uppercase">Modo Visualização</span>
             )}
           </div>
           <p className="text-xs text-gray-400 dark:text-slate-500">{romaneioKind === 'COMPRA' ? 'Monte a compra e registre no histórico.' : 'Monte o pedido e registre no histórico.'}</p>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setRomaneio(normalizeRomaneio(null));
              setView('edit');
              setIsExpenseManagerOpen(false);
              setIsObservationManagerOpen(false);
              onCreateNew?.();
            }}
            className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all font-bold shadow-lg shadow-blue-100 dark:shadow-none"
          >
            <Plus size={18} /> {romaneioKind === 'COMPRA' ? 'Criar Compra' : 'Criar Venda'}
          </button>
          {!isReadOnly &&
            (view === 'edit' ? (
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
            ))}
          <button 
            onClick={() => {
              void exportPdf();
            }}
            className="flex items-center gap-2 px-6 py-2.5 bg-orange-500 text-white rounded-xl hover:bg-orange-600 transition-all font-bold shadow-lg shadow-orange-100 dark:shadow-none"
          >
            <FileDown size={18} /> Baixar PDF
          </button>
          {initialData && !isReadOnly && (
            <button 
              onClick={() => processSave()}
              disabled={saveLoading}
              className="px-6 py-2.5 bg-purple-600 text-white rounded-xl hover:bg-purple-700 transition-all font-bold shadow-lg shadow-purple-100 dark:shadow-none disabled:opacity-60 disabled:cursor-not-allowed relative overflow-hidden"
            >
              <span className="relative z-10 flex items-center gap-2">
                <Save size={18} /> {saveLoading ? 'Salvando...' : 'Salvar Alterações'}
              </span>
              {saveLoading && (
                <span className="cc-loading-progress-track" aria-hidden="true">
                  <span className="cc-loading-progress-bar" />
                </span>
              )}
            </button>
          )}
          {!initialData && !isReadOnly && (
            <button 
              onClick={() => processSave('PENDENTE')}
              className="flex items-center gap-2 px-6 py-2.5 bg-gray-800 dark:bg-slate-950 text-white rounded-xl hover:bg-black transition-all font-bold shadow-lg shadow-gray-200 dark:shadow-none"
            >
              <Save size={18} /> Salvar como Pendente
            </button>
          )}
        </div>
      </div>

      <div className="p-8 max-w-6xl mx-auto w-full space-y-6">
        {effectiveView === 'edit' ? (
          <RomaneioForm 
            data={romaneio}
            setData={setRomaneio}
            companies={companies}
            customers={customersForSelect}
            stockProducts={stockProducts}
            expenseStock={expenseStock}
            observations={observations}
            onAddStockProduct={handleAddStockProduct}
            onAddStockExpense={handleAddStockExpense}
            onOpenExpenseManager={() => setIsExpenseManagerOpen(true)}
            onOpenObservationManager={() => setIsObservationManagerOpen(true)}
            onCompanyCreated={handleCompanyCreated}
            onCustomerCreated={handleCustomerCreated}
            totals={totals}
            kind={romaneioKind}
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

      {isSaveSuccessOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[95] p-4 flex items-center justify-center"
          onClick={closeSaveSuccess}
        >
          <div
            className="bg-white dark:bg-slate-900 rounded-[32px] w-full max-w-md shadow-2xl transition-colors p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              <div className="bg-green-100 dark:bg-green-900/30 p-2 rounded-xl text-green-700 dark:text-green-400">
                <CheckCircle size={20} />
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-black text-gray-800 dark:text-white uppercase tracking-widest">Sucesso</h3>
                <p className="text-sm text-gray-600 dark:text-slate-300 mt-1">Alterações salvas com sucesso.</p>
              </div>
              <button
                type="button"
                onClick={closeSaveSuccess}
                className="p-2 rounded-xl text-gray-500 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800"
              >
                <X size={18} />
              </button>
            </div>
            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={closeSaveSuccess}
                className="flex items-center gap-2 px-6 py-2.5 bg-green-600 text-white rounded-xl hover:bg-green-700 transition-all font-bold shadow-lg shadow-green-100 dark:shadow-none"
              >
                {successNavigateToHistory ? 'OK e Voltar' : 'OK'}
              </button>
            </div>
          </div>
        </div>
      )}

      {isSelectBeforeSaveOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[95] p-4 flex items-center justify-center"
          onClick={() => setIsSelectBeforeSaveOpen(false)}
        >
          <div
            className="bg-white dark:bg-slate-900 rounded-[32px] w-full max-w-md shadow-2xl transition-colors p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              <div className="bg-yellow-100 dark:bg-yellow-900/30 p-2 rounded-xl text-yellow-700 dark:text-yellow-400">
                <AlertTriangle size={20} />
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-black text-gray-800 dark:text-white uppercase tracking-widest">Atenção</h3>
                <p className="text-sm text-gray-600 dark:text-slate-300 mt-1">{romaneioKind === 'COMPRA' ? 'Selecione uma empresa e um produtor rural antes de salvar.' : 'Selecione uma empresa e um cliente antes de salvar.'}</p>
              </div>
              <button
                type="button"
                onClick={() => setIsSelectBeforeSaveOpen(false)}
                className="p-2 rounded-xl text-gray-500 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800"
              >
                <X size={18} />
              </button>
            </div>
            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={() => setIsSelectBeforeSaveOpen(false)}
                className="flex items-center gap-2 px-6 py-2.5 bg-yellow-500 hover:bg-yellow-600 text-white rounded-xl transition-all font-bold shadow-lg shadow-yellow-100 dark:shadow-none"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}

      {isRequiredFieldsOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[95] p-4 flex items-center justify-center"
          onClick={() => setIsRequiredFieldsOpen(false)}
        >
          <div
            className="bg-white dark:bg-slate-900 rounded-[32px] w-full max-w-md shadow-2xl transition-colors p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              <div className="bg-red-100 dark:bg-red-900/30 p-2 rounded-xl text-red-700 dark:text-red-400">
                <AlertTriangle size={20} />
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-black text-gray-800 dark:text-white uppercase tracking-widest">Campos obrigatórios</h3>
                <p className="text-sm text-gray-600 dark:text-slate-300 mt-1">
                  Preencha os campos abaixo para salvar:
                </p>
                {missingRequiredFields.length > 0 && (
                  <ul className="mt-3 list-disc pl-5 text-sm text-gray-700 dark:text-slate-200 font-bold space-y-1">
                    {missingRequiredFields.map((f) => (
                      <li key={f}>{f}</li>
                    ))}
                  </ul>
                )}
              </div>
              <button
                type="button"
                onClick={() => setIsRequiredFieldsOpen(false)}
                className="p-2 rounded-xl text-gray-500 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800"
              >
                <X size={18} />
              </button>
            </div>
            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={() => setIsRequiredFieldsOpen(false)}
                className="flex items-center gap-2 px-6 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl transition-all font-bold shadow-lg shadow-red-100 dark:shadow-none"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}

      {effectiveView === 'edit' && (
        <div className="no-print fixed bottom-0 left-0 right-0 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-t border-gray-100 dark:border-slate-800 p-4 shadow-2xl z-50 transition-colors">
          <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
            <div className="flex gap-8 items-center">
               <div>
                 <span className="text-[10px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-widest block mb-1">{romaneioKind === 'COMPRA' ? 'Total da Compra' : 'Total da Venda'}</span>
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
              disabled={saveLoading}
              className="bg-green-600 text-white px-10 py-4 rounded-2xl font-black uppercase tracking-widest hover:bg-green-700 shadow-xl shadow-green-100 dark:shadow-none transition-all flex items-center gap-3 disabled:opacity-60 disabled:cursor-not-allowed relative overflow-hidden"
            >
              <span className="relative z-10 flex items-center gap-3">
                <CheckCircle size={20} /> {saveLoading ? 'Concluindo...' : (romaneioKind === 'COMPRA' ? 'Concluir Compra' : 'Concluir Venda')}
              </span>
              {saveLoading && (
                <span className="cc-loading-progress-track" aria-hidden="true">
                  <span className="cc-loading-progress-bar" />
                </span>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default RomaneioGenerator;
