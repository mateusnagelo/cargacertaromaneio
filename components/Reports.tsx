import React, { useEffect, useMemo, useRef, useState } from 'react';
import { BarChart3, FileDown, Filter, RotateCcw, Search } from 'lucide-react';
import { getCompanies } from '../api/companies';
import { getCustomers } from '../api/customers';
import { getRomaneios } from '../api/romaneios';
import { CompanyInfo, Customer, RomaneioData, RomaneioStatus } from '../types';
import { formatCurrency, formatDate, toLocalDateInput } from '../utils';

type DateField = 'saleDate' | 'emissionDate';

type SortKey =
  | 'id_desc'
  | 'id_asc'
  | 'date_desc'
  | 'date_asc'
  | 'total_desc'
  | 'total_asc'
  | 'number_desc'
  | 'number_asc';

const Reports: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [romaneios, setRomaneios] = useState<RomaneioData[]>([]);
  const [companies, setCompanies] = useState<CompanyInfo[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);

  const [dateField, setDateField] = useState<DateField>('saleDate');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [status, setStatus] = useState<RomaneioStatus | 'TODOS'>('TODOS');
  const [companyId, setCompanyId] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [minTotal, setMinTotal] = useState('');
  const [maxTotal, setMaxTotal] = useState('');
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('id_desc');

  const reportRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const signal = controller.signal;

    const run = async () => {
      try {
        const [c, cu] = await Promise.all([getCompanies(signal), getCustomers(signal)]);
        setCompanies(c);
        setCustomers(cu);
      } catch (e: any) {
        if (e?.name !== 'AbortError') {
          alert(`Erro ao carregar relatórios: ${String(e?.message || e)}`);
        }
      }
    };

    run();
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const signal = controller.signal;

    const parseAmount = (v: string) => {
      const s = String(v ?? '').trim();
      if (!s) return null;
      const n = Number(s.replace(',', '.'));
      return Number.isFinite(n) ? n : null;
    };

    const serverSearch = (() => {
      const term = search.trim();
      return /^\d+$/.test(term) ? term : '';
    })();

    const t = setTimeout(async () => {
      try {
        setLoading(true);
        const r = await getRomaneios(signal, {
          status,
          companyId: companyId || undefined,
          customerId: customerId || undefined,
          minTotal: parseAmount(minTotal),
          maxTotal: parseAmount(maxTotal),
          search: serverSearch || undefined,
          mode: 'list',
        });
        setRomaneios(r);
      } catch (e: any) {
        if (e?.name !== 'AbortError') {
          alert(`Erro ao carregar romaneios: ${String(e?.message || e)}`);
        }
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => {
      controller.abort();
      clearTimeout(t);
    };
  }, [status, companyId, customerId, minTotal, maxTotal, search]);

  const computeTotal = (r: RomaneioData) => {
    const productsTotal = Array.isArray(r.products)
      ? r.products.reduce((acc, p) => acc + (Number(p?.quantity || 0) * Number(p?.unitValue || 0)), 0)
      : 0;
    const expensesTotal = Array.isArray(r.expenses)
      ? r.expenses.reduce((acc, e) => acc + (Number((e as any)?.total) || 0), 0)
      : 0;
    const itemsTotal = productsTotal + expensesTotal;
    const dbTotal = Number((r as any)?.montante_total ?? (r as any)?.total_value ?? 0) || 0;
    return itemsTotal > 0 ? itemsTotal : dbTotal;
  };

  const getDateValue = (r: RomaneioData) => {
    const v = (r as any)?.[dateField] ?? (dateField === 'saleDate' ? (r as any)?.emissionDate : (r as any)?.saleDate);
    return typeof v === 'string' ? v : '';
  };

  const toOptionalInt = (v: unknown) => {
    const s = String(v ?? '').trim();
    if (!s) return null;
    if (!/^\d+$/.test(s)) return null;
    const n = Number(s);
    if (!Number.isFinite(n)) return null;
    return n;
  };

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    const min = minTotal.trim() ? Number(String(minTotal).replace(',', '.')) : null;
    const max = maxTotal.trim() ? Number(String(maxTotal).replace(',', '.')) : null;

    const passesDate = (d: string) => {
      if (!d) return !fromDate && !toDate;
      if (fromDate && d < fromDate) return false;
      if (toDate && d > toDate) return false;
      return true;
    };

    const matchesTerm = (r: RomaneioData) => {
      if (!term) return true;
      const n = String(r.number ?? '').toLowerCase();
      const clientName = String(r.client?.name ?? r.customer?.name ?? '').toLowerCase();
      const companyName = String(r.company?.name ?? '').toLowerCase();
      return n.includes(term) || clientName.includes(term) || companyName.includes(term);
    };

    return (romaneios || [])
      .filter((r) => {
        if (!r) return false;
        if (status !== 'TODOS' && (r.status || 'PENDENTE') !== status) return false;
        if (companyId) {
          const rid = String((r.company as any)?.id ?? (r as any)?.company_id ?? '');
          if (rid !== String(companyId)) return false;
        }
        if (customerId) {
          const rid = String((r.customer as any)?.id ?? (r.client as any)?.id ?? (r as any)?.customer_id ?? '');
          if (rid !== String(customerId)) return false;
        }

        const d = getDateValue(r);
        if (!passesDate(d)) return false;

        const total = computeTotal(r);
        if (min !== null && Number.isFinite(min) && total < min) return false;
        if (max !== null && Number.isFinite(max) && total > max) return false;

        if (!matchesTerm(r)) return false;
        return true;
      })
      .sort((a, b) => {
        const aDate = getDateValue(a);
        const bDate = getDateValue(b);
        const aTotal = computeTotal(a);
        const bTotal = computeTotal(b);
        const aNum = String(a.number ?? '');
        const bNum = String(b.number ?? '');
        const aId = toOptionalInt((a as any)?.id);
        const bId = toOptionalInt((b as any)?.id);

        switch (sortKey) {
          case 'id_asc': {
            if (aId !== null && bId !== null) return aId - bId;
            if (aId !== null) return -1;
            if (bId !== null) return 1;
            return 0;
          }
          case 'id_desc': {
            if (aId !== null && bId !== null) return bId - aId;
            if (aId !== null) return -1;
            if (bId !== null) return 1;
            return 0;
          }
          case 'date_asc':
            return aDate.localeCompare(bDate);
          case 'date_desc':
            return bDate.localeCompare(aDate);
          case 'total_asc':
            return aTotal - bTotal;
          case 'total_desc':
            return bTotal - aTotal;
          case 'number_asc':
            return aNum.localeCompare(bNum, undefined, { numeric: true, sensitivity: 'base' });
          case 'number_desc':
            return bNum.localeCompare(aNum, undefined, { numeric: true, sensitivity: 'base' });
          default:
            return 0;
        }
      });
  }, [companyId, customerId, dateField, fromDate, maxTotal, minTotal, romaneios, search, sortKey, status, toDate]);

  const summary = useMemo(() => {
    const totalValue = filtered.reduce((acc, r) => acc + computeTotal(r), 0);
    const byStatus = filtered.reduce(
      (acc, r) => {
        const s = (r.status || 'PENDENTE') as RomaneioStatus;
        acc[s] = (acc[s] || 0) + computeTotal(r);
        return acc;
      },
      {} as Record<RomaneioStatus, number>
    );
    return { totalValue, byStatus, count: filtered.length };
  }, [filtered]);

  const clearFilters = () => {
    setDateField('saleDate');
    setFromDate('');
    setToDate('');
    setStatus('TODOS');
    setCompanyId('');
    setCustomerId('');
    setMinTotal('');
    setMaxTotal('');
    setSearch('');
    setSortKey('id_desc');
  };

  const exportPdf = async () => {
    const container = reportRef.current;
    if (!container) return;

    try {
      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import('html2canvas'), import('jspdf')]);

      const canvas = await html2canvas(container, {
        backgroundColor: '#ffffff',
        scale: Math.max(2, Math.floor(window.devicePixelRatio || 1)),
        useCORS: true,
        logging: false,
        windowWidth: container.scrollWidth,
        windowHeight: container.scrollHeight,
      });

      const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 6;
      const availW = pageWidth - margin * 2;
      const availH = pageHeight - margin * 2;

      const imgWpx = canvas.width;
      const imgHpx = canvas.height;
      const pageHpx = Math.floor(imgWpx * (availH / availW));

      let y = 0;
      let first = true;
      while (y < imgHpx) {
        const sliceHpx = Math.min(pageHpx, imgHpx - y);
        const sliceCanvas = document.createElement('canvas');
        sliceCanvas.width = imgWpx;
        sliceCanvas.height = sliceHpx;
        const ctx = sliceCanvas.getContext('2d');
        if (!ctx) throw new Error('Falha ao preparar canvas do PDF');
        ctx.drawImage(canvas, 0, y, imgWpx, sliceHpx, 0, 0, imgWpx, sliceHpx);

        const imgData = sliceCanvas.toDataURL('image/jpeg', 0.92);
        const renderH = (sliceHpx * availW) / imgWpx;
        if (!first) pdf.addPage();
        pdf.addImage(imgData, 'JPEG', margin, margin, availW, renderH, undefined, 'FAST');
        first = false;
        y += sliceHpx;
      }

      const stamp = toLocalDateInput();
      pdf.save(`Relatorio_Romaneios_${stamp}.pdf`);
    } catch (e: any) {
      alert(`Erro ao exportar PDF: ${String(e?.message || e)}`);
    }
  };

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6 md:space-y-8 animate-in fade-in duration-500 pb-24 transition-colors">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-black text-gray-800 dark:text-white uppercase tracking-tight flex items-center gap-2">
            <BarChart3 size={22} className="text-blue-600 dark:text-blue-400" />
            Relatórios
          </h1>
          <p className="text-xs md:text-sm text-gray-500 dark:text-slate-400">Filtros avançados e exportação em PDF.</p>
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <button
            onClick={exportPdf}
            disabled={loading}
            className="flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-2.5 bg-orange-500 text-white rounded-xl hover:bg-orange-600 disabled:opacity-60 transition-all font-bold shadow-lg shadow-orange-100 dark:shadow-none"
          >
            <FileDown size={18} /> Salvar em PDF
          </button>
          <button
            onClick={clearFilters}
            className="flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-2.5 bg-white dark:bg-slate-900 text-gray-700 dark:text-slate-200 rounded-xl border border-gray-100 dark:border-slate-800 hover:bg-gray-50 dark:hover:bg-slate-800 transition-all font-bold"
          >
            <RotateCcw size={18} /> Limpar
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
        <div className="bg-white dark:bg-slate-900 p-4 rounded-[24px] border border-gray-100 dark:border-slate-800 shadow-sm">
          <p className="text-[10px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-widest">Registros</p>
          <p className="text-lg font-black text-gray-900 dark:text-white">{summary.count}</p>
        </div>
        <div className="bg-white dark:bg-slate-900 p-4 rounded-[24px] border border-gray-100 dark:border-slate-800 shadow-sm">
          <p className="text-[10px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-widest">Total</p>
          <p className="text-lg font-black text-green-600 dark:text-green-400">{formatCurrency(summary.totalValue)}</p>
        </div>
        <div className="bg-white dark:bg-slate-900 p-4 rounded-[24px] border border-gray-100 dark:border-slate-800 shadow-sm">
          <p className="text-[10px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-widest">Concluído</p>
          <p className="text-lg font-black text-blue-600 dark:text-blue-400">{formatCurrency(summary.byStatus['CONCLUÍDO'] || 0)}</p>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-[32px] border border-gray-100 dark:border-slate-800 shadow-xl shadow-gray-200/50 dark:shadow-none overflow-hidden transition-colors">
        <div className="p-4 md:p-6 border-b border-gray-50 dark:border-slate-800 bg-gray-50/30 dark:bg-slate-800/20">
          <div className="flex items-center gap-2 text-[10px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-widest mb-4">
            <Filter size={14} />
            Filtros
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
            <div className="md:col-span-4 relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-500" size={18} />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Nº, cliente ou empresa..."
                className="w-full pl-12 pr-4 py-3.5 bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 transition-all text-sm text-gray-900 dark:text-white"
              />
            </div>

            <div className="md:col-span-2">
              <select
                value={dateField}
                onChange={(e) => setDateField(e.target.value as DateField)}
                className="w-full px-4 py-3.5 bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 transition-all text-sm text-gray-900 dark:text-white"
              >
                <option value="saleDate">Data de Venda</option>
                <option value="emissionDate">Data de Emissão</option>
              </select>
            </div>

            <div className="md:col-span-2">
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="w-full px-4 py-3.5 bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 transition-all text-sm text-gray-900 dark:text-white"
              />
            </div>

            <div className="md:col-span-2">
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="w-full px-4 py-3.5 bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 transition-all text-sm text-gray-900 dark:text-white"
              />
            </div>

            <div className="md:col-span-2">
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as any)}
                className="w-full px-4 py-3.5 bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 transition-all text-sm text-gray-900 dark:text-white"
              >
                <option value="TODOS">Todos</option>
                <option value="PENDENTE">Pendente</option>
                <option value="CONCLUÍDO">Concluído</option>
                <option value="CANCELADO">Cancelado</option>
              </select>
            </div>

            <div className="md:col-span-4">
              <select
                value={companyId}
                onChange={(e) => setCompanyId(e.target.value)}
                className="w-full px-4 py-3.5 bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 transition-all text-sm text-gray-900 dark:text-white"
              >
                <option value="">Todas as empresas</option>
                {companies.map((c) => (
                  <option key={String(c.id)} value={String(c.id)}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="md:col-span-4">
              <select
                value={customerId}
                onChange={(e) => setCustomerId(e.target.value)}
                className="w-full px-4 py-3.5 bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 transition-all text-sm text-gray-900 dark:text-white"
              >
                <option value="">Todos os clientes</option>
                {customers.map((c) => (
                  <option key={String(c.id)} value={String(c.id)}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="md:col-span-2">
              <input
                value={minTotal}
                onChange={(e) => setMinTotal(e.target.value)}
                placeholder="Total mín."
                className="w-full px-4 py-3.5 bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 transition-all text-sm text-gray-900 dark:text-white"
              />
            </div>

            <div className="md:col-span-2">
              <input
                value={maxTotal}
                onChange={(e) => setMaxTotal(e.target.value)}
                placeholder="Total máx."
                className="w-full px-4 py-3.5 bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 transition-all text-sm text-gray-900 dark:text-white"
              />
            </div>

            <div className="md:col-span-4">
              <select
                value={sortKey}
                onChange={(e) => setSortKey(e.target.value as SortKey)}
                className="w-full px-4 py-3.5 bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 transition-all text-sm text-gray-900 dark:text-white"
              >
                <option value="id_desc">ID (desc)</option>
                <option value="id_asc">ID (asc)</option>
                <option value="date_desc">Data (desc)</option>
                <option value="date_asc">Data (asc)</option>
                <option value="total_desc">Total (desc)</option>
                <option value="total_asc">Total (asc)</option>
                <option value="number_desc">Número (desc)</option>
                <option value="number_asc">Número (asc)</option>
              </select>
            </div>
          </div>
        </div>

        <div className="p-4 md:p-6">
          {loading ? (
            <div className="text-sm font-bold text-gray-500 dark:text-slate-400">Carregando...</div>
          ) : filtered.length === 0 ? (
            <div className="text-sm font-bold text-gray-500 dark:text-slate-400">Nenhum registro encontrado.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px]">
                <thead>
                  <tr className="text-left text-[10px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-widest border-b border-gray-50 dark:border-slate-800">
                    <th className="py-4 pr-6">Nº</th>
                    <th className="py-4 pr-6">Empresa</th>
                    <th className="py-4 pr-6">Cliente</th>
                    <th className="py-4 pr-6">Data</th>
                    <th className="py-4 pr-6">Status</th>
                    <th className="py-4 text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r) => {
                    const d = getDateValue(r);
                    const s = (r.status || 'PENDENTE') as RomaneioStatus;
                    const total = computeTotal(r);
                    return (
                      <tr key={String(r.id)} className="border-b border-gray-50 dark:border-slate-800 text-sm">
                        <td className="py-4 pr-6 font-black text-gray-900 dark:text-white">{String(r.number ?? '')}</td>
                        <td className="py-4 pr-6 text-gray-700 dark:text-slate-300">{String(r.company?.name ?? '')}</td>
                        <td className="py-4 pr-6 text-gray-700 dark:text-slate-300">{String(r.client?.name ?? r.customer?.name ?? '')}</td>
                        <td className="py-4 pr-6 text-gray-600 dark:text-slate-400">{d ? formatDate(d) : '-'}</td>
                        <td className="py-4 pr-6 text-gray-600 dark:text-slate-400">{s}</td>
                        <td className="py-4 text-right font-black text-gray-900 dark:text-white">{formatCurrency(total)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <div className="absolute left-[-99999px] top-0">
        <div ref={reportRef} className="bg-white text-black w-[210mm] p-6">
          <div className="flex items-start justify-between border-b border-black pb-3 mb-4">
            <div>
              <div className="text-xl font-black uppercase">Relatório de Romaneios</div>
              <div className="text-[10px] font-bold uppercase tracking-widest text-gray-500">
                {dateField === 'saleDate' ? 'Data de Venda' : 'Data de Emissão'}
                {fromDate ? ` • De ${fromDate}` : ''}
                {toDate ? ` • Até ${toDate}` : ''}
                {status !== 'TODOS' ? ` • Status ${status}` : ''}
              </div>
              <div className="text-[10px] font-bold uppercase tracking-widest text-gray-500">
                {companyId ? `Empresa ${companies.find((c) => String(c.id) === String(companyId))?.name || companyId}` : 'Todas as empresas'}
                {' • '}
                {customerId ? `Cliente ${customers.find((c) => String(c.id) === String(customerId))?.name || customerId}` : 'Todos os clientes'}
              </div>
            </div>
            <div className="text-right">
              <div className="text-[10px] font-black uppercase tracking-widest text-gray-600">Gerado em</div>
              <div className="text-sm font-black">{new Date().toLocaleString()}</div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="border border-black p-3">
              <div className="text-[10px] font-black uppercase tracking-widest text-gray-600">Registros</div>
              <div className="text-lg font-black">{summary.count}</div>
            </div>
            <div className="border border-black p-3">
              <div className="text-[10px] font-black uppercase tracking-widest text-gray-600">Total</div>
              <div className="text-lg font-black">{formatCurrency(summary.totalValue)}</div>
            </div>
            <div className="border border-black p-3">
              <div className="text-[10px] font-black uppercase tracking-widest text-gray-600">Concluído</div>
              <div className="text-lg font-black">{formatCurrency(summary.byStatus['CONCLUÍDO'] || 0)}</div>
            </div>
          </div>

          <table className="w-full border-collapse text-[10px]">
            <thead>
              <tr className="border-y border-black bg-gray-100 text-left font-black uppercase">
                <th className="py-2 px-2">Nº</th>
                <th className="py-2 px-2">Empresa</th>
                <th className="py-2 px-2">Cliente</th>
                <th className="py-2 px-2">Data</th>
                <th className="py-2 px-2">Status</th>
                <th className="py-2 px-2 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => {
                const d = getDateValue(r);
                const s = (r.status || 'PENDENTE') as RomaneioStatus;
                const total = computeTotal(r);
                return (
                  <tr key={String(r.id)} className="border-b border-gray-200">
                    <td className="py-1 px-2 font-black">{String(r.number ?? '')}</td>
                    <td className="py-1 px-2">{String(r.company?.name ?? '')}</td>
                    <td className="py-1 px-2">{String(r.client?.name ?? r.customer?.name ?? '')}</td>
                    <td className="py-1 px-2">{d ? formatDate(d) : '-'}</td>
                    <td className="py-1 px-2">{s}</td>
                    <td className="py-1 px-2 text-right font-black">{formatCurrency(total)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Reports;
