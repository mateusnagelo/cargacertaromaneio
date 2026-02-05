import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Plus, DollarSign, Trash2, Search, X, Info, FileDown, Edit2, CheckCircle2, CircleDot } from 'lucide-react';
import { Customer, ProducerPayment, RomaneioData } from '../types';
import { formatCurrency, formatDate, toLocalDateInput } from '../utils';
import { addProducerPayment, deleteProducerPayment, getProducerPayments, updateProducerPayment } from '../api/producerPayments';
import { getRomaneioById, getRomaneios } from '../api/romaneios';
import { getProducers } from '../api/customers';
import pkg from '../package.json';

type RomaneioCompraOption = {
  id: string;
  number: string;
  producerId: string;
  producerName: string;
  totalDue: number;
};

const normalizeText = (v: unknown) => String(v ?? '').trim();
const roundCurrency = (v: number) => Math.round((Number(v) || 0) * 100) / 100;

const Financeiro: React.FC = () => {
  const [payments, setPayments] = useState<ProducerPayment[]>([]);
  const [romaneiosCompra, setRomaneiosCompra] = useState<RomaneioCompraOption[]>([]);
  const [producers, setProducers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadIssues, setLoadIssues] = useState<string[]>([]);

  const [searchTerm, setSearchTerm] = useState('');
  const [filterProducerId, setFilterProducerId] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const [isAdding, setIsAdding] = useState(false);
  const [editingPaymentId, setEditingPaymentId] = useState<string | null>(null);
  const [allowOpenDifference, setAllowOpenDifference] = useState(false);
  const [formData, setFormData] = useState<Omit<ProducerPayment, 'id' | 'created_at'>>({
    romaneioId: '',
    producerId: '',
    amount: 0,
    paidAt: toLocalDateInput(),
    method: '',
    reference: '',
    note: '',
  });

  const [deleteTarget, setDeleteTarget] = useState<ProducerPayment | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const [receiptTarget, setReceiptTarget] = useState<ProducerPayment | null>(null);
  const [receiptExportLoading, setReceiptExportLoading] = useState(false);
  const receiptRef = useRef<HTMLDivElement | null>(null);
  const dueFetchSeq = useRef(0);
  const [partialSuggestion, setPartialSuggestion] = useState<{
    romaneioId: string;
    producerId: string;
    amountPaid: number;
    remaining: number;
  } | null>(null);

  const producerNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of producers) map.set(String(p.id), String(p.name || '').trim());
    return map;
  }, [producers]);

  const romaneioById = useMemo(() => {
    const map = new Map<string, RomaneioCompraOption>();
    for (const r of romaneiosCompra) map.set(String(r.id), r);
    return map;
  }, [romaneiosCompra]);

  const totalPaidByRomaneioId = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of payments || []) {
      const id = String(p.romaneioId || '').trim();
      if (!id) continue;
      const prev = map.get(id) ?? 0;
      map.set(id, prev + (Number(p.amount) || 0));
    }
    return map;
  }, [payments]);

  const openCreate = () => {
    setEditingPaymentId(null);
    setAllowOpenDifference(false);
    setFormData({
      romaneioId: '',
      producerId: '',
      amount: 0,
      paidAt: toLocalDateInput(),
      method: '',
      reference: '',
      note: '',
    });
    setIsAdding(true);
  };

  const openEdit = (p: ProducerPayment) => {
    setEditingPaymentId(String(p.id || '').trim() || null);
    setAllowOpenDifference(false);
    setFormData({
      romaneioId: String(p.romaneioId || ''),
      producerId: String(p.producerId || ''),
      amount: Number(p.amount) || 0,
      paidAt: String(p.paidAt || '') || toLocalDateInput(),
      method: String(p.method || ''),
      reference: String(p.reference || ''),
      note: String(p.note || ''),
    });
    setIsAdding(true);
  };

  const refreshRomaneioDueIfNeeded = async (romaneioId: string) => {
    const id = String(romaneioId || '').trim();
    if (!id) return;
    const seq = ++dueFetchSeq.current;
    try {
      const full = await getRomaneioById(id);
      if (dueFetchSeq.current !== seq) return;
      const due = computeRomaneioTotalDue(full);
      setRomaneiosCompra((prev) => prev.map((r) => (String(r.id) === id ? { ...r, totalDue: due } : r)));
    } catch {
    }
  };

  const computeRomaneioTotalDue = (r: Partial<RomaneioData> | any): number => {
    const productsArr: any[] = Array.isArray((r as any)?.products) ? ((r as any).products as any[]) : [];
    const expensesArr: any[] = Array.isArray((r as any)?.expenses) ? ((r as any).expenses as any[]) : [];
    const hasItems = productsArr.length > 0 || expensesArr.length > 0;

    if (hasItems) {
      const productsTotal = productsArr.reduce((acc, p) => acc + (Number(p?.quantity || 0) * Number(p?.unitValue || 0)), 0);
      const expensesTotal = expensesArr.reduce((acc, e) => acc + (Number((e as any)?.total) || 0), 0);
      return roundCurrency(productsTotal - expensesTotal);
    }

    const dbTotal =
      Number((r as any)?.montante_total ?? (r as any)?.total_value ?? (r as any)?.total_amount ?? (r as any)?.totalAmount ?? 0) || 0;
    return roundCurrency(dbTotal);
  };

  const fetchAll = async (signal?: AbortSignal) => {
    setLoading(true);
    setLoadIssues([]);
    const results = await Promise.allSettled([
      getProducerPayments(signal),
      getRomaneios(signal, { kind: 'COMPRA', mode: 'list', limit: 250 }),
      getProducers(signal),
    ] as const);

    const issues: string[] = [];

    const paymentsRes = results[0];
    if (paymentsRes.status === 'fulfilled') {
      setPayments(paymentsRes.value || []);
    } else {
      setPayments([]);
      issues.push('Pagamentos não carregaram (verifique se a tabela producer_payments existe no Supabase).');
      console.error('Erro ao carregar pagamentos:', paymentsRes.reason);
    }

    const romaneiosRes = results[1];
    if (romaneiosRes.status === 'fulfilled') {
      const romOpts: RomaneioCompraOption[] = (romaneiosRes.value || [])
        .map((r: RomaneioData | any) => {
          const id = normalizeText(r?.id);
          const number = normalizeText(r?.number || r?.guia || r?.numero);
          const producerId = normalizeText(r?.producer_id ?? r?.producerId ?? r?.producer?.id);
          const producerName = normalizeText(r?.producer?.name);
          if (!id) return null;
          return {
            id,
            number: number || id,
            producerId,
            producerName,
            totalDue: computeRomaneioTotalDue(r),
          };
        })
        .filter(Boolean) as any;
      setRomaneiosCompra(romOpts);
    } else {
      setRomaneiosCompra([]);
      issues.push('Romaneios de compra não carregaram.');
      console.error('Erro ao carregar romaneios de compra:', romaneiosRes.reason);
    }

    const producersRes = results[2];
    if (producersRes.status === 'fulfilled') {
      setProducers(producersRes.value || []);
    } else {
      setProducers([]);
      issues.push('Produtores não carregaram.');
      console.error('Erro ao carregar produtores:', producersRes.reason);
    }

    setLoadIssues(issues);
    setLoading(false);
  };

  useEffect(() => {
    const controller = new AbortController();
    fetchAll(controller.signal);
    return () => controller.abort();
  }, []);

  const filtered = useMemo(() => {
    const s = searchTerm.trim().toLowerCase();
    const from = fromDate ? fromDate.trim() : '';
    const to = toDate ? toDate.trim() : '';
    return (payments || []).filter((p) => {
      if (filterProducerId && String(p.producerId) !== String(filterProducerId)) return false;
      if (from && String(p.paidAt || '') < from) return false;
      if (to && String(p.paidAt || '') > to) return false;
      if (!s) return true;

      const rom = romaneioById.get(String(p.romaneioId));
      const producerName = producerNameById.get(String(p.producerId)) || rom?.producerName || '';

      const hay = [
        String(p.romaneioId || ''),
        String(rom?.number || ''),
        String(p.producerId || ''),
        String(producerName || ''),
        String(p.method || ''),
        String(p.reference || ''),
        String(p.note || ''),
        String(p.amount || ''),
        String(p.paidAt || ''),
      ]
        .join(' ')
        .toLowerCase();

      return hay.includes(s);
    });
  }, [filterProducerId, fromDate, payments, producerNameById, romaneioById, searchTerm, toDate]);

  const totals = useMemo(() => {
    const sum = (filtered || []).reduce((acc, p) => acc + (Number(p.amount) || 0), 0);
    return {
      count: filtered.length,
      sum,
    };
  }, [filtered]);

  const selectedRomaneioTotals = useMemo(() => {
    const id = String(formData.romaneioId || '').trim();
    if (!id) return null;
    const r = romaneioById.get(id);
    const totalDue = Number(r?.totalDue) || 0;
    const paidSoFar = (payments || []).reduce((acc, p) => {
      if (String(p.romaneioId || '').trim() !== id) return acc;
      if (editingPaymentId && String(p.id) === String(editingPaymentId)) return acc;
      return acc + (Number(p.amount) || 0);
    }, 0);

    const amountInput = Number(formData.amount);
    const safeAmountInput = Number.isFinite(amountInput) ? amountInput : 0;
    const remainingBefore = roundCurrency(totalDue - paidSoFar);
    const paidAfterInput = roundCurrency(paidSoFar + safeAmountInput);
    const remainingAfterInput = roundCurrency(totalDue - paidAfterInput);
    return { totalDue, paidSoFar, paidAfterInput, remainingBefore, remainingAfterInput };
  }, [editingPaymentId, formData.amount, formData.romaneioId, payments, romaneioById]);

  const computePaidUpToPayment = (target: ProducerPayment): number => {
    const romaneioId = String(target.romaneioId || '').trim();
    if (!romaneioId) return 0;

    const list = (payments || []).filter((p) => String(p.romaneioId || '').trim() === romaneioId);
    list.sort((a, b) => {
      const aDate = String(a.paidAt || '');
      const bDate = String(b.paidAt || '');
      if (aDate !== bDate) return aDate.localeCompare(bDate);

      const aCreated = String(a.created_at || '');
      const bCreated = String(b.created_at || '');
      if (aCreated && bCreated && aCreated !== bCreated) return aCreated.localeCompare(bCreated);
      const aIdNum = Number(a.id);
      const bIdNum = Number(b.id);
      if (Number.isFinite(aIdNum) && Number.isFinite(bIdNum) && aIdNum !== bIdNum) return aIdNum - bIdNum;
      return String(a.id || '').localeCompare(String(b.id || ''));
    });

    let sum = 0;
    for (const p of list) {
      sum += Number(p.amount) || 0;
      if (String(p.id) === String(target.id)) break;
    }
    return roundCurrency(sum);
  };

  const handleSave = async () => {
    const romaneioId = normalizeText(formData.romaneioId);
    const producerId = normalizeText(formData.producerId);
    const paidAt = normalizeText(formData.paidAt);
    const amount = Number(formData.amount);
    if (!romaneioId || !producerId || !paidAt || !Number.isFinite(amount) || amount <= 0) return;

    const remainingBefore = editingPaymentId ? null : Math.max(0, Number(selectedRomaneioTotals?.remainingBefore) || 0);
    if (!editingPaymentId && remainingBefore !== null && Number.isFinite(remainingBefore) && remainingBefore > 0) {
      const diff = roundCurrency(amount - remainingBefore);

      if (Math.abs(diff) >= 0.01) {
        if (diff < 0) {
          const openDiff = roundCurrency(Math.abs(diff));
          const ok = allowOpenDifference
            ? true
            : window.confirm(
                `Valor informado é diferente do devido (${formatCurrency(remainingBefore)}).\nDiferença em aberto: ${formatCurrency(openDiff)}.\nDeseja deixar a diferença em aberto?`
              );
          if (!ok) {
            setAllowOpenDifference(false);
            setFormData((prev) => ({ ...prev, amount: remainingBefore }));
            return;
          }
          setAllowOpenDifference(true);
        } else {
          const extra = roundCurrency(diff);
          const ok = window.confirm(
            `Valor informado é maior que o devido (${formatCurrency(remainingBefore)}).\nExcedente: ${formatCurrency(extra)}.\nDeseja lançar mesmo assim?`
          );
          if (!ok) {
            setAllowOpenDifference(false);
            setFormData((prev) => ({ ...prev, amount: remainingBefore }));
            return;
          }
        }
      }
    }

    const payload: Omit<ProducerPayment, 'id' | 'created_at'> = {
      romaneioId,
      producerId,
      amount,
      paidAt,
      method: normalizeText(formData.method) || undefined,
      reference: normalizeText(formData.reference) || undefined,
      note: normalizeText(formData.note) || undefined,
    };

    try {
      if (editingPaymentId) {
        await updateProducerPayment(editingPaymentId, payload);
        setIsAdding(false);
        setEditingPaymentId(null);
        setAllowOpenDifference(false);
        await fetchAll();
        return;
      }

      await addProducerPayment(payload);

      const due = Number(romaneioById.get(String(romaneioId))?.totalDue);
      const paidBefore = totalPaidByRomaneioId.get(String(romaneioId)) ?? 0;
      const remaining = Number.isFinite(due) ? roundCurrency(due - (paidBefore + amount)) : NaN;

      setIsAdding(false);
      setAllowOpenDifference(false);
      await fetchAll();

      if (Number.isFinite(remaining) && remaining > 0) {
        setPartialSuggestion({
          romaneioId,
          producerId,
          amountPaid: amount,
          remaining,
        });
      }
    } catch (e) {
      console.error('Erro ao salvar pagamento:', e);
    }
  };

  const confirmDeletePayment = async () => {
    if (!deleteTarget?.id) return;
    setDeleteLoading(true);
    try {
      await deleteProducerPayment(deleteTarget.id);
      setDeleteTarget(null);
      await fetchAll();
    } finally {
      setDeleteLoading(false);
    }
  };

  const exportReceiptPdf = async () => {
    if (!receiptTarget) return;
    const node = receiptRef.current;
    if (!node) return;

    const producerName = producerNameById.get(String(receiptTarget.producerId)) || '';
    const rom = romaneioById.get(String(receiptTarget.romaneioId));
    const fileName = `Recibo_${String(rom?.number || receiptTarget.romaneioId || '').trim()}_${String(producerName || 'PRODUTOR').trim()}`
      .replaceAll(/[<>:"/\\|?*]+/g, '_')
      .slice(0, 120);

    setReceiptExportLoading(true);
    document.documentElement.classList.add('pdf-export');
    try {
      const fontsReady = (document as any).fonts?.ready ? (document as any).fonts.ready : Promise.resolve();
      await fontsReady;
      await new Promise<void>((r) => requestAnimationFrame(() => r()));
      await new Promise<void>((r) => requestAnimationFrame(() => r()));

      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import('html2canvas'), import('jspdf')]);
      const canvas = await html2canvas(node, {
        backgroundColor: '#ffffff',
        scale: Math.max(2, Math.floor(window.devicePixelRatio || 1)),
        useCORS: true,
        logging: false,
        windowWidth: node.scrollWidth,
        windowHeight: node.scrollHeight,
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
    } catch (e: any) {
      alert(`Erro ao gerar PDF do recibo: ${String(e?.message || e)}`);
    } finally {
      document.documentElement.classList.remove('pdf-export');
      setReceiptExportLoading(false);
    }
  };

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-black text-gray-800 dark:text-white uppercase tracking-tight">Financeiro</h1>
          <p className="text-gray-500 dark:text-slate-400">Lançamento de pagamentos de notas de compra (produtores).</p>
        </div>
        <button
          onClick={openCreate}
          className="bg-emerald-600 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-200 dark:shadow-none"
        >
          <Plus size={20} /> Novo Pagamento
        </button>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-sm overflow-hidden transition-colors">
        {loadIssues.length > 0 && (
          <div className="p-4 border-b border-gray-100 dark:border-slate-800 bg-yellow-50/70 dark:bg-yellow-900/10">
            <div className="flex items-start gap-3">
              <div className="text-yellow-800 dark:text-yellow-200 pt-0.5">
                <Info size={18} />
              </div>
              <div className="text-[11px] font-bold text-yellow-900 dark:text-yellow-200 space-y-1">
                {loadIssues.map((m, idx) => (
                  <div key={idx}>{m}</div>
                ))}
              </div>
            </div>
          </div>
        )}
        <div className="p-4 border-b border-gray-100 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-800/20 space-y-3">
          <div className="flex items-center gap-3">
            <Search className="text-gray-400 dark:text-slate-500" size={18} />
            <input
              type="text"
              placeholder="Buscar por romaneio, produtor, referência, método..."
              className="bg-transparent border-none outline-none w-full text-sm text-gray-900 dark:text-white"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="md:col-span-2">
              <select
                className="w-full p-3 border border-gray-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 bg-white dark:bg-slate-900 text-gray-900 dark:text-white transition-all text-sm"
                value={filterProducerId}
                onChange={(e) => setFilterProducerId(e.target.value)}
              >
                <option value="">Todos os produtores</option>
                {producers.map((p) => (
                  <option key={p.id} value={p.id}>
                    {String(p.name || '').toUpperCase()}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <input
                type="date"
                className="w-full p-3 border border-gray-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 bg-white dark:bg-slate-900 text-gray-900 dark:text-white transition-all text-sm"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
              />
            </div>
            <div>
              <input
                type="date"
                className="w-full p-3 border border-gray-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 bg-white dark:bg-slate-900 text-gray-900 dark:text-white transition-all text-sm"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div className="text-xs font-black text-gray-400 dark:text-slate-500 uppercase tracking-widest">
              {loading ? 'Carregando...' : `${totals.count} lançamento(s)`}
            </div>
            <div className="flex items-center justify-between sm:justify-end gap-3">
              <div className="px-4 py-2 rounded-2xl bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-900/30">
                <div className="text-[10px] font-black text-emerald-700 dark:text-emerald-300 uppercase tracking-widest">
                  Total filtrado
                </div>
                <div className="text-lg font-black text-emerald-700 dark:text-emerald-300 leading-none">
                  {formatCurrency(totals.sum)}
                </div>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[1320px]">
              <thead>
                <tr className="text-left text-[10px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-widest border-b border-gray-50 dark:border-slate-800">
                  <th className="py-4 pr-6">Data</th>
                  <th className="py-4 pr-6">Romaneio</th>
                  <th className="py-4 pr-6">Produtor</th>
                  <th className="py-4 pr-6 text-right">Valor</th>
                  <th className="py-4 pr-6 text-right">Devido</th>
                  <th className="py-4 pr-6 text-right">Pago (Acumulado)</th>
                  <th className="py-4 pr-6 text-right">Restante</th>
                  <th className="py-4 pr-6">Status</th>
                  <th className="py-4 pr-6">Método</th>
                  <th className="py-4 pr-6">Referência</th>
                  <th className="py-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                {loading && (
                  <tr>
                    <td colSpan={11} className="py-20 text-center text-gray-400 dark:text-slate-600 italic">
                      Carregando lançamentos...
                    </td>
                  </tr>
                )}
                {!loading &&
                  filtered.map((p) => {
                    const rom = romaneioById.get(String(p.romaneioId));
                    const producerName = producerNameById.get(String(p.producerId)) || rom?.producerName || '';
                    const totalDue = Number(rom?.totalDue) || 0;
                    const paidUpTo = computePaidUpToPayment(p);
                    const remaining = roundCurrency(totalDue - paidUpTo);
                    const isClosed = remaining <= 0;
                    return (
                      <tr key={p.id} className="hover:bg-gray-50 dark:hover:bg-slate-800/30 transition-colors group">
                        <td className="py-4 pr-6 text-sm font-bold text-gray-700 dark:text-slate-200 whitespace-nowrap">
                          {formatDate(String(p.paidAt || ''))}
                        </td>
                        <td className="py-4 pr-6 text-sm text-gray-600 dark:text-slate-400 whitespace-nowrap">
                          Nº {String(rom?.number || p.romaneioId || '').toUpperCase()}
                        </td>
                        <td className="py-4 pr-6 text-sm font-bold text-gray-700 dark:text-slate-200 uppercase">
                          {String(producerName || '-')}
                        </td>
                        <td className="py-4 pr-6 text-sm font-black text-emerald-700 dark:text-emerald-300 text-right whitespace-nowrap">
                          {formatCurrency(Number(p.amount) || 0)}
                        </td>
                        <td className="py-4 pr-6 text-sm font-black text-gray-700 dark:text-slate-200 text-right whitespace-nowrap">
                          {formatCurrency(totalDue)}
                        </td>
                        <td className="py-4 pr-6 text-sm font-black text-emerald-700 dark:text-emerald-300 text-right whitespace-nowrap">
                          {formatCurrency(paidUpTo)}
                        </td>
                        <td
                          className={`py-4 pr-6 text-sm font-black text-right whitespace-nowrap ${
                            remaining > 0 ? 'text-orange-700 dark:text-orange-300' : 'text-emerald-700 dark:text-emerald-300'
                          }`}
                        >
                          {formatCurrency(Math.max(0, remaining))}
                        </td>
                        <td className="py-4 pr-6 text-xs font-black uppercase tracking-widest">
                          <span
                            className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl border ${
                              isClosed
                                ? 'bg-emerald-50 dark:bg-emerald-900/10 border-emerald-100 dark:border-emerald-900/30 text-emerald-800 dark:text-emerald-200'
                                : 'bg-orange-50/70 dark:bg-orange-900/10 border-orange-100 dark:border-orange-900/30 text-orange-800 dark:text-orange-200'
                            }`}
                          >
                            {isClosed ? <CheckCircle2 size={16} /> : <CircleDot size={16} />}
                            {isClosed ? 'Completo' : 'Em aberto'}
                          </span>
                        </td>
                        <td className="py-4 pr-6 text-xs font-bold text-gray-500 dark:text-slate-400 uppercase">
                          {String(p.method || '-')}
                        </td>
                        <td className="py-4 pr-6 text-xs text-gray-500 dark:text-slate-400">
                          {String(p.reference || '-')}
                        </td>
                        <td className="py-4 text-right">
                          <button
                            onClick={() => openEdit(p)}
                            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-800 transition-all"
                            title="Editar"
                          >
                            <Edit2 size={16} />
                          </button>
                          <button
                            onClick={() => setReceiptTarget(p)}
                            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-800 transition-all"
                            title="Recibo"
                          >
                            <FileDown size={16} />
                          </button>
                          <button
                            onClick={() => setDeleteTarget(p)}
                            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 transition-all"
                            title="Excluir"
                          >
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}

                {!loading && filtered.length === 0 && (
                  <tr>
                    <td colSpan={11} className="py-20 text-center text-gray-400 dark:text-slate-600 italic">
                      Nenhum pagamento encontrado.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {isAdding && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-xl overflow-hidden animate-in fade-in zoom-in duration-200 transition-colors">
            <div className="p-6 border-b border-gray-100 dark:border-slate-800 bg-emerald-50 dark:bg-emerald-900/20">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-lg font-bold text-emerald-800 dark:text-emerald-400 flex items-center gap-2">
                  <DollarSign className="text-emerald-600 dark:text-emerald-500" /> {editingPaymentId ? 'Editar Pagamento' : 'Novo Pagamento'}
                </h3>
                <button
                  onClick={() => {
                    setIsAdding(false);
                    setEditingPaymentId(null);
                  }}
                  className="p-2 rounded-xl hover:bg-emerald-100/50 dark:hover:bg-slate-800 text-emerald-700 dark:text-emerald-300 transition-all"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4 bg-white dark:bg-slate-900">
              <div>
                <label className="block text-xs font-black text-gray-400 dark:text-slate-500 uppercase mb-1">Romaneio (Compra)</label>
                <select
                  className="w-full p-3 border border-gray-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 bg-gray-50 dark:bg-slate-800 text-gray-900 dark:text-white transition-all"
                  value={formData.romaneioId}
                  onChange={(e) => {
                    const id = e.target.value;
                    const r = romaneioById.get(String(id));
                    setAllowOpenDifference(false);
                    setFormData((prev) => ({
                      ...prev,
                      romaneioId: id,
                      producerId: r?.producerId ? String(r.producerId) : prev.producerId,
                    }));
                    void refreshRomaneioDueIfNeeded(id);
                  }}
                >
                  <option value="">Selecione...</option>
                  {romaneiosCompra.map((r) => (
                    <option key={r.id} value={r.id}>
                      Nº {String(r.number || r.id).toUpperCase()} {r.producerName ? `- ${String(r.producerName).toUpperCase()}` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {selectedRomaneioTotals && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="p-4 rounded-2xl bg-gray-50 dark:bg-slate-800/60 border border-gray-100 dark:border-slate-800">
                    <div className="text-[10px] font-black text-gray-500 dark:text-slate-400 uppercase tracking-widest">Devido</div>
                    <div className="text-lg font-black text-gray-800 dark:text-white">{formatCurrency(selectedRomaneioTotals.totalDue)}</div>
                  </div>
                  <div className="p-4 rounded-2xl bg-emerald-50/70 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-900/30">
                    <div className="text-[10px] font-black text-emerald-700 dark:text-emerald-300 uppercase tracking-widest">Pago (Antes)</div>
                    <div className="text-lg font-black text-emerald-700 dark:text-emerald-300">{formatCurrency(selectedRomaneioTotals.paidSoFar)}</div>
                  </div>
                  <div className="p-4 rounded-2xl bg-orange-50/70 dark:bg-orange-900/10 border border-orange-100 dark:border-orange-900/30">
                    <div className="text-[10px] font-black text-orange-700 dark:text-orange-300 uppercase tracking-widest">Restante (Após Esta Baixa)</div>
                    <div className="text-lg font-black text-orange-700 dark:text-orange-300">
                      {formatCurrency(Math.max(0, selectedRomaneioTotals.remainingAfterInput))}
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-black text-gray-400 dark:text-slate-500 uppercase mb-1">Produtor</label>
                  <select
                    className="w-full p-3 border border-gray-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 bg-gray-50 dark:bg-slate-800 text-gray-900 dark:text-white transition-all"
                    value={formData.producerId}
                    onChange={(e) => setFormData((prev) => ({ ...prev, producerId: e.target.value }))}
                  >
                    <option value="">Selecione...</option>
                    {producers.map((p) => (
                      <option key={p.id} value={p.id}>
                        {String(p.name || '').toUpperCase()}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-black text-gray-400 dark:text-slate-500 uppercase mb-1">Data de Pagamento</label>
                  <input
                    type="date"
                    className="w-full p-3 border border-gray-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 bg-gray-50 dark:bg-slate-800 text-gray-900 dark:text-white transition-all"
                    value={formData.paidAt}
                    onChange={(e) => setFormData((prev) => ({ ...prev, paidAt: e.target.value }))}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-black text-gray-400 dark:text-slate-500 uppercase mb-1">Valor</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0,00"
                    className="w-full p-3 border border-gray-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 bg-gray-50 dark:bg-slate-800 text-gray-900 dark:text-white transition-all"
                    value={formData.amount}
                    onChange={(e) => {
                      setAllowOpenDifference(false);
                      setFormData((prev) => ({ ...prev, amount: parseFloat(e.target.value) }));
                    }}
                  />
                  {!editingPaymentId &&
                    selectedRomaneioTotals &&
                    Number.isFinite(Number(selectedRomaneioTotals.remainingBefore)) &&
                    (Number(formData.amount) || 0) > 0 &&
                    (() => {
                      const remainingBefore = Math.max(0, Number(selectedRomaneioTotals.remainingBefore) || 0);
                      const diff = roundCurrency((Number(formData.amount) || 0) - remainingBefore);
                      if (Math.abs(diff) < 0.01) return null;
                      if (diff < 0) {
                        const openDiff = roundCurrency(Math.abs(diff));
                        return (
                          <div className="mt-2 p-3 rounded-2xl bg-orange-50/70 dark:bg-orange-900/10 border border-orange-100 dark:border-orange-900/30">
                            <div className="text-[11px] font-black text-orange-800 dark:text-orange-200">
                              Diferença em aberto: {formatCurrency(openDiff)} (Devido {formatCurrency(remainingBefore)})
                            </div>
                            <label className="mt-2 flex items-center gap-2 text-[11px] font-bold text-orange-900 dark:text-orange-200">
                              <input
                                type="checkbox"
                                checked={allowOpenDifference}
                                onChange={(e) => setAllowOpenDifference(e.target.checked)}
                              />
                              Deixar a diferença em aberto
                            </label>
                          </div>
                        );
                      }

                      return (
                        <div className="mt-2 p-3 rounded-2xl bg-red-50/70 dark:bg-red-900/10 border border-red-100 dark:border-red-900/30">
                          <div className="text-[11px] font-black text-red-700 dark:text-red-200">
                            Valor acima do devido: {formatCurrency(diff)} (Devido {formatCurrency(remainingBefore)})
                          </div>
                        </div>
                      );
                    })()}
                </div>
                <div>
                  <label className="block text-xs font-black text-gray-400 dark:text-slate-500 uppercase mb-1">Método (Opcional)</label>
                  <input
                    type="text"
                    placeholder="Ex: PIX"
                    className="w-full p-3 border border-gray-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 bg-gray-50 dark:bg-slate-800 text-gray-900 dark:text-white transition-all"
                    value={formData.method || ''}
                    onChange={(e) => setFormData((prev) => ({ ...prev, method: e.target.value.toUpperCase() }))}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-black text-gray-400 dark:text-slate-500 uppercase mb-1">Referência (Opcional)</label>
                  <input
                    type="text"
                    placeholder="Ex: COMPROVANTE 123"
                    className="w-full p-3 border border-gray-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 bg-gray-50 dark:bg-slate-800 text-gray-900 dark:text-white transition-all"
                    value={formData.reference || ''}
                    onChange={(e) => setFormData((prev) => ({ ...prev, reference: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-xs font-black text-gray-400 dark:text-slate-500 uppercase mb-1">Observação (Opcional)</label>
                  <input
                    type="text"
                    placeholder="Opcional"
                    className="w-full p-3 border border-gray-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 bg-gray-50 dark:bg-slate-800 text-gray-900 dark:text-white transition-all"
                    value={formData.note || ''}
                    onChange={(e) => setFormData((prev) => ({ ...prev, note: e.target.value }))}
                  />
                </div>
              </div>
            </div>

            <div className="p-6 bg-gray-50 dark:bg-slate-800/50 border-t border-gray-100 dark:border-slate-800 flex gap-3 transition-colors">
              <button
                onClick={() => {
                  setIsAdding(false);
                  setEditingPaymentId(null);
                }}
                className="flex-1 py-3 rounded-xl text-gray-500 dark:text-slate-400 font-bold hover:bg-gray-200 dark:hover:bg-slate-800 transition-all"
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                className="flex-1 py-3 rounded-xl bg-emerald-600 text-white font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100 dark:shadow-none"
              >
                {editingPaymentId ? 'Salvar Alterações' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {partialSuggestion && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[120] p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200 transition-colors">
            <div className="p-6 border-b border-gray-100 dark:border-slate-800 bg-orange-50/70 dark:bg-orange-900/10">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-lg font-bold text-orange-800 dark:text-orange-200 flex items-center gap-2">
                  <Info className="text-orange-600 dark:text-orange-300" /> Pagamento Parcial Registrado
                </h3>
                <button
                  onClick={() => setPartialSuggestion(null)}
                  className="p-2 rounded-xl hover:bg-orange-100/50 dark:hover:bg-slate-800 text-orange-700 dark:text-orange-200 transition-all"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4 bg-white dark:bg-slate-900">
              {(() => {
                const rom = romaneioById.get(String(partialSuggestion.romaneioId));
                const producerName =
                  producerNameById.get(String(partialSuggestion.producerId)) || rom?.producerName || String(partialSuggestion.producerId || '');
                return (
                  <>
                    <div className="text-xs font-black text-gray-500 dark:text-slate-400 uppercase tracking-widest">
                      Romaneio Nº {String(rom?.number || partialSuggestion.romaneioId || '').toUpperCase()}
                    </div>
                    <div className="text-sm font-black text-gray-800 dark:text-white uppercase">{String(producerName || '-')}</div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="p-4 rounded-2xl bg-emerald-50/70 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-900/30">
                        <div className="text-[10px] font-black text-emerald-700 dark:text-emerald-300 uppercase tracking-widest">Valor Pago</div>
                        <div className="text-lg font-black text-emerald-700 dark:text-emerald-300">
                          {formatCurrency(partialSuggestion.amountPaid)}
                        </div>
                      </div>
                      <div className="p-4 rounded-2xl bg-orange-50/70 dark:bg-orange-900/10 border border-orange-100 dark:border-orange-900/30">
                        <div className="text-[10px] font-black text-orange-700 dark:text-orange-300 uppercase tracking-widest">Restante</div>
                        <div className="text-lg font-black text-orange-700 dark:text-orange-300">
                          {formatCurrency(Math.max(0, partialSuggestion.remaining))}
                        </div>
                      </div>
                    </div>
                  </>
                );
              })()}
            </div>

            <div className="p-6 bg-gray-50 dark:bg-slate-800/50 border-t border-gray-100 dark:border-slate-800 flex gap-3 transition-colors">
              <button
                onClick={() => setPartialSuggestion(null)}
                className="flex-1 py-3 rounded-xl text-gray-500 dark:text-slate-400 font-bold hover:bg-gray-200 dark:hover:bg-slate-800 transition-all"
              >
                Manter em Aberto
              </button>
              <button
                onClick={() => {
                  const snapshot = partialSuggestion;
                  setPartialSuggestion(null);
                  setEditingPaymentId(null);
                  setAllowOpenDifference(false);
                  setFormData({
                    romaneioId: snapshot.romaneioId,
                    producerId: snapshot.producerId,
                    amount: snapshot.remaining,
                    paidAt: toLocalDateInput(),
                    method: '',
                    reference: '',
                    note: '',
                  });
                  setIsAdding(true);
                }}
                className="flex-1 py-3 rounded-xl bg-emerald-600 text-white font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100 dark:shadow-none"
              >
                Lançar Restante Agora
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
                <div className="bg-red-600 p-2 rounded-xl text-white shadow-lg shadow-red-100 dark:shadow-none">
                  <Trash2 size={20} />
                </div>
                <button
                  onClick={() => setDeleteTarget(null)}
                  disabled={deleteLoading}
                  className="p-2 hover:bg-red-100/50 dark:hover:bg-slate-800 rounded-xl text-red-600 dark:text-red-400 transition-all disabled:opacity-60"
                >
                  <X size={24} />
                </button>
              </div>
              <h3 className="text-xl font-black text-gray-800 dark:text-white uppercase tracking-tight leading-none">Excluir Pagamento</h3>
              <p className="text-[10px] text-red-600 dark:text-red-400 font-black uppercase mt-2 tracking-widest">Ação Irreversível</p>
            </div>

            <div className="p-6 md:p-8 space-y-4 overflow-y-auto">
              <div className="bg-gray-50 dark:bg-slate-800/50 border border-gray-100 dark:border-slate-800 rounded-3xl p-5">
                <p className="text-xs font-black text-gray-900 dark:text-white uppercase truncate">
                  {formatCurrency(Number(deleteTarget.amount) || 0)}
                </p>
                <p className="text-[10px] font-bold text-gray-500 dark:text-slate-400 uppercase truncate mt-1">
                  Data {formatDate(String(deleteTarget.paidAt || ''))}
                </p>
              </div>

              <div className="flex items-start gap-3 p-4 rounded-2xl bg-yellow-50/60 dark:bg-yellow-900/20 border border-yellow-100 dark:border-yellow-900/30">
                <div className="text-yellow-700 dark:text-yellow-300 pt-0.5">
                  <Info size={18} />
                </div>
                <div className="text-[11px] font-bold text-yellow-800 dark:text-yellow-200">
                  Ao excluir este lançamento, o pagamento deixará de aparecer no financeiro. Deseja continuar?
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
                onClick={confirmDeletePayment}
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

      {receiptTarget && (() => {
        const rom = romaneioById.get(String(receiptTarget.romaneioId));
        const producer = (producers || []).find((p) => String(p.id) === String(receiptTarget.producerId)) ?? null;
        const producerName = producerNameById.get(String(receiptTarget.producerId)) || rom?.producerName || producer?.name || '';
        const totalDue = Number(rom?.totalDue) || 0;
        const paidUpTo = computePaidUpToPayment(receiptTarget);
        const remainingAfter = roundCurrency(totalDue - paidUpTo);
        const paidThis = Number(receiptTarget.amount) || 0;

        return (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[120] p-4">
            <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-3xl overflow-hidden animate-in fade-in zoom-in duration-200 transition-colors">
              <div className="p-6 border-b border-gray-100 dark:border-slate-800 bg-gray-50 dark:bg-slate-800/20 flex items-center justify-between gap-3">
                <div className="text-sm font-black text-gray-800 dark:text-white uppercase tracking-tight">Recibo</div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => void exportReceiptPdf()}
                    disabled={receiptExportLoading}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 text-white font-black text-xs uppercase tracking-widest hover:bg-emerald-700 transition-all disabled:opacity-60"
                  >
                    <FileDown size={16} /> {receiptExportLoading ? 'Gerando...' : 'Baixar PDF'}
                  </button>
                  <button
                    onClick={() => setReceiptTarget(null)}
                    className="p-2 rounded-xl hover:bg-gray-200 dark:hover:bg-slate-800 text-gray-700 dark:text-slate-200 transition-all"
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>

              <div className="p-6 bg-white dark:bg-slate-900">
                <div className="print-container border border-gray-200 dark:border-slate-800 rounded-2xl overflow-hidden bg-white">
                  <div ref={receiptRef} className="print-scale">
                    <div className="flex items-start justify-between gap-6 border-b border-black pb-3 mb-4">
                      <div>
                        <div className="text-lg font-black uppercase tracking-widest">Recibo de Pagamento</div>
                        <div className="text-xs font-bold uppercase">Produtor Rural</div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs font-bold uppercase">Data</div>
                        <div className="text-sm font-black">{formatDate(String(receiptTarget.paidAt || ''))}</div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                      <div className="border border-black rounded-md p-3">
                        <div className="text-[10px] font-black uppercase tracking-widest text-gray-600">Produtor</div>
                        <div className="font-black uppercase">{String(producerName || '-')}</div>
                        <div className="text-xs font-bold text-gray-700">{String((producer as any)?.cnpj || '').trim() ? `CNPJ/CPF: ${String((producer as any).cnpj).trim()}` : ''}</div>
                      </div>
                      <div className="border border-black rounded-md p-3">
                        <div className="text-[10px] font-black uppercase tracking-widest text-gray-600">Romaneio</div>
                        <div className="font-black uppercase">Nº {String(rom?.number || receiptTarget.romaneioId || '').toUpperCase()}</div>
                        <div className="text-xs font-bold text-gray-700">{String(receiptTarget.method || '').trim() ? `Método: ${String(receiptTarget.method).trim()}` : ''}</div>
                        <div className="text-xs font-bold text-gray-700">{String(receiptTarget.reference || '').trim() ? `Referência: ${String(receiptTarget.reference).trim()}` : ''}</div>
                      </div>
                    </div>

                    <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="border border-black rounded-md p-4">
                        <div className="text-[10px] font-black uppercase tracking-widest text-gray-600">Valor Devido</div>
                        <div className="text-xl font-black">{formatCurrency(totalDue)}</div>
                      </div>
                      <div className="border border-black rounded-md p-4">
                        <div className="text-[10px] font-black uppercase tracking-widest text-gray-600">Valor Pago</div>
                        <div className="text-xl font-black">{formatCurrency(paidThis)}</div>
                      </div>
                      <div className="border border-black rounded-md p-4">
                        <div className="text-[10px] font-black uppercase tracking-widest text-gray-600">Valor Restante</div>
                        <div className="text-xl font-black">{formatCurrency(Math.max(0, remainingAfter))}</div>
                      </div>
                    </div>

                    {String(receiptTarget.note || '').trim() && (
                      <div className="mt-4 border border-black rounded-md p-3">
                        <div className="text-[10px] font-black uppercase tracking-widest text-gray-600">Observação</div>
                        <div className="text-sm font-bold">{String(receiptTarget.note || '').trim()}</div>
                      </div>
                    )}

                    <div className="mt-10 border-t-2 border-black pt-6">
                      <div className="text-xs font-black uppercase tracking-widest">Assinatura do Produtor</div>
                      <div className="mt-6 border-b border-black w-full"></div>
                    </div>

                    <div className="mt-6 text-center border-t-2 border-black pt-2 relative">
                      <div className="print-footer-note absolute -bottom-6 right-0 text-[7px] text-gray-400 italic">
                        Desenvolvido por VisionApp - Mateus Angelo vr {String((pkg as any)?.version || '').trim() || '-'}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};

export default Financeiro;

