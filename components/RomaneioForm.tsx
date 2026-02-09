
import React, { useMemo, useRef, useState } from 'react';
import { Plus, Trash2, User, FileText, ShoppingCart, DollarSign, CreditCard, Building2, Upload, MessageSquareText, X } from 'lucide-react';
import { addCompany } from '../api/companies';
import { addCustomer, addProducer } from '../api/customers';
import { CompanyInfo, Customer, RomaneioData, Product, Expense, Observation, RomaneioKind } from '../types';
import { toLocalDateInput } from '../utils';

interface RomaneioFormProps {
  data: RomaneioData;
  setData: React.Dispatch<React.SetStateAction<RomaneioData>>;
  totals: { products: number, expenses: number, grand: number };
  kind?: RomaneioKind;
  observations?: Observation[];
  companies: any[]; // Replace with specific types if available
  customers: any[]; // Replace with specific types if available
  stockProducts: any[]; // Replace with specific types if available
  expenseStock: any[]; // Replace with specific types if available
  onAddStockProduct: (id: string) => void;
  onAddStockExpense: (id: string) => void;
  onOpenExpenseManager?: () => void;
  onOpenObservationManager?: () => void;
  onCompanyCreated?: (company: CompanyInfo) => void;
  onCustomerCreated?: (customer: Customer) => void;
}

const RomaneioForm: React.FC<RomaneioFormProps> = ({ 
  data, 
  setData, 
  totals, 
  kind: kindProp,
  observations = [],
  companies = [],
  customers = [],
  stockProducts = [],
  expenseStock = [],
  onAddStockProduct,
  onAddStockExpense,
  onOpenExpenseManager,
  onOpenObservationManager,
  onCompanyCreated,
  onCustomerCreated
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const xmlInputRef = useRef<HTMLInputElement>(null);
  const [customerSearch, setCustomerSearch] = useState('');
  const inferKind = (r?: Partial<RomaneioData> | null) => {
    const k = String((r as any)?.kind ?? '').trim().toUpperCase();
    if (k === 'COMPRA') return 'COMPRA';
    if (k === 'VENDA') return 'VENDA';
    const nature = String((r as any)?.natureOfOperation ?? '').trim().toUpperCase();
    if (nature.includes('COMPRA')) return 'COMPRA';
    return 'VENDA';
  };
  const kind = (kindProp as any) || inferKind(data);
  const customerLabel = kind === 'COMPRA' ? 'Produtor Rural' : 'Cliente';
  const showObservationFields = kind !== 'COMPRA' || !!data.observationEnabled;
  const showBankingFields = kind !== 'COMPRA' || !!data.bankingEnabled;

  const filteredCustomers = useMemo(() => {
    const normalizeText = (v: unknown) =>
      String(v ?? '')
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');

    const onlyDigits = (v: unknown) => String(v ?? '').replace(/\D/g, '');

    const term = normalizeText(customerSearch);
    const termDigits = onlyDigits(customerSearch);

    if (!term && !termDigits) return customers;

    return customers.filter((c) => {
      const id = String(c?.id ?? '');
      const name = normalizeText(c?.name);
      const fantasyName = normalizeText((c as any)?.fantasyName);
      const cnpjDigits = onlyDigits((c as any)?.cnpj);

      const matchText = !!term && (name.includes(term) || fantasyName.includes(term) || id.toLowerCase().includes(term));
      const matchDigits = !!termDigits && (cnpjDigits.includes(termDigits) || onlyDigits(id).includes(termDigits));

      return matchText || matchDigits;
    });
  }, [customers, customerSearch]);

  const customerSuggestions = useMemo(() => {
    const term = customerSearch.trim();
    if (!term) return [];
    return filteredCustomers.slice(0, 8);
  }, [filteredCustomers, customerSearch]);

  const applyCustomer = (customer: any) => {
    setData(prev => ({
      ...prev,
      customer: customer,
      customerId: String(customer.id),
      client: {
        name: customer.name,
        cnpj: customer.cnpj,
        neighborhood: customer.neighborhood,
        ie: customer.ie,
        city: customer.city,
        address: customer.address,
        state: customer.state
      }
    }));
    setCustomerSearch('');
  };

  const parseXmlDecimal = (value: unknown) => {
    const normalized = String(value ?? '').replace(/\s/g, '').replace(',', '.');
    const n = parseFloat(normalized);
    return Number.isFinite(n) ? n : 0;
  };

  const onlyDigits = (v: unknown) => String(v ?? '').replace(/\D/g, '');
  const emptyBanking: CompanyInfo['banking'] = {
    bank: '',
    pix: '',
    type: 'CORRENTE',
    agency: '',
    account: '',
    owner: '',
  };

  const parseXmlToRomaneio = (xml: string) => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xml, 'text/xml');
    const parseError = doc.getElementsByTagName('parsererror')?.[0];
    if (parseError) throw new Error('XML inválido.');

    const firstByLocalName = (root: ParentNode, localName: string): Element | null => {
      const byNs = (root as any).getElementsByTagNameNS?.('*', localName);
      if (byNs && byNs.length > 0) return byNs[0] as Element;
      const byTag = (root as any).getElementsByTagName?.(localName);
      if (byTag && byTag.length > 0) return byTag[0] as Element;
      return null;
    };

    const textOf = (root: ParentNode | null, localName: string) => {
      if (!root) return '';
      const el = firstByLocalName(root, localName);
      return String(el?.textContent ?? '').trim();
    };

    const toDateInput = (raw: string) => {
      const s = String(raw ?? '').trim();
      if (!s) return '';
      if (s.length >= 10 && s[4] === '-' && s[7] === '-') return s.slice(0, 10);
      if (s.includes('T') && s.length >= 10) return s.slice(0, 10);
      const d = new Date(s);
      if (!Number.isFinite(d.getTime())) return '';
      return toLocalDateInput(d);
    };

    const infNFe =
      firstByLocalName(doc, 'infNFe') ||
      firstByLocalName(firstByLocalName(doc, 'NFe') || doc, 'infNFe') ||
      firstByLocalName(firstByLocalName(doc, 'nfeProc') || doc, 'infNFe');
    if (!infNFe) throw new Error('Não foi possível localizar infNFe no XML.');

    const ide = firstByLocalName(infNFe, 'ide');
    const emit = firstByLocalName(infNFe, 'emit');
    const dest = firstByLocalName(infNFe, 'dest');

    const dhEmi = textOf(ide, 'dhEmi') || textOf(ide, 'dEmi');
    const emissionDate = toDateInput(dhEmi);

    const emitName = textOf(emit, 'xNome');
    const emitCnpj = textOf(emit, 'CNPJ') || textOf(emit, 'CPF');
    const enderEmit = firstByLocalName(emit || infNFe, 'enderEmit');
    const emitAddress = [
      textOf(enderEmit, 'xLgr'),
      textOf(enderEmit, 'nro') ? `, ${textOf(enderEmit, 'nro')}` : '',
      textOf(enderEmit, 'xCpl') ? ` - ${textOf(enderEmit, 'xCpl')}` : '',
    ].join('').trim();
    const emitCep = textOf(enderEmit, 'CEP');

    const destName = textOf(dest, 'xNome');
    const destCnpj = textOf(dest, 'CNPJ') || textOf(dest, 'CPF');
    const enderDest = firstByLocalName(dest || infNFe, 'enderDest');
    const destAddress = [
      textOf(enderDest, 'xLgr'),
      textOf(enderDest, 'nro') ? `, ${textOf(enderDest, 'nro')}` : '',
      textOf(enderDest, 'xCpl') ? ` - ${textOf(enderDest, 'xCpl')}` : '',
    ].join('').trim();
    const destNeighborhood = textOf(enderDest, 'xBairro');
    const destCity = textOf(enderDest, 'xMun');
    const destState = textOf(enderDest, 'UF');
    const destCep = textOf(enderDest, 'CEP');

    const detEls = Array.from((infNFe as any).getElementsByTagNameNS?.('*', 'det') ?? (infNFe as any).getElementsByTagName?.('det') ?? []);
    const products: Product[] = detEls.map((detEl: any, idx: number) => {
      const prodEl = firstByLocalName(detEl, 'prod');
      const code = textOf(prodEl, 'cProd') || String((detEl as Element).getAttribute('nItem') || idx + 1);
      const description = textOf(prodEl, 'xProd');
      const quantity = parseXmlDecimal(textOf(prodEl, 'qCom'));
      const unitValue = parseXmlDecimal(textOf(prodEl, 'vUnCom'));
      return {
        id: Math.random().toString(36).substr(2, 9),
        code,
        description,
        kg: 0,
        quantity,
        unitValue
      };
    });

    const totalEl = firstByLocalName(infNFe, 'total');
    const icmsTotEl = firstByLocalName(totalEl || infNFe, 'ICMSTot');
    const vFrete = parseXmlDecimal(textOf(icmsTotEl, 'vFrete'));
    const vSeg = parseXmlDecimal(textOf(icmsTotEl, 'vSeg'));
    const vOutro = parseXmlDecimal(textOf(icmsTotEl, 'vOutro'));
    const vDesc = parseXmlDecimal(textOf(icmsTotEl, 'vDesc'));
    const infAdic = firstByLocalName(infNFe, 'infAdic');
    const infCpl = textOf(infAdic, 'infCpl');

    const expenses: Expense[] = [];
    const pushExpense = (description: string, total: number) => {
      expenses.push({
        id: Math.random().toString(36).substr(2, 9),
        code: 'XML',
        description,
        quantity: '1',
        unitValue: String(total),
        total
      });
    };
    if (vFrete > 0) pushExpense('FRETE (XML)', vFrete);
    if (vSeg > 0) pushExpense('SEGURO (XML)', vSeg);
    if (vOutro > 0) {
      pushExpense('Outras Despesas', vOutro);
    }
    if (vDesc > 0) pushExpense('DESCONTO (XML)', -vDesc);

    return {
      emissionDate,
      emit: { name: emitName, cnpj: emitCnpj, address: emitAddress, cep: emitCep },
      dest: { name: destName, cnpj: destCnpj, address: destAddress, neighborhood: destNeighborhood, city: destCity, state: destState, cep: destCep },
      products,
      expenses
    };
  };

  const handleXmlImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const xmlText = await file.text();
      const parsed = parseXmlToRomaneio(xmlText);

      const emitCnpjDigits = onlyDigits(parsed.emit.cnpj);
      const destCnpjDigits = onlyDigits(parsed.dest.cnpj);
      let companyToApply = companies.find((c) => onlyDigits(c?.cnpj) === emitCnpjDigits);
      let customerToApply = customers.find((c) => onlyDigits(c?.cnpj) === destCnpjDigits);

      const canCreateCompany = !!emitCnpjDigits && !!parsed.emit.name;
      const canCreateCustomer = !!destCnpjDigits && !!parsed.dest.name;

      const controller = new AbortController();

      if (!companyToApply && canCreateCompany) {
        const created = await addCompany(
          {
            name: parsed.emit.name,
            cnpj: parsed.emit.cnpj,
            ie: '',
            location: 'MATRIZ',
            address: parsed.emit.address,
            cep: parsed.emit.cep,
            tel: '',
            banking: emptyBanking,
          },
          controller.signal
        );
        companyToApply = created;
        onCompanyCreated?.(created);
      }

      if (!customerToApply && canCreateCustomer) {
        const created = await (kind === 'COMPRA' ? addProducer : addCustomer)(
          {
            name: parsed.dest.name,
            cnpj: parsed.dest.cnpj,
            role: kind === 'COMPRA' ? 'PRODUTOR_RURAL' : 'CLIENTE',
            neighborhood: parsed.dest.neighborhood || '',
            ie: '/',
            city: parsed.dest.city || '',
            address: parsed.dest.address || '',
            state: parsed.dest.state || '',
            cep: (parsed.dest as any)?.cep || '',
            tel: '',
            email: '',
            fantasyName: '',
            status: '',
            openingDate: '',
            legalNature: '',
            capitalSocial: null,
            cnaeMainCode: '',
            cnaeMainDescription: '',
            cnpjWsPayload: null,
          },
          controller.signal
        );
        customerToApply = created;
        onCustomerCreated?.(created);
      }

      setData((prev) => {
        const next: RomaneioData = { ...prev };

        if (parsed.emissionDate) {
          next.emissionDate = parsed.emissionDate;
          if (!next.saleDate) next.saleDate = parsed.emissionDate;
        }

        if (companyToApply) {
          next.company = companyToApply;
          next.companyId = String(companyToApply.id);
          next.banking = companyToApply.banking;
        } else {
          next.company = {
            ...next.company,
            name: parsed.emit.name || next.company?.name,
            cnpj: parsed.emit.cnpj || (next.company as any)?.cnpj,
            address: parsed.emit.address || (next.company as any)?.address,
            cep: parsed.emit.cep || (next.company as any)?.cep,
          };
        }

        if (customerToApply) {
          next.customer = customerToApply;
          next.customerId = String(customerToApply.id);
        }

        next.client = {
          ...next.client,
          name: parsed.dest.name || next.client?.name,
          cnpj: parsed.dest.cnpj || next.client?.cnpj,
          address: parsed.dest.address || next.client?.address,
          neighborhood: parsed.dest.neighborhood || next.client?.neighborhood,
          city: parsed.dest.city || next.client?.city,
          state: parsed.dest.state || next.client?.state,
        };

        next.products = parsed.products.length > 0 ? parsed.products : next.products;
        next.expenses = parsed.expenses.length > 0 ? parsed.expenses : next.expenses;

        return next;
      });
    } catch (err: any) {
      const message = err instanceof Error ? err.message : String(err);
      alert(`Erro ao importar XML: ${message}`);
    }
  };

  const parseDecimal = (value: any) => {
    if (value === null || value === undefined) return 0;
    const normalized = String(value).replace(/\s/g, '').replace(',', '.');
    const n = parseFloat(normalized);
    return Number.isFinite(n) ? n : 0;
  };

  const normalizeText = (v: unknown) => String(v ?? '').trim();

  const updateField = (path: string, value: any) => {
    setData((prev) => {
      const keys = path.split('.');
      const next: any = { ...prev };
      let currentNext: any = next;
      let currentPrev: any = prev;

      for (let i = 0; i < keys.length - 1; i++) {
        const k = keys[i];
        const prevChild = currentPrev?.[k];
        const nextChild =
          Array.isArray(prevChild) ? [...prevChild] : { ...(prevChild ?? {}) };
        currentNext[k] = nextChild;
        currentNext = nextChild;
        currentPrev = prevChild;
      }

      currentNext[keys[keys.length - 1]] = value;
      return next;
    });
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => updateField('company.logoUrl', reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const removeLogo = () => {
    updateField('company.logoUrl', '');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const addProduct = () => {
    const currentProducts = data.products || [];
    const newProduct: Product = {
      id: Math.random().toString(36).substr(2, 9),
      code: (currentProducts.length + 1).toString(),
      description: '',
      kg: 15,
      quantity: 0,
      unitValue: 0
    };
    setData({ ...data, products: [...currentProducts, newProduct] });
  };

  const removeProduct = (id: string) => {
    const currentProducts = data.products || [];
    setData({ ...data, products: currentProducts.filter(p => p.id !== id) });
  };

  const updateProduct = (id: string, field: keyof Product, value: any) => {
    const currentProducts = data.products || [];
    setData({
      ...data,
      products: currentProducts.map(p => p.id === id ? { ...p, [field]: value } : p)
    });
  };

  const updateExpense = (id: string, field: keyof Expense, value: any) => {
    const currentExpenses = data.expenses || [];
    setData({
      ...data,
      expenses: currentExpenses.map(e => {
        if (e.id === id) {
          let nextValue: any = value;
          if ((field === 'quantity' || field === 'unitValue') && typeof value === 'string') {
            nextValue = value.replace(/\//g, '').trimStart();
          }
          const updated = { ...e, [field]: nextValue };
          if (field === 'total') {
            updated.total = parseDecimal(value);
          }
          if (field === 'quantity' || field === 'unitValue') {
            const qtyRaw = String((updated as any)?.quantity ?? '').trim();
            const unitRaw = String((updated as any)?.unitValue ?? '').trim();
            const qtyMissing = qtyRaw === '/' || qtyRaw === '';
            const unitMissing = unitRaw === '/' || unitRaw === '';
            const qty = qtyMissing ? 1 : parseDecimal(qtyRaw);
            const unit = unitMissing ? 0 : parseDecimal(unitRaw);
            updated.total = qtyMissing ? unit : qty * unit;
          }
          return updated;
        }
        return e;
      })
    });
  };

  const removeExpense = (id: string) => {
    const currentExpenses = data.expenses || [];
    setData({ ...data, expenses: currentExpenses.filter(e => e.id !== id) });
  };

  const selectObservation = (content: string) => {
    updateField('observation', content);
  };

  const inputClasses = "w-full p-3 bg-gray-50 dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 text-gray-900 dark:text-white transition-all";
  const labelClasses = "text-[10px] font-black text-gray-400 dark:text-slate-500 uppercase mb-1.5 block px-1";
  const cardClasses = "bg-white dark:bg-slate-900 p-5 md:p-8 rounded-[32px] border border-gray-100 dark:border-slate-800 shadow-sm transition-colors duration-300";

  return (
    <div className="space-y-6 md:space-y-8">
      {/* Company Info Section */}
      <section className={cardClasses}>
        <div className="flex items-center gap-3 mb-6">
          <div className="bg-indigo-50 dark:bg-indigo-900/30 p-2 rounded-xl text-indigo-500"><Building2 size={20} /></div>
          <h2 className="text-lg font-black text-gray-800 dark:text-white uppercase tracking-tight">Empresa Emissora</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className={labelClasses}>Selecionar Empresa</label>
              <select
                value={String((data as any)?.companyId ?? data.company?.id ?? '')}
                onChange={(e) => {
                  const selectedId = e.target.value;
                  const company = companies.find(c => String(c.id) === selectedId);
                  if (company) {
                    setData((prev) => {
                      const address = normalizeText((company as any)?.address);
                      const cep = normalizeText((company as any)?.cep);

                      const nextCompany: any = { ...company, address, cep, banking: (company as any)?.banking };

                      return {
                        ...prev,
                        company: nextCompany,
                        companyId: String((company as any)?.id ?? ''),
                        company_id: String((company as any)?.id ?? ''),
                        banking: (company as any)?.banking ?? prev.banking,
                      };
                    });
                  }
                }}
                className={`${inputClasses} font-bold`}
              >
                <option value="" disabled>Selecione uma empresa</option>
                {companies.map(c => <option key={String(c.id)} value={String(c.id)}>{c.name}</option>)}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className={labelClasses}>Endereço Completo</label>
              <input type="text" value={data.company?.address ?? ''} onChange={(e) => updateField('company.address', e.target.value)} className={inputClasses} />
            </div>
          </div>
          
          <div className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-gray-100 dark:border-slate-700 rounded-3xl bg-gray-50/50 dark:bg-slate-800/30 hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors cursor-pointer group" onClick={() => fileInputRef.current?.click()}>
            <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleLogoUpload} />
            {data.company.logoUrl ? (
              <div className="relative group">
                <img src={data.company.logoUrl} className="max-h-32 object-contain rounded-xl" />
                <button onClick={(e) => { e.stopPropagation(); removeLogo(); }} className="absolute -top-3 -right-3 bg-red-500 text-white p-2 rounded-xl shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"><X size={16} /></button>
              </div>
            ) : (
              <div className="text-center">
                <Upload size={32} className="mx-auto text-gray-300 dark:text-slate-600 mb-2 group-hover:text-indigo-400 transition-colors" />
                <p className="text-[10px] font-black text-gray-400 dark:text-slate-500 uppercase">Vincular Logo</p>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Header Info */}
      <section className={cardClasses}>
        <div className="flex items-center justify-between gap-3 mb-6">
          <div className="flex items-center gap-3">
            <div className="bg-orange-50 dark:bg-orange-900/30 p-2 rounded-xl text-orange-500"><FileText size={20} /></div>
            <h2 className="text-lg font-black text-gray-800 dark:text-white uppercase tracking-tight">Detalhes do Pedido</h2>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="file"
              ref={xmlInputRef}
              className="hidden"
              accept=".xml,text/xml,application/xml"
              onChange={handleXmlImport}
            />
            <button
              type="button"
              onClick={() => xmlInputRef.current?.click()}
              className="px-4 py-2.5 rounded-2xl bg-orange-500 text-white font-black text-[10px] uppercase tracking-widest hover:bg-orange-600 transition-all shadow-lg shadow-orange-100 dark:shadow-none"
            >
              Importar XML
            </button>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          <div>
            <label className={labelClasses}>Nº Romaneio</label>
            <input type="text" value={data.number} onChange={(e) => updateField('number', e.target.value)} className="w-full p-3 bg-orange-50/30 dark:bg-orange-900/20 border border-orange-100 dark:border-orange-900/30 rounded-2xl outline-none font-black text-orange-700 dark:text-orange-400" />
          </div>
          <div>
            <label className={labelClasses}>Emissão</label>
            <input type="date" value={data.emissionDate} onChange={(e) => updateField('emissionDate', e.target.value)} className={inputClasses} />
          </div>
          <div>
            <label className={labelClasses}>{kind === 'COMPRA' ? 'Compra' : 'Venda'}</label>
            <input type="date" value={data.saleDate} onChange={(e) => updateField('saleDate', e.target.value)} className={inputClasses} />
          </div>
          <div>
            <label className={labelClasses}>Vencimento</label>
            <input
              type="date"
              required
              value={data.dueDate}
              onChange={(e) => updateField('dueDate', e.target.value)}
              className={inputClasses}
            />
          </div>
          {kind === 'COMPRA' && (
            <div>
              <label className={labelClasses}>Status do Pagamento</label>
              <select
                required
                value={String((data as any).paymentStatus || '')}
                onChange={(e) => {
                  const next = e.target.value;
                  updateField('paymentStatus', next);
                  if (String(next).trim().toUpperCase() !== 'PAGO') {
                    updateField('paymentDate', '');
                  }
                }}
                className={`${inputClasses} font-bold`}
              >
                <option value="" disabled>
                  Selecione...
                </option>
                <option value="EM_ABERTO">Em aberto</option>
                <option value="PARCIAL">Parcial</option>
                <option value="PAGO">Pago</option>
              </select>
            </div>
          )}
          {kind === 'COMPRA' && (
            <div>
              <label className={labelClasses}>Data do Pagamento</label>
              <input
                type="date"
                required={String((data as any).paymentStatus || '').trim().toUpperCase() === 'PAGO'}
                disabled={String((data as any).paymentStatus || '').trim().toUpperCase() !== 'PAGO'}
                value={String((data as any).paymentDate || '')}
                onChange={(e) => updateField('paymentDate', e.target.value)}
                className={inputClasses}
              />
            </div>
          )}
          <div>
            <label className={labelClasses}>Natureza</label>
            <input type="text" value={data.natureOfOperation} onChange={(e) => updateField('natureOfOperation', e.target.value.toUpperCase())} className={inputClasses} />
          </div>
          <div>
            <label className={labelClasses}>Prazo / Condição</label>
            <input type="text" required value={data.terms} onChange={(e) => updateField('terms', e.target.value.toUpperCase())} className={`${inputClasses} font-bold`} />
          </div>
        </div>
      </section>

      {/* Client Info */}
      <section className={cardClasses}>
        <div className="flex items-center gap-3 mb-6">
          <div className="bg-blue-50 dark:bg-blue-900/30 p-2 rounded-xl text-blue-500"><User size={20} /></div>
          <h2 className="text-lg font-black text-gray-800 dark:text-white uppercase tracking-tight">Dados do {customerLabel}</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          <div className="sm:col-span-2">
            <label className={labelClasses}>Selecionar {customerLabel}</label>
            <input
              type="text"
              value={customerSearch}
              onChange={(e) => setCustomerSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && customerSuggestions.length > 0) {
                  e.preventDefault();
                  applyCustomer(customerSuggestions[0]);
                }
              }}
              placeholder="Buscar por razão, ID ou CNPJ..."
              className={`${inputClasses} mb-2`}
            />
            {customerSuggestions.length > 0 && (
              <div className="mb-2 bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-700 rounded-2xl overflow-hidden">
                {customerSuggestions.map((c) => (
                  <button
                    key={String(c.id)}
                    type="button"
                    onClick={() => applyCustomer(c)}
                    className="w-full text-left px-4 py-3 hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors"
                  >
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-xs font-black text-gray-800 dark:text-white uppercase truncate">
                        {c.name}
                      </span>
                      <span className="text-[10px] font-bold text-gray-400 dark:text-slate-500 shrink-0">
                        {String(c.cnpj || c.id)}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
            <select
              value={String(data.customer?.id ?? '')}
              onChange={(e) => {
                const selectedId = e.target.value;
                const customer = customers.find(c => String(c.id) === selectedId);
                if (customer) {
                  applyCustomer(customer);
                }
              }}
              className={`${inputClasses} font-bold`}
            >
              <option value="" disabled>Selecione um {customerLabel.toLowerCase()}</option>
              {filteredCustomers.map(c => (
                <option key={String(c.id)} value={String(c.id)}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className={labelClasses}>{kind === 'COMPRA' ? 'CPF' : 'CNPJ / CPF'}</label>
            <input type="text" value={data.client.cnpj} onChange={(e) => updateField('client.cnpj', e.target.value)} className={inputClasses} />
          </div>
          <div className="sm:col-span-2 md:col-span-1">
            <label className={labelClasses}>Cidade</label>
            <input type="text" value={data.client.city} onChange={(e) => updateField('client.city', e.target.value)} className={inputClasses} />
          </div>
          <div className="md:col-span-1">
            <label className={labelClasses}>Estado</label>
            <input type="text" maxLength={2} value={data.client.state} onChange={(e) => updateField('client.state', e.target.value.toUpperCase())} className={`${inputClasses} text-center`} />
          </div>
        </div>
      </section>

      {/* Products Table */}
      <section className={`${cardClasses} overflow-hidden`}>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="bg-green-50 dark:bg-green-900/30 p-2 rounded-xl text-green-500"><ShoppingCart size={20} /></div>
            <h2 className="text-lg font-black text-gray-800 dark:text-white uppercase tracking-tight">Produtos</h2>
          </div>
          <div className="flex items-center gap-2">
            <select 
              onChange={(e) => onAddStockProduct(e.target.value)}
              className="p-3 bg-gray-50 dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-2xl text-xs font-bold outline-none text-gray-900 dark:text-white"
              defaultValue=""
            >
              <option value="" disabled className="bg-white text-gray-900">Adicionar do Estoque</option>
              {stockProducts.map(p => (
                <option key={p.id} value={p.id} className="bg-white text-gray-900">
                  {p.description || p.name}
                </option>
              ))}
            </select>
            <button onClick={addProduct} className="p-3 bg-green-600 text-white rounded-2xl hover:bg-green-700 transition-all shadow-lg shadow-green-100 dark:shadow-none">
              <Plus size={20} />
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px]">
            <thead>
              <tr className="text-left text-[10px] font-black text-gray-400 dark:text-slate-500 uppercase border-b border-gray-50 dark:border-slate-800">
                <th className="px-4 py-3 w-20">Cód</th>
                <th className="px-4 py-3">Descrição</th>
                <th className="px-4 py-3 w-20">Peso</th>
                <th className="px-4 py-3 w-20">Qtd CX</th>
                <th className="px-4 py-3 w-32">Unitário</th>
                <th className="px-4 py-3 w-32">Total</th>
                <th className="px-4 py-3 w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-slate-800">
              {(data.products || []).map((p) => (
                <tr key={p.id}>
                  <td className="p-2"><input type="text" value={p.code} onChange={e => updateProduct(p.id, 'code', e.target.value)} className="w-full p-2 bg-gray-50 dark:bg-slate-800 border-none rounded-xl text-center text-gray-900 dark:text-white" /></td>
                  <td className="p-2"><input type="text" value={p.description} onChange={e => updateProduct(p.id, 'description', e.target.value)} className="w-full p-2 bg-gray-50 dark:bg-slate-800 border-none rounded-xl font-bold text-gray-900 dark:text-white" /></td>
                  <td className="p-2"><input type="number" value={p.kg} onChange={e => updateProduct(p.id, 'kg', parseFloat(e.target.value) || 0)} className="w-full p-2 bg-gray-50 dark:bg-slate-800 border-none rounded-xl text-center text-gray-900 dark:text-white" /></td>
                  <td className="p-2"><input type="number" value={p.quantity} onChange={e => updateProduct(p.id, 'quantity', parseInt(e.target.value) || 0)} className="w-full p-2 bg-gray-50 dark:bg-slate-800 border-none rounded-xl text-center text-gray-900 dark:text-white" /></td>
                  <td className="p-2"><input type="number" step="0.01" value={p.unitValue} onChange={e => updateProduct(p.id, 'unitValue', parseFloat(e.target.value) || 0)} className="w-full p-2 bg-gray-50 dark:bg-slate-800 border-none rounded-xl text-right text-gray-900 dark:text-white" /></td>
                  <td className="p-4 text-right font-black text-gray-700 dark:text-slate-300">{(p.quantity * p.unitValue).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                  <td className="p-2"><button onClick={() => removeProduct(p.id)} className="text-red-400 hover:text-red-600"><Trash2 size={16} /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Expenses */}
      <section className={`${cardClasses} overflow-hidden`}>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="bg-pink-50 dark:bg-pink-900/30 p-2 rounded-xl text-pink-500"><DollarSign size={20} /></div>
            <h2 className="text-lg font-black text-gray-800 dark:text-white uppercase tracking-tight">Despesas Extras</h2>
          </div>
          <div className="flex items-center gap-2">
            <select 
              onChange={(e) => onAddStockExpense(e.target.value)}
              className="p-3 bg-gray-50 dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-2xl text-xs font-bold outline-none text-gray-900 dark:text-white"
              defaultValue=""
            >
              <option value="" disabled className="bg-white text-gray-900">Adicionar Despesa</option>
              {expenseStock.map(e => (
                <option key={e.id} value={e.id} className="bg-white text-gray-900">
                  {e.description}
                </option>
              ))}
            </select>
            {onOpenExpenseManager && (
              <button
                type="button"
                onClick={onOpenExpenseManager}
                className="p-3 bg-pink-600 text-white rounded-2xl hover:bg-pink-700 transition-all shadow-lg shadow-pink-100 dark:shadow-none"
                title="Gerenciar catálogo de despesas"
              >
                <Plus size={20} />
              </button>
            )}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[600px]">
            <thead>
              <tr className="text-left text-[10px] font-black text-gray-400 dark:text-slate-500 uppercase border-b border-gray-50 dark:border-slate-800">
                <th className="px-4 py-3 w-20">Cód</th>
                <th className="px-4 py-3">Descrição</th>
                <th className="px-4 py-3 w-24">Qtd</th>
                <th className="px-4 py-3 w-32 text-right">Unitário</th>
                <th className="px-4 py-3 w-32 text-right">Total</th>
                <th className="px-4 py-3 w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-slate-800">
              {(data.expenses || []).map((e, idx) => {
                return (
                  <tr key={e.id ?? String(idx)}>
                    <td className="p-2"><input type="text" value={e.code} onChange={v => updateExpense(e.id, 'code', v.target.value)} className="w-full p-2 bg-gray-50 dark:bg-slate-800 border-none rounded-xl text-center text-gray-900 dark:text-white" /></td>
                    <td className="p-2"><input type="text" value={e.description} onChange={v => updateExpense(e.id, 'description', v.target.value)} className="w-full p-2 bg-gray-50 dark:bg-slate-800 border-none rounded-xl text-left text-gray-900 dark:text-white font-bold uppercase" /></td>
                    <td className="p-2"><input type="text" required value={e.quantity} onChange={v => updateExpense(e.id, 'quantity', v.target.value)} className="w-full p-2 bg-gray-50 dark:bg-slate-800 border-none rounded-xl text-center text-gray-900 dark:text-white" /></td>
                    <td className="p-2"><input type="text" required value={e.unitValue} onChange={v => updateExpense(e.id, 'unitValue', v.target.value)} className="w-full p-2 bg-gray-50 dark:bg-slate-800 border-none rounded-xl text-right text-gray-900 dark:text-white" /></td>
                    <td className="p-2"><input type="number" step="0.01" value={e.total} onChange={v => updateExpense(e.id, 'total', v.target.value)} className="w-full p-2 bg-gray-50 dark:bg-slate-800 border-none rounded-xl text-right font-black text-gray-900 dark:text-white" /></td>
                    <td className="p-2"><button onClick={() => removeExpense(e.id)} className="text-red-400 hover:text-red-600"><Trash2 size={16} /></button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Observation Dynamic Section */}
      <section className={cardClasses}>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="bg-cyan-50 dark:bg-cyan-900/30 p-2 rounded-xl text-cyan-500"><MessageSquareText size={20} /></div>
            <h2 className="text-lg font-black text-gray-800 dark:text-white uppercase tracking-tight">
              {kind === 'COMPRA' ? 'Observações ao Produtor' : 'Observações ao Cliente'}
            </h2>
          </div>
          <div className="flex items-center gap-2">
            {kind === 'COMPRA' && (
              <label className="flex items-center gap-2 text-[10px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-widest select-none">
                <input
                  type="checkbox"
                  checked={!!data.observationEnabled}
                  onChange={(e) => updateField('observationEnabled', e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-cyan-600 focus:ring-cyan-500"
                />
                Incluir
              </label>
            )}
            {showObservationFields && observations.length > 0 && (
              <>
                <span className="text-[9px] font-black text-gray-400 uppercase">Aplicar Modelo:</span>
                <select
                  className="p-2 bg-gray-50 dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-xl text-[10px] font-bold outline-none text-cyan-600 uppercase"
                  onChange={(e) => selectObservation(e.target.value)}
                  defaultValue=""
                >
                  <option value="" disabled>Escolher...</option>
                  {observations.map(obs => (
                    <option key={obs.id} value={obs.content}>{obs.title}</option>
                  ))}
                </select>
              </>
            )}
            {showObservationFields && onOpenObservationManager && (
              <button
                type="button"
                onClick={onOpenObservationManager}
                className="p-2.5 bg-cyan-600 text-white rounded-xl hover:bg-cyan-700 transition-all shadow-lg shadow-cyan-100 dark:shadow-none"
                title="Gerenciar modelos de observação"
              >
                <Plus size={18} />
              </button>
            )}
          </div>
        </div>
        {showObservationFields && (
          <>
            <textarea 
              rows={6}
              className="w-full p-4 bg-gray-50 dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-3xl outline-none focus:ring-2 focus:ring-cyan-500 text-xs text-gray-700 dark:text-slate-300 transition-all leading-relaxed"
              placeholder="Texto que aparecerá no rodapé do PDF..."
              value={data.observation}
              onChange={(e) => updateField('observation', e.target.value)}
            />
            <p className="mt-2 text-[9px] text-gray-400 italic">Este texto é salvo apenas para este romaneio. Use o módulo 'Observações' para salvar modelos permanentes.</p>
          </>
        )}
      </section>

      {/* Banking */}
      <section className={cardClasses}>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="bg-purple-50 dark:bg-purple-900/30 p-2 rounded-xl text-purple-500"><CreditCard size={20} /></div>
            <h2 className="text-lg font-black text-gray-800 dark:text-white uppercase tracking-tight">Dados Bancários</h2>
          </div>
          {kind === 'COMPRA' && (
            <label className="flex items-center gap-2 text-[10px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-widest select-none">
              <input
                type="checkbox"
                checked={!!data.bankingEnabled}
                onChange={(e) => updateField('bankingEnabled', e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
              />
              Incluir
            </label>
          )}
        </div>
        {showBankingFields && (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            <div>
              <label className={labelClasses}>Banco</label>
              <input type="text" value={data.banking.bank} onChange={e => updateField('banking.bank', e.target.value)} className={inputClasses} />
            </div>
            <div>
              <label className={labelClasses}>PIX</label>
              <input type="text" value={data.banking.pix} onChange={e => updateField('banking.pix', e.target.value)} className={inputClasses} />
            </div>
            <div>
              <label className={labelClasses}>Titular</label>
              <input type="text" value={data.banking.owner} onChange={e => updateField('banking.owner', e.target.value)} className={inputClasses} />
            </div>
          </div>
        )}
      </section>
    </div>
  );
};

export default RomaneioForm;
