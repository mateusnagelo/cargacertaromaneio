import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, CalendarDays, Receipt, RefreshCw, ShoppingCart, TrendingUp, Users, Wallet } from 'lucide-react';
import { getRomaneios } from '../api/romaneios';
import { supabase } from '../supabaseClient';
import { RomaneioData } from '../types';
import { formatCurrency } from '../utils';

type DashboardMetrics = {
  todayTotal: number;
  yesterdayTotal: number;
  monthTotal: number;
  monthCount: number;
  pendingCount: number;
  doneCount: number;
  canceledCount: number;
  overduePendingCount: number;
  oldestPendingDays: number | null;
};

type SeriesPoint = {
  iso: string;
  label: string;
  value: number;
};

type TopParty = { id: string; name: string; count: number; total: number } | null;

const emptyMetrics: DashboardMetrics = {
  todayTotal: 0,
  yesterdayTotal: 0,
  monthTotal: 0,
  monthCount: 0,
  pendingCount: 0,
  doneCount: 0,
  canceledCount: 0,
  overduePendingCount: 0,
  oldestPendingDays: null,
};

const toIsoDateOnly = (v: unknown) => {
  const s = String(v ?? '').trim();
  if (!s) return '';
  const br = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (br) {
    const dd = String(br[1]).padStart(2, '0');
    const mm = String(br[2]).padStart(2, '0');
    const yyyy = String(br[3]);
    return `${yyyy}-${mm}-${dd}`;
  }
  if (s.length >= 10 && /^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const d = new Date(s);
  const t = d.getTime();
  if (!Number.isFinite(t)) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

const isoToday = () => toIsoDateOnly(new Date());

const isoAddDays = (iso: string, delta: number) => {
  const base = new Date(`${iso}T00:00:00`);
  const t = base.getTime();
  if (!Number.isFinite(t)) return '';
  base.setDate(base.getDate() + delta);
  return toIsoDateOnly(base);
};

const toNumberLoose = (v: unknown) => {
  if (v === null || v === undefined) return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  const raw = String(v ?? '').trim();
  if (!raw) return null;
  const cleaned = raw.replace(/\s+/g, '').replace(/[^0-9,.\-]/g, '');
  if (!cleaned || cleaned === '-' || cleaned === ',' || cleaned === '.') return null;
  const hasComma = cleaned.includes(',');
  const hasDot = cleaned.includes('.');
  const normalized = hasComma && hasDot ? cleaned.replace(/\./g, '').replace(/,/g, '.') : hasComma ? cleaned.replace(/,/g, '.') : cleaned;
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
};

const computeTotal = (r: RomaneioData) => {
  const inferKind = (x?: Partial<RomaneioData> | null) => {
    const k = String((x as any)?.kind ?? '').trim().toUpperCase();
    if (k === 'COMPRA') return 'COMPRA';
    if (k === 'VENDA') return 'VENDA';
    const payloadObj = (x as any)?.payload && typeof (x as any)?.payload === 'object' ? (x as any).payload : null;
    const payloadKind = String(payloadObj?.kind ?? '').trim().toUpperCase();
    if (payloadKind === 'COMPRA') return 'COMPRA';
    if (payloadKind === 'VENDA') return 'VENDA';
    const nature = String((x as any)?.natureOfOperation ?? payloadObj?.natureOfOperation ?? '').trim().toUpperCase();
    if (nature.includes('COMPRA')) return 'COMPRA';
    return 'VENDA';
  };
  const productsTotal = Array.isArray(r.products)
    ? r.products.reduce((acc, p) => acc + (Number(toNumberLoose(p?.quantity) || 0) * Number(toNumberLoose(p?.unitValue) || 0)), 0)
    : 0;
  const expensesTotal = Array.isArray(r.expenses)
    ? r.expenses.reduce(
        (acc, e) =>
          acc +
          (Number(
            toNumberLoose(
              (e as any)?.total ?? (e as any)?.total_value ?? (e as any)?.valor_total ?? (e as any)?.value ?? 0
            ) || 0
          ) || 0),
        0
      )
    : 0;
  const payloadObj = (r as any)?.payload && typeof (r as any)?.payload === 'object' ? (r as any).payload : null;
  const hasItems = (Array.isArray(r.products) && r.products.length > 0) || (Array.isArray(r.expenses) && r.expenses.length > 0);
  const itemsTotal = inferKind(r) === 'COMPRA' ? productsTotal - expensesTotal : productsTotal + expensesTotal;
  const dbTotal = Number(
    toNumberLoose(
      (r as any)?.montante_total ??
        (r as any)?.total_value ??
        (r as any)?.total ??
        (r as any)?.valor_total ??
        payloadObj?.montante_total ??
        payloadObj?.total_value ??
        payloadObj?.total ??
        payloadObj?.valor_total ??
        0
    ) || 0
  );
  return hasItems ? itemsTotal : dbTotal;
};

const getPrimaryDate = (r: RomaneioData) => {
  const sale = toIsoDateOnly((r as any)?.saleDate);
  if (sale) return sale;
  const emission = toIsoDateOnly((r as any)?.emissionDate);
  if (emission) return emission;
  const created = toIsoDateOnly((r as any)?.created_at ?? (r as any)?.createdAt ?? (r as any)?.criado_em);
  if (created) return created;
  const extra =
    toIsoDateOnly((r as any)?.data_de_emissao ?? (r as any)?.data_emissao ?? (r as any)?.data ?? (r as any)?.date) ||
    '';
  if (extra) return extra;
  const payloadObj = (r as any)?.payload && typeof (r as any)?.payload === 'object' ? (r as any).payload : null;
  if (payloadObj) {
    const fromPayload =
      toIsoDateOnly(payloadObj?.saleDate ?? payloadObj?.emissionDate ?? payloadObj?.created_at ?? payloadObj?.criado_em) ||
      toIsoDateOnly(payloadObj?.data_de_emissao ?? payloadObj?.data_emissao ?? payloadObj?.data ?? payloadObj?.date) ||
      '';
    if (fromPayload) return fromPayload;
  }
  return '';
};

const daysSinceIso = (iso: string) => {
  const raw = String(iso || '').trim();
  if (!raw) return null;
  const d = new Date(`${raw}T00:00:00`);
  const t = d.getTime();
  if (!Number.isFinite(t)) return null;
  const now = new Date();
  const diff = startOfDay(now).getTime() - startOfDay(d).getTime();
  return Math.floor(diff / (24 * 60 * 60 * 1000));
};

const safePercentDelta = (today: number, yesterday: number) => {
  if (yesterday <= 0) return null;
  const pct = ((today - yesterday) / yesterday) * 100;
  if (!Number.isFinite(pct)) return null;
  return pct;
};

const formatShortDate = (iso: string) => {
  const s = String(iso || '').trim();
  if (!s || s.length < 10) return '';
  const d = s.slice(8, 10);
  const m = s.slice(5, 7);
  return `${d}/${m}`;
};

const LineChart: React.FC<{ points: SeriesPoint[]; height?: number; color?: string; gradientId?: string }> = ({
  points,
  height = 140,
  color = '#a855f7',
  gradientId = 'dashArea',
}) => {
  const values = points.map((p) => p.value);
  const max = values.length ? Math.max(...values) : 0;
  const min = values.length ? Math.min(...values) : 0;
  const range = max - min;

  const width = 520;
  const padX = 14;
  const padY = 18;

  const xFor = (idx: number) => {
    if (points.length <= 1) return padX;
    const usable = width - padX * 2;
    return padX + (usable * idx) / (points.length - 1);
  };

  const yFor = (v: number) => {
    const usable = height - padY * 2;
    if (usable <= 0) return padY;
    if (range <= 0) return padY + usable / 2;
    const t = (v - min) / range;
    return padY + (1 - t) * usable;
  };

  const lineD = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${xFor(i).toFixed(2)} ${yFor(p.value).toFixed(2)}`)
    .join(' ');

  const areaD =
    points.length >= 2
      ? `${lineD} L ${xFor(points.length - 1).toFixed(2)} ${(height - padY).toFixed(2)} L ${xFor(0).toFixed(2)} ${(height - padY).toFixed(2)} Z`
      : '';

  return (
    <div className="w-full">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-[140px]">
        <defs>
          <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.22" />
            <stop offset="100%" stopColor={color} stopOpacity="0.02" />
          </linearGradient>
        </defs>

        <line x1={padX} y1={height - padY} x2={width - padX} y2={height - padY} stroke="rgba(148,163,184,0.35)" strokeWidth="1" />
        <line x1={padX} y1={padY} x2={padX} y2={height - padY} stroke="rgba(148,163,184,0.35)" strokeWidth="1" />

        {areaD ? <path d={areaD} fill={`url(#${gradientId})`} /> : null}
        {lineD ? <path d={lineD} fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /> : null}

        {points.map((p, i) => (
          <g key={p.iso}>
            <circle cx={xFor(i)} cy={yFor(p.value)} r="4.5" fill={color} />
            <circle cx={xFor(i)} cy={yFor(p.value)} r="2.2" fill="#ffffff" />
          </g>
        ))}
      </svg>

      <div className="flex items-center justify-between px-1">
        {points.map((p) => (
          <div key={p.iso} className="text-[10px] font-black uppercase tracking-widest text-gray-400 dark:text-slate-500">
            {p.label}
          </div>
        ))}
      </div>
    </div>
  );
};

const DonutChart: React.FC<{
  items: Array<{ label: string; value: number; color: string; bg: string }>;
  size?: number;
}> = ({ items, size = 168 }) => {
  const total = items.reduce((acc, it) => acc + (Number(it.value) || 0), 0);
  const stroke = 14;
  const r = (size - stroke) / 2;
  const c = size / 2;
  const circ = 2 * Math.PI * r;

  let offset = 0;
  const segs = items.map((it) => {
    const frac = total > 0 ? (Number(it.value) || 0) / total : 0;
    const len = frac * circ;
    const segOffset = offset;
    offset += len;
    return { ...it, frac, len, segOffset };
  });

  return (
    <div className="flex items-center gap-6">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="rotate-[-90deg]">
          <circle cx={c} cy={c} r={r} stroke="rgba(148,163,184,0.25)" strokeWidth={stroke} fill="transparent" />
          {segs.map((s) => (
            <circle
              key={s.label}
              cx={c}
              cy={c}
              r={r}
              stroke={s.color}
              strokeWidth={stroke}
              fill="transparent"
              strokeLinecap="round"
              strokeDasharray={`${s.len} ${circ - s.len}`}
              strokeDashoffset={-s.segOffset}
            />
          ))}
        </svg>

        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className="text-[10px] font-black uppercase tracking-widest text-gray-400 dark:text-slate-500">Total</div>
          <div className="text-2xl font-black text-gray-900 dark:text-white">{total}</div>
        </div>
      </div>

      <div className="flex-1 space-y-2">
        {items.map((it) => (
          <div key={it.label} className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <span className={`inline-flex w-3 h-3 rounded-full ${it.bg}`} />
              <span className="text-[11px] font-black uppercase tracking-widest text-gray-600 dark:text-slate-300 truncate">{it.label}</span>
            </div>
            <div className="text-[11px] font-black uppercase tracking-widest text-gray-500 dark:text-slate-400">
              {total > 0 ? `${Math.round((it.value / total) * 100)}%` : '0%'} · {it.value}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

type DashboardLoadResult = {
  venda: { metrics: DashboardMetrics; series7d: SeriesPoint[]; topParty: TopParty };
  compra: { metrics: DashboardMetrics; series7d: SeriesPoint[]; topParty: TopParty };
  updatedAtIso: string;
};

let dashboardCache: { userId: string; data: DashboardLoadResult } | null = null;

const Dashboard: React.FC = () => {
  const [userId, setUserId] = useState('');
  const [authReady, setAuthReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [vendaMetrics, setVendaMetrics] = useState<DashboardMetrics>(emptyMetrics);
  const [compraMetrics, setCompraMetrics] = useState<DashboardMetrics>(emptyMetrics);
  const [vendaSeries7d, setVendaSeries7d] = useState<SeriesPoint[]>([]);
  const [compraSeries7d, setCompraSeries7d] = useState<SeriesPoint[]>([]);
  const [topCliente, setTopCliente] = useState<TopParty>(null);
  const [topProdutor, setTopProdutor] = useState<TopParty>(null);
  const [updatedAtIso, setUpdatedAtIso] = useState('');
  const [error, setError] = useState('');
  const controllerRef = useRef<AbortController | null>(null);

  const goalMonth = 200_000;
  const overdueThresholdDays = 3;

  const buildKind = (kind: 'VENDA' | 'COMPRA', done: RomaneioData[], pending: RomaneioData[], canceled: RomaneioData[]) => {
    const today = isoToday();
    const yesterday = isoAddDays(today, -1);
    const ym = today.slice(0, 7);
    const start7 = isoAddDays(today, -6);

    const dateForTodayMetric = (r: RomaneioData) => {
      const created = toIsoDateOnly((r as any)?.created_at ?? (r as any)?.createdAt ?? (r as any)?.criado_em);
      if (created) return created;
      return getPrimaryDate(r);
    };

    const nonCanceled = (() => {
      const byId = new Map<string, RomaneioData>();
      for (const r of [...(done || []), ...(pending || [])]) {
        if (!r) continue;
        const id = String((r as any)?.id ?? '');
        byId.set(id || `${byId.size + 1}`, r);
      }
      return Array.from(byId.values());
    })();

    let todayTotal = 0;
    let yesterdayTotal = 0;
    let monthTotal = 0;
    let monthCount = 0;
    const map7 = new Map<string, number>();
    const partyAgg = new Map<string, { id: string; name: string; count: number; total: number }>();

    for (const r of nonCanceled) {
      const d = getPrimaryDate(r);
      const dt = dateForTodayMetric(r);
      const total = computeTotal(r);
      if (dt === today) todayTotal += total;
      if (dt === yesterday) yesterdayTotal += total;
      if (d && d.slice(0, 7) === ym) {
        monthTotal += total;
        monthCount += 1;

        const rawName =
          kind === 'COMPRA'
            ? String((r as any)?.producer?.name ?? (r as any)?.customer?.name ?? (r as any)?.client?.name ?? '').trim()
            : String((r as any)?.customer?.name ?? (r as any)?.client?.name ?? '').trim();
        const rawId =
          kind === 'COMPRA'
            ? String((r as any)?.producer?.id ?? (r as any)?.producer_id ?? (r as any)?.customer_id ?? '').trim()
            : String((r as any)?.customer?.id ?? (r as any)?.customer_id ?? '').trim();

        const key = rawId || (rawName ? `name:${rawName.toLowerCase()}` : '');
        if (key) {
          const prev = partyAgg.get(key) ?? { id: rawId || key, name: rawName || '-', count: 0, total: 0 };
          prev.count += 1;
          prev.total += total;
          if (!prev.name || prev.name === '-') prev.name = rawName || prev.name;
          if (!prev.id || prev.id.startsWith('name:')) prev.id = rawId || prev.id;
          partyAgg.set(key, prev);
        }
      }
      if (d && d >= start7 && d <= today) {
        map7.set(d, (map7.get(d) || 0) + total);
      }
    }

    let oldestPendingDays: number | null = null;
    let overduePendingCount = 0;
    for (const r of pending || []) {
      const d = getPrimaryDate(r);
      const age = d ? daysSinceIso(d) : null;
      if (age === null) continue;
      if (oldestPendingDays === null || age > oldestPendingDays) oldestPendingDays = age;
      if (age > overdueThresholdDays) overduePendingCount += 1;
    }

    const points: SeriesPoint[] = [];
    for (let i = 6; i >= 0; i--) {
      const iso = isoAddDays(today, -i);
      points.push({ iso, label: formatShortDate(iso), value: map7.get(iso) || 0 });
    }

    const metrics: DashboardMetrics = {
      todayTotal,
      yesterdayTotal,
      monthTotal,
      monthCount,
      pendingCount: (pending || []).length,
      doneCount: (done || []).length,
      canceledCount: (canceled || []).length,
      overduePendingCount,
      oldestPendingDays,
    };

    const topParty = (() => {
      let best: { id: string; name: string; count: number; total: number } | null = null;
      for (const it of partyAgg.values()) {
        if (!best) {
          best = it;
          continue;
        }
        if (it.total > best.total) {
          best = it;
          continue;
        }
        if (it.total === best.total && it.count > best.count) {
          best = it;
        }
      }
      return best;
    })();

    return { metrics, series7d: points, topParty };
  };

  const applyLoaded = (data: DashboardLoadResult) => {
    setVendaMetrics(data.venda.metrics);
    setCompraMetrics(data.compra.metrics);
    setVendaSeries7d(data.venda.series7d);
    setCompraSeries7d(data.compra.series7d);
    setTopCliente(data.venda.topParty);
    setTopProdutor(data.compra.topParty);
    setUpdatedAtIso(data.updatedAtIso);
  };

  const loadDashboard = async (force: boolean, targetUserId: string) => {
    if (!targetUserId) return;
    if (!force && dashboardCache && dashboardCache.userId === targetUserId) {
      applyLoaded(dashboardCache.data);
      setLoading(false);
      return;
    }

    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    const signal = controller.signal;

    const startedAt = Date.now();
    try {
      setLoading(true);
      setError('');

      const [doneVenda, pendingVenda, canceledVenda, doneCompra, pendingCompra, canceledCompra] = await Promise.all([
        getRomaneios(signal, { status: 'CONCLUÍDO', kind: 'VENDA', mode: 'list' }),
        getRomaneios(signal, { status: 'PENDENTE', kind: 'VENDA', mode: 'list' }),
        getRomaneios(signal, { status: 'CANCELADO', kind: 'VENDA', mode: 'list' }),
        getRomaneios(signal, { status: 'CONCLUÍDO', kind: 'COMPRA', mode: 'list' }),
        getRomaneios(signal, { status: 'PENDENTE', kind: 'COMPRA', mode: 'list' }),
        getRomaneios(signal, { status: 'CANCELADO', kind: 'COMPRA', mode: 'list' }),
      ]);

      const next: DashboardLoadResult = {
        venda: buildKind('VENDA', doneVenda || [], pendingVenda || [], canceledVenda || []),
        compra: buildKind('COMPRA', doneCompra || [], pendingCompra || [], canceledCompra || []),
        updatedAtIso: new Date().toISOString(),
      };

      dashboardCache = { userId: targetUserId, data: next };
      if (!signal.aborted) applyLoaded(next);
    } catch (e: any) {
      if (e?.name !== 'AbortError') {
        setError(String(e?.message || e));
      }
    } finally {
      const minLoadingMs = 650;
      const elapsedMs = Date.now() - startedAt;
      if (!signal.aborted && elapsedMs < minLoadingMs) {
        await new Promise((resolve) => setTimeout(resolve, minLoadingMs - elapsedMs));
      }
      if (!signal.aborted) setLoading(false);
    }
  };

  useEffect(() => {
    let alive = true;
    const run = async () => {
      try {
        const { data, error: userErr } = await supabase.auth.getUser();
        if (!alive) return;
        if (userErr) throw userErr;
        setUserId(data?.user?.id || '');
      } catch {
        if (!alive) return;
        setUserId('');
      } finally {
        if (!alive) return;
        setAuthReady(true);
      }
    };

    run();

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      setUserId(session?.user?.id || '');
      setAuthReady(true);
      if (event === 'SIGNED_OUT') {
        dashboardCache = null;
      }
    });

    return () => {
      alive = false;
      controllerRef.current?.abort();
      sub.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!authReady) return;
    if (!userId) return;
    if (dashboardCache && dashboardCache.userId === userId) {
      applyLoaded(dashboardCache.data);
      setLoading(false);
      return;
    }

    setVendaMetrics(emptyMetrics);
    setCompraMetrics(emptyMetrics);
    setVendaSeries7d([]);
    setCompraSeries7d([]);
    setTopCliente(null);
    setTopProdutor(null);
    setUpdatedAtIso('');
    void loadDashboard(false, userId);
  }, [authReady, userId]);

  const vendaTodayDeltaPct = useMemo(() => safePercentDelta(vendaMetrics.todayTotal, vendaMetrics.yesterdayTotal), [vendaMetrics]);
  const vendaMonthProgress = useMemo(() => {
    if (goalMonth <= 0) return 0;
    const p = vendaMetrics.monthTotal / goalMonth;
    if (!Number.isFinite(p)) return 0;
    return Math.max(0, Math.min(1, p));
  }, [vendaMetrics.monthTotal]);
  const vendaTicketMedio = useMemo(
    () => (vendaMetrics.monthCount > 0 ? vendaMetrics.monthTotal / vendaMetrics.monthCount : 0),
    [vendaMetrics]
  );

  const compraTodayDeltaPct = useMemo(() => safePercentDelta(compraMetrics.todayTotal, compraMetrics.yesterdayTotal), [compraMetrics]);
  const compraMonthProgress = useMemo(() => {
    if (goalMonth <= 0) return 0;
    const p = compraMetrics.monthTotal / goalMonth;
    if (!Number.isFinite(p)) return 0;
    return Math.max(0, Math.min(1, p));
  }, [compraMetrics.monthTotal]);
  const compraTicketMedio = useMemo(
    () => (compraMetrics.monthCount > 0 ? compraMetrics.monthTotal / compraMetrics.monthCount : 0),
    [compraMetrics]
  );

  const vendaPendingIsAlert = vendaMetrics.overduePendingCount > 0;
  const compraPendingIsAlert = compraMetrics.overduePendingCount > 0;

  const donutItemsVenda = useMemo(
    () => [
      { label: 'Concluídos', value: vendaMetrics.doneCount, color: '#22c55e', bg: 'bg-green-500' },
      { label: 'Pendentes', value: vendaMetrics.pendingCount, color: '#a855f7', bg: 'bg-purple-500' },
      { label: 'Cancelados', value: vendaMetrics.canceledCount, color: '#ef4444', bg: 'bg-red-500' },
    ],
    [vendaMetrics]
  );

  const donutItemsCompra = useMemo(
    () => [
      { label: 'Concluídos', value: compraMetrics.doneCount, color: '#22c55e', bg: 'bg-green-500' },
      { label: 'Pendentes', value: compraMetrics.pendingCount, color: '#3b82f6', bg: 'bg-blue-500' },
      { label: 'Cancelados', value: compraMetrics.canceledCount, color: '#ef4444', bg: 'bg-red-500' },
    ],
    [compraMetrics]
  );

  return (
    <div className="p-4 md:p-8 space-y-6">
      {loading && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 shadow-2xl rounded-[28px] px-8 py-8 flex flex-col items-center gap-4 w-[92%] max-w-sm">
            <div className="w-14 h-14 rounded-full border-4 border-gray-200 dark:border-slate-700 border-t-purple-600 dark:border-t-purple-500 animate-spin" />
            <div className="text-center">
              <div className="text-[11px] font-black uppercase tracking-widest text-gray-400 dark:text-slate-500">
                Carregando
              </div>
              <div className="text-sm font-black text-gray-900 dark:text-white mt-1">Atualizando resultados…</div>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white dark:bg-slate-900 rounded-[28px] border border-gray-100 dark:border-slate-800 shadow-sm p-6 md:p-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-black text-gray-300 dark:text-slate-600 uppercase tracking-widest">Dashboard</p>
            <h1 className="text-xl md:text-2xl font-black text-gray-900 dark:text-white tracking-tight">Visão Geral</h1>
            <p className="text-[11px] font-bold text-gray-500 dark:text-slate-400 mt-1">
              {loading
                ? 'Atualizando métricas...'
                : error
                  ? `Erro: ${error}`
                  : updatedAtIso
                    ? `Atualizado em ${new Date(updatedAtIso).toLocaleString('pt-BR')}.`
                    : 'Métricas atualizadas.'}
            </p>
          </div>
          <div className="hidden md:flex items-center gap-2">
            <button
              type="button"
              onClick={() => loadDashboard(true, userId)}
              disabled={loading}
              className="inline-flex items-center gap-2 px-3 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-600/60 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] transition-colors"
              aria-label="Atualizar gráfico"
              title="Atualizar gráfico"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              Atualizar
            </button>
            <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 dark:bg-slate-800/60 border border-gray-100 dark:border-slate-700 rounded-2xl">
              <CalendarDays size={16} className="text-gray-400" />
              <span className="text-[10px] font-black uppercase tracking-widest text-gray-500 dark:text-slate-400">
                {isoToday().split('-').reverse().join('/')}
              </span>
            </div>
          </div>
        </div>
        <div className="md:hidden mt-4">
          <button
            type="button"
            onClick={() => loadDashboard(true, userId)}
            disabled={loading}
            className="w-full inline-flex items-center justify-center gap-2 px-3 py-3 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-600/60 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] transition-colors"
            aria-label="Atualizar gráfico"
            title="Atualizar gráfico"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            Atualizar gráfico
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-slate-900 rounded-[28px] border border-gray-100 dark:border-slate-800 shadow-sm p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[10px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-widest">
                Faturamento Hoje
              </p>
              <p className="text-2xl font-black text-green-600 dark:text-green-400 mt-2">
                {formatCurrency(vendaMetrics.todayTotal)}
              </p>
              <p className="text-[11px] font-bold text-gray-500 dark:text-slate-400 mt-1">
                {vendaTodayDeltaPct === null
                  ? 'vs ontem: -'
                  : `${vendaTodayDeltaPct >= 0 ? '+' : ''}${vendaTodayDeltaPct.toFixed(1)}% vs ontem`}
              </p>
            </div>
            <div className="bg-green-50 dark:bg-green-900/20 p-3 rounded-2xl">
              <TrendingUp size={20} className="text-green-600 dark:text-green-400" />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-[28px] border border-gray-100 dark:border-slate-800 shadow-sm p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[10px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-widest">
                Faturamento do Mês
              </p>
              <p className="text-2xl font-black text-gray-900 dark:text-white mt-2 truncate">{formatCurrency(vendaMetrics.monthTotal)}</p>
              <div className="mt-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[10px] font-black uppercase tracking-widest text-gray-400 dark:text-slate-500">
                    Meta {formatCurrency(goalMonth)}
                  </span>
                  <span className="text-[10px] font-black uppercase tracking-widest text-gray-500 dark:text-slate-400">
                    {Math.round(vendaMonthProgress * 100)}%
                  </span>
                </div>
                <div className="h-2.5 bg-gray-100 dark:bg-slate-800 rounded-full overflow-hidden mt-2 border border-gray-100 dark:border-slate-700">
                  <div
                    className="h-full bg-yellow-400 rounded-full transition-all"
                    style={{ width: `${Math.round(vendaMonthProgress * 100)}%` }}
                  />
                </div>
              </div>
            </div>
            <div className="bg-yellow-50 dark:bg-yellow-900/20 p-3 rounded-2xl">
              <Wallet size={20} className="text-yellow-600 dark:text-yellow-400" />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-[28px] border border-gray-100 dark:border-slate-800 shadow-sm p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[10px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-widest">
                Ticket Médio
              </p>
              <p className="text-2xl font-black text-indigo-700 dark:text-indigo-300 mt-2">{formatCurrency(vendaTicketMedio)}</p>
              <p className="text-[11px] font-bold text-gray-500 dark:text-slate-400 mt-1">{vendaMetrics.monthCount} romaneio(s) no mês</p>
            </div>
            <div className="bg-indigo-50 dark:bg-indigo-900/20 p-3 rounded-2xl">
              <Receipt size={20} className="text-indigo-600 dark:text-indigo-400" />
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-slate-900 rounded-[28px] border border-gray-100 dark:border-slate-800 shadow-sm p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[10px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-widest">Compras Hoje</p>
              <p className="text-2xl font-black text-blue-600 dark:text-blue-400 mt-2">{formatCurrency(compraMetrics.todayTotal)}</p>
              <p className="text-[11px] font-bold text-gray-500 dark:text-slate-400 mt-1">
                {compraTodayDeltaPct === null
                  ? 'vs ontem: -'
                  : `${compraTodayDeltaPct >= 0 ? '+' : ''}${compraTodayDeltaPct.toFixed(1)}% vs ontem`}
              </p>
            </div>
            <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-2xl">
              <ShoppingCart size={20} className="text-blue-600 dark:text-blue-400" />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-[28px] border border-gray-100 dark:border-slate-800 shadow-sm p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[10px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-widest">Compras do Mês</p>
              <p className="text-2xl font-black text-gray-900 dark:text-white mt-2 truncate">{formatCurrency(compraMetrics.monthTotal)}</p>
            </div>
            <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-2xl">
              <Wallet size={20} className="text-blue-600 dark:text-blue-400" />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-[28px] border border-gray-100 dark:border-slate-800 shadow-sm p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[10px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-widest">Ticket Médio Compra</p>
              <p className="text-2xl font-black text-blue-700 dark:text-blue-300 mt-2">{formatCurrency(compraTicketMedio)}</p>
              <p className="text-[11px] font-bold text-gray-500 dark:text-slate-400 mt-1">{compraMetrics.monthCount} romaneio(s) no mês</p>
            </div>
            <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-2xl">
              <Receipt size={20} className="text-blue-600 dark:text-blue-400" />
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div className="bg-white dark:bg-slate-900 rounded-[28px] border border-gray-100 dark:border-slate-800 shadow-sm p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[10px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-widest">Faturamento</p>
              <h2 className="text-sm md:text-base font-black text-gray-900 dark:text-white uppercase tracking-tight mt-1">
                Venda · últimos 7 dias (não cancelados)
              </h2>
              <p className="text-[11px] font-bold text-gray-500 dark:text-slate-400 mt-1">
                {loading
                  ? 'Carregando série...'
                  : vendaSeries7d.length
                    ? `Pico: ${formatCurrency(Math.max(...vendaSeries7d.map((p) => p.value)))}`
                    : '-'}
              </p>
            </div>
          </div>

          <div className="mt-4">
            <LineChart points={vendaSeries7d} color="#a855f7" gradientId="dashAreaVenda" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-[28px] border border-gray-100 dark:border-slate-800 shadow-sm p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[10px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-widest">Faturamento</p>
              <h2 className="text-sm md:text-base font-black text-gray-900 dark:text-white uppercase tracking-tight mt-1">
                Compra · últimos 7 dias (não cancelados)
              </h2>
              <p className="text-[11px] font-bold text-gray-500 dark:text-slate-400 mt-1">
                {loading
                  ? 'Carregando série...'
                  : compraSeries7d.length
                    ? `Pico: ${formatCurrency(Math.max(...compraSeries7d.map((p) => p.value)))}`
                    : '-'}
              </p>
            </div>
          </div>

          <div className="mt-4">
            <LineChart points={compraSeries7d} color="#3b82f6" gradientId="dashAreaCompra" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div className="bg-white dark:bg-slate-900 rounded-[28px] border border-gray-100 dark:border-slate-800 shadow-sm p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[10px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-widest">Top Cliente</p>
              <h2 className="text-sm md:text-base font-black text-gray-900 dark:text-white uppercase tracking-tight mt-1 truncate">
                {topCliente?.name || '-'}
              </h2>
              <div className="mt-3 space-y-1">
                <p className="text-[11px] font-bold text-gray-500 dark:text-slate-400">
                  {topCliente ? `${topCliente.count} venda(s) no mês` : 'Sem dados no mês'}
                </p>
                <p className="text-[11px] font-black text-gray-700 dark:text-slate-200">
                  {topCliente ? formatCurrency(topCliente.total) : '-'}
                </p>
              </div>
            </div>
            <div className="bg-purple-50 dark:bg-purple-900/20 p-3 rounded-2xl">
              <Users size={20} className="text-purple-600 dark:text-purple-400" />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-[28px] border border-gray-100 dark:border-slate-800 shadow-sm p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[10px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-widest">Top Produtor</p>
              <h2 className="text-sm md:text-base font-black text-gray-900 dark:text-white uppercase tracking-tight mt-1 truncate">
                {topProdutor?.name || '-'}
              </h2>
              <div className="mt-3 space-y-1">
                <p className="text-[11px] font-bold text-gray-500 dark:text-slate-400">
                  {topProdutor ? `${topProdutor.count} compra(s) no mês` : 'Sem dados no mês'}
                </p>
                <p className="text-[11px] font-black text-gray-700 dark:text-slate-200">
                  {topProdutor ? formatCurrency(topProdutor.total) : '-'}
                </p>
              </div>
            </div>
            <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-2xl">
              <Users size={20} className="text-blue-600 dark:text-blue-400" />
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div className="bg-white dark:bg-slate-900 rounded-[28px] border border-gray-100 dark:border-slate-800 shadow-sm p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[10px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-widest">Distribuição</p>
              <h2 className="text-sm md:text-base font-black text-gray-900 dark:text-white uppercase tracking-tight mt-1">Venda · status</h2>
              <p className="text-[11px] font-bold text-gray-500 dark:text-slate-400 mt-1">
                {vendaPendingIsAlert
                  ? `Atenção: ${vendaMetrics.overduePendingCount} pendente(s) com +${overdueThresholdDays} dias.`
                  : 'Sem alertas críticos.'}
              </p>
            </div>
          </div>

          <div className="mt-4">
            <DonutChart items={donutItemsVenda} />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-[28px] border border-gray-100 dark:border-slate-800 shadow-sm p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[10px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-widest">Distribuição</p>
              <h2 className="text-sm md:text-base font-black text-gray-900 dark:text-white uppercase tracking-tight mt-1">Compra · status</h2>
              <p className="text-[11px] font-bold text-gray-500 dark:text-slate-400 mt-1">
                {compraPendingIsAlert
                  ? `Atenção: ${compraMetrics.overduePendingCount} pendente(s) com +${overdueThresholdDays} dias.`
                  : 'Sem alertas críticos.'}
              </p>
            </div>
          </div>

          <div className="mt-4">
            <DonutChart items={donutItemsCompra} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
