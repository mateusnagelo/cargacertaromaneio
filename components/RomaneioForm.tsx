
import React, { useRef } from 'react';
import { Plus, Trash2, User, FileText, ShoppingCart, DollarSign, CreditCard, Building2, Upload, MessageSquareText, X } from 'lucide-react';
import { RomaneioData, Product, Expense, Observation } from '../types';

interface RomaneioFormProps {
  data: RomaneioData;
  setData: React.Dispatch<React.SetStateAction<RomaneioData>>;
  totals: { products: number, expenses: number, grand: number };
  observations?: Observation[];
  companies: any[]; // Replace with specific types if available
  customers: any[]; // Replace with specific types if available
  stockProducts: any[]; // Replace with specific types if available
  expenseStock: any[]; // Replace with specific types if available
  onAddStockProduct: (id: string) => void;
  onAddStockExpense: (id: string) => void;
  onOpenExpenseManager?: () => void;
  onOpenObservationManager?: () => void;
}

const RomaneioForm: React.FC<RomaneioFormProps> = ({ 
  data, 
  setData, 
  totals, 
  observations = [],
  companies = [],
  customers = [],
  stockProducts = [],
  expenseStock = [],
  onAddStockProduct,
  onAddStockExpense,
  onOpenExpenseManager,
  onOpenObservationManager
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const parseDecimal = (value: any) => {
    if (value === null || value === undefined) return 0;
    const normalized = String(value).replace(/\s/g, '').replace(',', '.');
    const n = parseFloat(normalized);
    return Number.isFinite(n) ? n : 0;
  };

  const updateField = (path: string, value: any) => {
    const newData = { ...data };
    const keys = path.split('.');
    let current: any = newData;
    for (let i = 0; i < keys.length - 1; i++) {
      current = current[keys[i]];
    }
    current[keys[keys.length - 1]] = value;
    setData(newData);
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
          const updated = { ...e, [field]: value };
          if (field === 'total') {
            updated.total = parseDecimal(value);
          }
          if (field === 'quantity' || field === 'unitValue') {
            updated.total = parseDecimal(updated.quantity) * parseDecimal(updated.unitValue);
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
                value={data.company?.id || ''}
                onChange={(e) => {
                  const company = companies.find(c => c.id === e.target.value);
                  if (company) {
                    setData(prev => ({ ...prev, company: company, banking: company.banking }));
                  }
                }}
                className={`${inputClasses} font-bold`}
              >
                <option value="" disabled>Selecione uma empresa</option>
                {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className={labelClasses}>Endereço Completo</label>
              <input type="text" value={data.company.address} onChange={(e) => updateField('company.address', e.target.value)} className={inputClasses} />
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
        <div className="flex items-center gap-3 mb-6">
          <div className="bg-orange-50 dark:bg-orange-900/30 p-2 rounded-xl text-orange-500"><FileText size={20} /></div>
          <h2 className="text-lg font-black text-gray-800 dark:text-white uppercase tracking-tight">Detalhes do Pedido</h2>
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
            <label className={labelClasses}>Venda</label>
            <input type="date" value={data.saleDate} onChange={(e) => updateField('saleDate', e.target.value)} className={inputClasses} />
          </div>
          <div>
            <label className={labelClasses}>Vencimento</label>
            <input type="date" value={data.dueDate} onChange={(e) => updateField('dueDate', e.target.value)} className={inputClasses} />
          </div>
          <div>
            <label className={labelClasses}>Natureza</label>
            <input type="text" value={data.natureOfOperation} onChange={(e) => updateField('natureOfOperation', e.target.value.toUpperCase())} className={inputClasses} />
          </div>
          <div>
            <label className={labelClasses}>Prazo / Condição</label>
            <input type="text" value={data.terms} onChange={(e) => updateField('terms', e.target.value.toUpperCase())} className={`${inputClasses} font-bold`} />
          </div>
        </div>
      </section>

      {/* Client Info */}
      <section className={cardClasses}>
        <div className="flex items-center gap-3 mb-6">
          <div className="bg-blue-50 dark:bg-blue-900/30 p-2 rounded-xl text-blue-500"><User size={20} /></div>
          <h2 className="text-lg font-black text-gray-800 dark:text-white uppercase tracking-tight">Dados do Cliente</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          <div className="sm:col-span-2">
            <label className={labelClasses}>Selecionar Cliente</label>
            <select
              value={data.customer?.id || ''}
              onChange={(e) => {
                const customer = customers.find(c => c.id === e.target.value);
                if (customer) {
                  setData(prev => ({ ...prev, customer: customer, client: { name: customer.name, cnpj: customer.cnpj, city: customer.city, state: customer.state } }));
                }
              }}
              className={`${inputClasses} font-bold`}
            >
              <option value="" disabled>Selecione um cliente</option>
              {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className={labelClasses}>CNPJ / CPF</label>
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
              className="p-3 bg-gray-50 dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-2xl text-xs font-bold outline-none"
              defaultValue=""
            >
              <option value="" disabled>Adicionar do Estoque</option>
              {stockProducts.map(p => <option key={p.id} value={p.id}>{p.description}</option>)}
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
              className="p-3 bg-gray-50 dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-2xl text-xs font-bold outline-none"
              defaultValue=""
            >
              <option value="" disabled>Adicionar Despesa</option>
              {expenseStock.map(e => <option key={e.id} value={e.id}>{e.description}</option>)}
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
              {(data.expenses || []).map((e) => (
                <tr key={e.id}>
                  <td className="p-2"><input type="text" value={e.code} onChange={v => updateExpense(e.id, 'code', v.target.value)} className="w-full p-2 bg-gray-50 dark:bg-slate-800 border-none rounded-xl text-center text-gray-900 dark:text-white" /></td>
                  <td className="p-2"><input type="text" value={e.description} onChange={v => updateExpense(e.id, 'description', v.target.value)} className="w-full p-2 bg-gray-50 dark:bg-slate-800 border-none rounded-xl text-left text-gray-900 dark:text-white font-bold uppercase" /></td>
                  <td className="p-2"><input type="text" value={e.quantity} onChange={v => updateExpense(e.id, 'quantity', v.target.value)} className="w-full p-2 bg-gray-50 dark:bg-slate-800 border-none rounded-xl text-center text-gray-900 dark:text-white" /></td>
                  <td className="p-2"><input type="text" value={e.unitValue} onChange={v => updateExpense(e.id, 'unitValue', v.target.value)} className="w-full p-2 bg-gray-50 dark:bg-slate-800 border-none rounded-xl text-right text-gray-900 dark:text-white" /></td>
                  <td className="p-2"><input type="number" step="0.01" value={e.total} onChange={v => updateExpense(e.id, 'total', v.target.value)} className="w-full p-2 bg-gray-50 dark:bg-slate-800 border-none rounded-xl text-right font-black text-gray-900 dark:text-white" /></td>
                  <td className="p-2"><button onClick={() => removeExpense(e.id)} className="text-red-400 hover:text-red-600"><Trash2 size={16} /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Observation Dynamic Section */}
      <section className={cardClasses}>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="bg-cyan-50 dark:bg-cyan-900/30 p-2 rounded-xl text-cyan-500"><MessageSquareText size={20} /></div>
            <h2 className="text-lg font-black text-gray-800 dark:text-white uppercase tracking-tight">Observações ao Cliente</h2>
          </div>
          <div className="flex items-center gap-2">
            {observations.length > 0 && (
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
            {onOpenObservationManager && (
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
        <textarea 
          rows={6}
          className="w-full p-4 bg-gray-50 dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-3xl outline-none focus:ring-2 focus:ring-cyan-500 text-xs text-gray-700 dark:text-slate-300 transition-all leading-relaxed"
          placeholder="Texto que aparecerá no rodapé do PDF..."
          value={data.observation}
          onChange={(e) => updateField('observation', e.target.value)}
        />
        <p className="mt-2 text-[9px] text-gray-400 italic">Este texto é salvo apenas para este romaneio. Use o módulo 'Observações' para salvar modelos permanentes.</p>
      </section>

      {/* Banking */}
      <section className={cardClasses}>
        <div className="flex items-center gap-3 mb-6">
          <div className="bg-purple-50 dark:bg-purple-900/30 p-2 rounded-xl text-purple-500"><CreditCard size={20} /></div>
          <h2 className="text-lg font-black text-gray-800 dark:text-white uppercase tracking-tight">Dados Bancários</h2>
        </div>
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
      </section>
    </div>
  );
};

export default RomaneioForm;
