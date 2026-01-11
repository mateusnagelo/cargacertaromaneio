
import React, { useState, useRef, useEffect } from 'react';
import { Plus, Building2, Trash2, Upload, X, CreditCard, MapPin, Phone } from 'lucide-react';
import { CompanyInfo } from '../types';
import { getCompanies, addCompany, deleteCompany } from '../api/companies';

const CompanyManager: React.FC = () => {
  const [companies, setCompanies] = useState<CompanyInfo[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(true);
  
  const [formData, setFormData] = useState<Partial<CompanyInfo>>({
    name: '',
    location: '',
    address: '',
    cep: '',
    tel: '',
    logoUrl: '',
    banking: {
      bank: '',
      pix: '',
      type: 'CORRENTE',
      agency: '',
      account: '',
      owner: ''
    }
  });

  useEffect(() => {
    fetchCompanies();
  }, []);

  const fetchCompanies = async () => {
    try {
      setLoading(true);
      const data = await getCompanies();
      setCompanies(data);
    } catch (error) {
      console.error('Error fetching companies:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setFormData({...formData, logoUrl: reader.result as string});
      reader.readAsDataURL(file);
    }
  };

  const handleSave = async () => {
    if (!formData.name) return;
    try {
      await addCompany({
        name: formData.name,
        location: formData.location || '',
        address: formData.address || '',
        cep: formData.cep || '',
        tel: formData.tel || '',
        logoUrl: formData.logoUrl || '',
        banking: formData.banking as any
      });
      fetchCompanies();
      setIsAdding(false);
      // Reset form
      setFormData({
        name: '', location: '', address: '', cep: '', tel: '', logoUrl: '',
        banking: { bank: '', pix: '', type: 'CORRENTE', agency: '', account: '', owner: '' }
      });
    } catch (error) {
      console.error('Error adding company:', error);
    }
  };

  const removeCompany = async (id: number) => {
    try {
      await deleteCompany(id);
      fetchCompanies();
    } catch (error) {
      console.error('Error deleting company:', error);
    }
  };

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-black text-gray-800 dark:text-white uppercase tracking-tight">Entidades Emissoras</h1>
          <p className="text-gray-500 dark:text-slate-400">Cadastre suas empresas para emitir romaneios profissionais.</p>
        </div>
        <button 
          onClick={() => setIsAdding(true)}
          className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 dark:shadow-none"
        >
          <Plus size={20} /> Adicionar Empresa
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {loading && <p className="text-center col-span-full">Carregando empresas...</p>}
        {!loading && companies.map(c => (
          <div key={c.id} className="bg-white dark:bg-slate-900 rounded-3xl border border-gray-100 dark:border-slate-800 p-6 shadow-sm hover:shadow-xl dark:hover:bg-slate-800/50 transition-all group flex flex-col">
            <div className="flex justify-between items-start mb-6">
              <div className="flex items-center gap-4">
                {c.logoUrl ? (
                  <img src={c.logoUrl} alt="Logo" className="w-16 h-16 object-contain border border-gray-100 dark:border-slate-700 rounded-xl" />
                ) : (
                  <div className="w-16 h-16 bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center rounded-xl text-indigo-400">
                    <Building2 size={32} />
                  </div>
                )}
                <div>
                  <h3 className="font-black text-gray-800 dark:text-slate-100 uppercase leading-tight">{c.name}</h3>
                  <span className="text-xs text-gray-400 dark:text-slate-500 font-bold uppercase tracking-wider">{c.location}</span>
                </div>
              </div>
              <button 
                onClick={() => c.id && removeCompany(c.id)}
                className="text-gray-200 dark:text-slate-700 hover:text-red-500 p-2 transition-colors"
              >
                <Trash2 size={20} />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-slate-400">
                  <MapPin size={14} className="text-indigo-400" />
                  <span className="truncate">{c.address}</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-slate-400">
                  <Phone size={14} className="text-indigo-400" />
                  <span>{c.tel}</span>
                </div>
              </div>
              <div className="bg-gray-50 dark:bg-slate-800/50 p-3 rounded-2xl flex flex-col justify-center border border-transparent dark:border-slate-700">
                <div className="flex items-center gap-2 mb-1">
                  <CreditCard size={14} className="text-indigo-400" />
                  <span className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase">PIX</span>
                </div>
                <span className="text-xs font-mono font-bold text-gray-700 dark:text-slate-300 truncate">{c.banking.pix}</span>
              </div>
            </div>

            <div className="mt-auto pt-4 border-t border-gray-50 dark:border-slate-800 flex justify-between items-center text-[10px] font-bold text-gray-300 dark:text-slate-600 uppercase">
              <span>Ag: {c.banking.agency}</span>
              <span>Cc: {c.banking.account}</span>
              <span>{c.banking.bank}</span>
            </div>
          </div>
        ))}
        {companies.length === 0 && (
          <div className="col-span-full py-32 text-center text-gray-300 dark:text-slate-700 border-2 border-dashed border-gray-100 dark:border-slate-800 rounded-[40px] bg-white dark:bg-slate-900 transition-colors">
            <Building2 size={48} className="mx-auto mb-4 opacity-20" />
            <p className="font-bold">Nenhuma empresa cadastrada.</p>
            <p className="text-sm">Cadastre pelo menos uma empresa para começar a gerar romaneios.</p>
          </div>
        )}
      </div>

      {isAdding && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-[100] p-4">
          <div className="bg-white dark:bg-slate-900 rounded-[40px] shadow-2xl w-full max-w-4xl overflow-hidden animate-in fade-in zoom-in duration-300 transition-colors">
            <div className="p-8 border-b border-gray-100 dark:border-slate-800 flex justify-between items-center bg-white dark:bg-slate-900 transition-colors">
              <h3 className="text-xl font-black text-indigo-900 dark:text-indigo-400 uppercase tracking-tight flex items-center gap-3">
                <Building2 className="text-indigo-600 dark:text-indigo-500" /> Configurar Empresa
              </h3>
              <button onClick={() => setIsAdding(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-slate-300">
                <X size={24} />
              </button>
            </div>
            
            <div className="p-8 grid grid-cols-1 md:grid-cols-3 gap-8 max-h-[70vh] overflow-y-auto bg-white dark:bg-slate-900 transition-colors">
              <div className="md:col-span-1">
                <label className="block text-xs font-bold text-gray-400 dark:text-slate-500 uppercase mb-3">Logomarca</label>
                <div 
                  onClick={() => fileInputRef.current?.click()}
                  className="aspect-square border-2 border-dashed border-gray-100 dark:border-slate-800 rounded-3xl flex flex-col items-center justify-center cursor-pointer hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-all overflow-hidden bg-gray-50 dark:bg-slate-800/30 group"
                >
                   {formData.logoUrl ? (
                     <img src={formData.logoUrl} className="w-full h-full object-contain" alt="Preview" />
                   ) : (
                     <div className="text-center p-4">
                        <Upload className="mx-auto mb-2 text-indigo-200 dark:text-slate-700 group-hover:text-indigo-400 transition-colors" size={40} />
                        <span className="text-xs font-bold text-gray-300 dark:text-slate-600 group-hover:text-indigo-300">JPG ou PNG</span>
                     </div>
                   )}
                   <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleLogoUpload} />
                </div>
              </div>

              <div className="md:col-span-2 space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="block text-xs font-bold text-gray-500 dark:text-slate-500 uppercase mb-1">Razão Social / Nome Fantasia</label>
                    <input 
                      type="text" 
                      className="w-full p-3 border border-gray-100 dark:border-slate-700 rounded-2xl bg-gray-50 dark:bg-slate-800 focus:bg-white dark:focus:bg-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-gray-900 dark:text-white transition-all"
                      value={formData.name}
                      onChange={e => setFormData({...formData, name: e.target.value.toUpperCase()})}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 dark:text-slate-500 uppercase mb-1">Unidade / Localização</label>
                    <input 
                      type="text" 
                      className="w-full p-3 border border-gray-100 dark:border-slate-700 rounded-2xl bg-gray-50 dark:bg-slate-800 focus:bg-white dark:focus:bg-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none text-gray-900 dark:text-white transition-all"
                      value={formData.location}
                      onChange={e => setFormData({...formData, location: e.target.value.toUpperCase()})}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 dark:text-slate-500 uppercase mb-1">Telefone</label>
                    <input 
                      type="text" 
                      className="w-full p-3 border border-gray-100 dark:border-slate-700 rounded-2xl bg-gray-50 dark:bg-slate-800 focus:bg-white dark:focus:bg-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none text-gray-900 dark:text-white transition-all"
                      value={formData.tel}
                      onChange={e => setFormData({...formData, tel: e.target.value})}
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs font-bold text-gray-500 dark:text-slate-500 uppercase mb-1">Endereço Fiscal</label>
                    <input 
                      type="text" 
                      className="w-full p-3 border border-gray-100 dark:border-slate-700 rounded-2xl bg-gray-50 dark:bg-slate-800 focus:bg-white dark:focus:bg-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none text-gray-900 dark:text-white transition-all"
                      value={formData.address}
                      onChange={e => setFormData({...formData, address: e.target.value.toUpperCase()})}
                    />
                  </div>
                </div>

                <div className="p-6 bg-gray-50 dark:bg-slate-800/50 rounded-[32px] border border-gray-100 dark:border-slate-700 space-y-4">
                  <h4 className="text-xs font-black text-indigo-400 uppercase flex items-center gap-2">
                    <CreditCard size={14} /> Dados de Recebimento
                  </h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2">
                      <label className="block text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase mb-1">Chave PIX</label>
                      <input 
                        type="text" 
                        className="w-full p-2.5 border border-gray-200 dark:border-slate-700 rounded-xl outline-none bg-white dark:bg-slate-800 text-gray-900 dark:text-white transition-all"
                        value={formData.banking?.pix}
                        onChange={e => setFormData({...formData, banking: {...formData.banking!, pix: e.target.value}})}
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase mb-1">Banco</label>
                      <input 
                        type="text" 
                        className="w-full p-2.5 border border-gray-200 dark:border-slate-700 rounded-xl outline-none bg-white dark:bg-slate-800 text-gray-900 dark:text-white transition-all"
                        value={formData.banking?.bank}
                        onChange={e => setFormData({...formData, banking: {...formData.banking!, bank: e.target.value.toUpperCase()}})}
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase mb-1">Titular</label>
                      <input 
                        type="text" 
                        className="w-full p-2.5 border border-gray-200 dark:border-slate-700 rounded-xl outline-none bg-white dark:bg-slate-800 text-gray-900 dark:text-white transition-all"
                        value={formData.banking?.owner}
                        onChange={e => setFormData({...formData, banking: {...formData.banking!, owner: e.target.value.toUpperCase()}})}
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase mb-1">Agência</label>
                      <input 
                        type="text" 
                        className="w-full p-2.5 border border-gray-200 dark:border-slate-700 rounded-xl outline-none bg-white dark:bg-slate-800 text-gray-900 dark:text-white transition-all"
                        value={formData.banking?.agency}
                        onChange={e => setFormData({...formData, banking: {...formData.banking!, agency: e.target.value}})}
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase mb-1">Conta</label>
                      <input 
                        type="text" 
                        className="w-full p-2.5 border border-gray-200 dark:border-slate-700 rounded-xl outline-none bg-white dark:bg-slate-800 text-gray-900 dark:text-white transition-all"
                        value={formData.banking?.account}
                        onChange={e => setFormData({...formData, banking: {...formData.banking!, account: e.target.value}})}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-8 bg-gray-50 dark:bg-slate-800 border-t border-gray-100 dark:border-slate-800 flex gap-4 transition-colors">
               <button 
                onClick={() => setIsAdding(false)}
                className="flex-1 py-4 rounded-2xl text-gray-500 dark:text-slate-400 font-black uppercase tracking-widest hover:bg-gray-200 dark:hover:bg-slate-700 transition-all"
              >
                Cancelar
              </button>
              <button 
                onClick={handleSave}
                className="flex-1 py-4 rounded-2xl bg-indigo-600 text-white font-black uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100 dark:shadow-none"
              >
                Cadastrar Empresa
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CompanyManager;
