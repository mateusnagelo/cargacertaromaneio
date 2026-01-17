
import React, { useState, useRef, useEffect } from 'react';
import { Plus, Building2, Trash2, Upload, X, CreditCard, MapPin, Phone, Edit3, Search, Info } from 'lucide-react';
import { CompanyInfo } from '../types';
import { getCompanies, addCompany, deleteCompany, updateCompany, fetchCnpjWsCompany } from '../api/companies';

const CompanyManager: React.FC = () => {
  const normalizeDoc = (v: unknown) => String(v ?? '').replace(/\D/g, '');
  const [companies, setCompanies] = useState<CompanyInfo[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [editingCompanyId, setEditingCompanyId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CompanyInfo | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(true);
  const [cnpjLookupLoading, setCnpjLookupLoading] = useState(false);
  const [cnpjLookupError, setCnpjLookupError] = useState<string | null>(null);
  const cnpjLookupControllerRef = useRef<AbortController | null>(null);
  
  const [formData, setFormData] = useState<Partial<CompanyInfo>>({
    name: '',
    cnpj: '',
    ie: '',
    location: '',
    address: '',
    cep: '',
    tel: '',
    fantasyName: '',
    email: '',
    status: '',
    openingDate: '',
    legalNature: '',
    capitalSocial: null,
    cnaeMainCode: '',
    cnaeMainDescription: '',
    cnpjWsPayload: null,
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

  const resetForm = () => {
    setFormData({
      name: '',
      cnpj: '',
      ie: '',
      location: '',
      address: '',
      cep: '',
      tel: '',
      fantasyName: '',
      email: '',
      status: '',
      openingDate: '',
      legalNature: '',
      capitalSocial: null,
      cnaeMainCode: '',
      cnaeMainDescription: '',
      cnpjWsPayload: null,
      logoUrl: '',
      banking: { bank: '', pix: '', type: 'CORRENTE', agency: '', account: '', owner: '' },
    });
    setCnpjLookupError(null);
  };

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
      const doc = normalizeDoc(formData.cnpj);
      if (!editingCompanyId && doc && (doc.length === 11 || doc.length === 14)) {
        const dup = companies.find((c) => normalizeDoc(c.cnpj) === doc);
        if (dup) {
          const ok = window.confirm(
            `Este CNPJ/CPF já possui cadastro no sistema (${dup.name || 'Sem nome'}). Deseja sobrescrever o cadastro existente?`
          );
          if (!ok) return;
          const payload = {
            name: formData.name,
            cnpj: doc,
            ie: formData.ie || '',
            location: formData.location || '',
            address: formData.address || '',
            cep: formData.cep || '',
            tel: formData.tel || '',
            fantasyName: formData.fantasyName || '',
            email: formData.email || '',
            status: formData.status || '',
            openingDate: formData.openingDate || '',
            legalNature: formData.legalNature || '',
            capitalSocial: formData.capitalSocial ?? null,
            cnaeMainCode: formData.cnaeMainCode || '',
            cnaeMainDescription: formData.cnaeMainDescription || '',
            cnpjWsPayload: formData.cnpjWsPayload ?? null,
            logoUrl: formData.logoUrl || '',
            banking: formData.banking as any,
          };

          await updateCompany(String(dup.id), payload as any);
          fetchCompanies();
          setIsAdding(false);
          setEditingCompanyId(null);
          resetForm();
          return;
        }
      }

      const payload = {
        name: formData.name,
        cnpj: doc || formData.cnpj || '',
        ie: formData.ie || '',
        location: formData.location || '',
        address: formData.address || '',
        cep: formData.cep || '',
        tel: formData.tel || '',
        fantasyName: formData.fantasyName || '',
        email: formData.email || '',
        status: formData.status || '',
        openingDate: formData.openingDate || '',
        legalNature: formData.legalNature || '',
        capitalSocial: formData.capitalSocial ?? null,
        cnaeMainCode: formData.cnaeMainCode || '',
        cnaeMainDescription: formData.cnaeMainDescription || '',
        cnpjWsPayload: formData.cnpjWsPayload ?? null,
        logoUrl: formData.logoUrl || '',
        banking: formData.banking as any,
      };

      if (editingCompanyId) {
        await updateCompany(editingCompanyId, payload as any);
      } else {
        await addCompany(payload as any);
      }
      fetchCompanies();
      setIsAdding(false);
      setEditingCompanyId(null);
      resetForm();
    } catch (error) {
      console.error('Error saving company:', error);
      const message = error instanceof Error ? error.message : 'Erro desconhecido';
      alert(`${editingCompanyId ? 'Erro ao atualizar empresa' : 'Erro ao cadastrar empresa'}: ${message}`);
    }
  };

  const removeCompany = async (id: string) => {
    try {
      await deleteCompany(id);
      fetchCompanies();
    } catch (error) {
      console.error('Error deleting company:', error);
    }
  };

  const confirmDeleteCompany = async () => {
    if (!deleteTarget?.id) return;
    setDeleteLoading(true);
    try {
      await removeCompany(String(deleteTarget.id));
      setDeleteTarget(null);
    } finally {
      setDeleteLoading(false);
    }
  };

  const openAdd = () => {
    setEditingCompanyId(null);
    resetForm();
    setIsAdding(true);
  };

  const openEdit = (company: CompanyInfo) => {
    setEditingCompanyId(String(company.id));
    setFormData({
      ...company,
      banking: company.banking || { bank: '', pix: '', type: 'CORRENTE', agency: '', account: '', owner: '' },
    });
    setCnpjLookupError(null);
    setIsAdding(true);
  };

  const handleCnpjLookup = async () => {
    const cnpjRaw = String(formData.cnpj || '');
    const cnpj = cnpjRaw.replace(/\D/g, '');
    if (cnpj.length !== 14) {
      setCnpjLookupError('Informe um CNPJ com 14 dígitos.');
      return;
    }

    cnpjLookupControllerRef.current?.abort();
    const controller = new AbortController();
    cnpjLookupControllerRef.current = controller;

    setCnpjLookupLoading(true);
    setCnpjLookupError(null);
    try {
      const data: any = await fetchCnpjWsCompany(cnpj, controller.signal);

      const razaoSocial = String(data?.razao_social ?? '').trim();
      const nomeFantasia = String(data?.nome_fantasia ?? '').trim();
      const estabelecimento = data?.estabelecimento ?? {};

      const logradouro = String(estabelecimento?.logradouro ?? '').trim();
      const numero = String(estabelecimento?.numero ?? '').trim();
      const complemento = String(estabelecimento?.complemento ?? '').trim();
      const bairro = String(estabelecimento?.bairro ?? '').trim();
      const cidade = String(estabelecimento?.cidade?.nome ?? estabelecimento?.cidade ?? '').trim();
      const uf = String(estabelecimento?.estado?.sigla ?? estabelecimento?.estado?.uf ?? estabelecimento?.uf ?? '').trim();
      const cep = String(estabelecimento?.cep ?? '').trim();
      const tel = String(estabelecimento?.telefone1 ?? estabelecimento?.telefone_1 ?? estabelecimento?.telefone ?? '').trim();
      const email = String(estabelecimento?.email ?? data?.email ?? '').trim();
      const status = String(estabelecimento?.situacao_cadastral ?? data?.situacao_cadastral ?? '').trim();
      const openingDate = String(estabelecimento?.data_inicio_atividade ?? data?.data_inicio_atividade ?? '').trim();
      const legalNature = String(data?.natureza_juridica?.descricao ?? data?.natureza_juridica ?? '').trim();
      const capitalSocialRaw = data?.capital_social ?? data?.capitalSocial;
      const capitalSocial = capitalSocialRaw === undefined || capitalSocialRaw === null || capitalSocialRaw === '' ? null : Number(capitalSocialRaw);

      const activity = Array.isArray(estabelecimento?.atividade_principal) ? estabelecimento.atividade_principal[0] : estabelecimento?.atividade_principal;
      const cnaeMainCode = String(activity?.subclasse ?? activity?.id ?? '').trim();
      const cnaeMainDescription = String(activity?.descricao ?? '').trim();

      const inscricoes = Array.isArray(estabelecimento?.inscricoes_estaduais) ? estabelecimento.inscricoes_estaduais : [];
      const ieFromApi = String(inscricoes?.[0]?.inscricao_estadual ?? '').trim();

      const addressParts = [
        [logradouro, numero].filter(Boolean).join(', '),
        complemento,
        bairro ? `- ${bairro}` : '',
        cidade || uf ? `- ${cidade}${uf ? `/${uf}` : ''}` : '',
      ].filter(Boolean);
      const address = addressParts.join(' ').replace(/\s+/g, ' ').trim();

      setFormData((prev) => ({
        ...prev,
        cnpj,
        name: (razaoSocial || prev.name || '').toUpperCase(),
        fantasyName: (nomeFantasia || prev.fantasyName || '').toUpperCase(),
        ie: ieFromApi || prev.ie || '',
        address: (address || prev.address || '').toUpperCase(),
        cep: cep || prev.cep || '',
        tel: tel || prev.tel || '',
        email: email || prev.email || '',
        status: (status || prev.status || '').toUpperCase(),
        openingDate: openingDate || prev.openingDate || '',
        legalNature: (legalNature || prev.legalNature || '').toUpperCase(),
        capitalSocial: Number.isFinite(capitalSocial as any) ? (capitalSocial as any) : prev.capitalSocial ?? null,
        cnaeMainCode: cnaeMainCode || prev.cnaeMainCode || '',
        cnaeMainDescription: (cnaeMainDescription || prev.cnaeMainDescription || '').toUpperCase(),
        cnpjWsPayload: data,
      }));
    } catch (error: any) {
      if (error?.name === 'AbortError' || String(error?.message || '').includes('aborted')) return;
      setCnpjLookupError(error instanceof Error ? error.message : 'Falha ao consultar CNPJ.');
    } finally {
      setCnpjLookupLoading(false);
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
          onClick={openAdd}
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
              <div className="flex items-center gap-1">
                <button
                  onClick={() => openEdit(c)}
                  className="text-gray-200 dark:text-slate-700 hover:text-indigo-500 p-2 transition-colors"
                >
                  <Edit3 size={20} />
                </button>
                <button 
                  onClick={() => setDeleteTarget(c)}
                  className="text-gray-200 dark:text-slate-700 hover:text-red-500 p-2 transition-colors"
                >
                  <Trash2 size={20} />
                </button>
              </div>
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
                <Building2 className="text-indigo-600 dark:text-indigo-500" /> {editingCompanyId ? 'Editar Empresa' : 'Configurar Empresa'}
              </h3>
              <button
                onClick={() => {
                  setIsAdding(false);
                  setEditingCompanyId(null);
                  resetForm();
                }}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-slate-300"
              >
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
                  <div>
                    <label className="block text-xs font-bold text-gray-500 dark:text-slate-500 uppercase mb-1">CNPJ</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        className="flex-1 p-3 border border-gray-100 dark:border-slate-700 rounded-2xl bg-gray-50 dark:bg-slate-800 focus:bg-white dark:focus:bg-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none text-gray-900 dark:text-white transition-all"
                        value={formData.cnpj}
                        onChange={(e) => setFormData({ ...formData, cnpj: e.target.value })}
                      />
                      <button
                        type="button"
                        onClick={handleCnpjLookup}
                        disabled={cnpjLookupLoading}
                        aria-label="Consultar CNPJ"
                        title="Consultar CNPJ"
                        className="w-12 h-12 inline-flex items-center justify-center rounded-2xl bg-indigo-600 text-white hover:bg-indigo-700 transition-all disabled:opacity-60 disabled:hover:bg-indigo-600"
                      >
                        {cnpjLookupLoading ? '...' : <Search size={18} />}
                      </button>
                    </div>
                    {cnpjLookupError && (
                      <div className="mt-1 text-[10px] font-bold text-red-500">{cnpjLookupError}</div>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 dark:text-slate-500 uppercase mb-1">Inscrição Estadual</label>
                    <input
                      type="text"
                      className="w-full p-3 border border-gray-100 dark:border-slate-700 rounded-2xl bg-gray-50 dark:bg-slate-800 focus:bg-white dark:focus:bg-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none text-gray-900 dark:text-white transition-all"
                      value={formData.ie}
                      onChange={(e) => setFormData({ ...formData, ie: e.target.value })}
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs font-bold text-gray-500 dark:text-slate-500 uppercase mb-1">CEP</label>
                    <input
                      type="text"
                      className="w-full p-3 border border-gray-100 dark:border-slate-700 rounded-2xl bg-gray-50 dark:bg-slate-800 focus:bg-white dark:focus:bg-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none text-gray-900 dark:text-white transition-all"
                      value={formData.cep}
                      onChange={(e) => setFormData({ ...formData, cep: e.target.value })}
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
                    Dados do CNPJ
                  </h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2">
                      <label className="block text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase mb-1">Nome Fantasia</label>
                      <input
                        type="text"
                        className="w-full p-2.5 border border-gray-200 dark:border-slate-700 rounded-xl outline-none bg-white dark:bg-slate-800 text-gray-900 dark:text-white transition-all"
                        value={formData.fantasyName || ''}
                        onChange={(e) => setFormData({ ...formData, fantasyName: e.target.value.toUpperCase() })}
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase mb-1">E-mail</label>
                      <input
                        type="email"
                        className="w-full p-2.5 border border-gray-200 dark:border-slate-700 rounded-xl outline-none bg-white dark:bg-slate-800 text-gray-900 dark:text-white transition-all"
                        value={formData.email || ''}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase mb-1">Situação</label>
                      <input
                        type="text"
                        className="w-full p-2.5 border border-gray-200 dark:border-slate-700 rounded-xl outline-none bg-white dark:bg-slate-800 text-gray-900 dark:text-white transition-all"
                        value={formData.status || ''}
                        onChange={(e) => setFormData({ ...formData, status: e.target.value.toUpperCase() })}
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase mb-1">Abertura</label>
                      <input
                        type="text"
                        className="w-full p-2.5 border border-gray-200 dark:border-slate-700 rounded-xl outline-none bg-white dark:bg-slate-800 text-gray-900 dark:text-white transition-all"
                        value={formData.openingDate || ''}
                        onChange={(e) => setFormData({ ...formData, openingDate: e.target.value })}
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase mb-1">Natureza Jurídica</label>
                      <input
                        type="text"
                        className="w-full p-2.5 border border-gray-200 dark:border-slate-700 rounded-xl outline-none bg-white dark:bg-slate-800 text-gray-900 dark:text-white transition-all"
                        value={formData.legalNature || ''}
                        onChange={(e) => setFormData({ ...formData, legalNature: e.target.value.toUpperCase() })}
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase mb-1">Capital Social</label>
                      <input
                        type="number"
                        step="0.01"
                        className="w-full p-2.5 border border-gray-200 dark:border-slate-700 rounded-xl outline-none bg-white dark:bg-slate-800 text-gray-900 dark:text-white transition-all"
                        value={formData.capitalSocial ?? ''}
                        onChange={(e) => {
                          const v = e.target.value;
                          setFormData({ ...formData, capitalSocial: v === '' ? null : Number(v) });
                        }}
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase mb-1">CNAE Principal</label>
                      <input
                        type="text"
                        className="w-full p-2.5 border border-gray-200 dark:border-slate-700 rounded-xl outline-none bg-white dark:bg-slate-800 text-gray-900 dark:text-white transition-all"
                        value={formData.cnaeMainCode || ''}
                        onChange={(e) => setFormData({ ...formData, cnaeMainCode: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase mb-1">Descrição CNAE</label>
                      <input
                        type="text"
                        className="w-full p-2.5 border border-gray-200 dark:border-slate-700 rounded-xl outline-none bg-white dark:bg-slate-800 text-gray-900 dark:text-white transition-all"
                        value={formData.cnaeMainDescription || ''}
                        onChange={(e) => setFormData({ ...formData, cnaeMainDescription: e.target.value.toUpperCase() })}
                      />
                    </div>
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
                onClick={() => {
                  setIsAdding(false);
                  setEditingCompanyId(null);
                  resetForm();
                }}
                className="flex-1 py-4 rounded-2xl text-gray-500 dark:text-slate-400 font-black uppercase tracking-widest hover:bg-gray-200 dark:hover:bg-slate-700 transition-all"
              >
                Cancelar
              </button>
              <button 
                onClick={handleSave}
                className="flex-1 py-4 rounded-2xl bg-indigo-600 text-white font-black uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100 dark:shadow-none"
              >
                {editingCompanyId ? 'Salvar Alterações' : 'Cadastrar Empresa'}
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
              <h3 className="text-xl font-black text-gray-800 dark:text-white uppercase tracking-tight leading-none">Excluir Empresa</h3>
              <p className="text-[10px] text-red-600 dark:text-red-400 font-black uppercase mt-2 tracking-widest">Ação Irreversível</p>
            </div>

            <div className="p-6 md:p-8 space-y-4 overflow-y-auto">
              <div className="bg-gray-50 dark:bg-slate-800/50 border border-gray-100 dark:border-slate-800 rounded-3xl p-5">
                <p className="text-xs font-black text-gray-900 dark:text-white uppercase truncate">
                  {String(deleteTarget.name || '')}
                </p>
                <p className="text-[10px] font-bold text-gray-500 dark:text-slate-400 uppercase truncate mt-1">
                  {String(deleteTarget.location || '')}
                </p>
              </div>

              <div className="flex items-start gap-3 p-4 rounded-2xl bg-yellow-50/60 dark:bg-yellow-900/20 border border-yellow-100 dark:border-yellow-900/30">
                <div className="text-yellow-700 dark:text-yellow-300 pt-0.5"><Info size={18} /></div>
                <div className="text-[11px] font-bold text-yellow-800 dark:text-yellow-200">
                  Ao excluir esta empresa, as informações de emissão e dados bancários serão removidos. Romaneios vinculados podem ficar sem referência. Deseja continuar?
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
                onClick={confirmDeleteCompany}
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

export default CompanyManager;
