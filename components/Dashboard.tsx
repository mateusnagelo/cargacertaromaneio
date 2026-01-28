import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CalendarDays, Receipt, TrendingUp, Wallet } from 'lucide-react';
import { getRomaneios } from '../api/romaneios';
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
  const itemsTotal = productsTotal + expensesTotal;
  const payloadObj = (r as any)?.payload && typeof (r as any)?.payload === 'object' ? (r as any).payload : null;
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
  return itemsTotal > 0 ? itemsTotal : dbTotal;
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

const LineChart: React.FC<{ points: SeriesPoint[]; height?: number }> = ({ points, height = 140 }) => {
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
          <linearGradient id="dashArea" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#a855f7" stopOpacity="0.22" />
            <stop offset="100%" stopColor="#a855f7" stopOpacity="0.02" />
          </linearGradient>
        </defs>

        <line x1={padX} y1={height - padY} x2={width - padX} y2={height - padY} stroke="rgba(148,163,184,0.35)" strokeWidth="1" />
        <line x1={padX} y1={padY} x2={padX} y2={height - padY} stroke="rgba(148,163,184,0.35)" strokeWidth="1" />

        {areaD ? <path d={areaD} fill="url(#dashArea)" /> : null}
        {lineD ? <path d={lineD} fill="none" stroke="#a855f7" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /> : null}

        {points.map((p, i) => (
          <g key={p.iso}>
            <circle cx={xFor(i)} cy={yFor(p.value)} r="4.5" fill="#a855f7" />
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

const Dashboard: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState<DashboardMetrics>({
    todayTotal: 0,
    yesterdayTotal: 0,
    monthTotal: 0,
    monthCount: 0,
    pendingCount: 0,
    doneCount: 0,
    canceledCount: 0,
    overduePendingCount: 0,
    oldestPendingDays: null,
  });
  const [series7d, setSeries7d] = useState<SeriesPoint[]>([]);
  const [error, setError] = useState('');

  const goalMonth = 200_000;
  const overdueThresholdDays = 3;

  useEffect(() => {
    const controller = new AbortController();
    const signal = controller.signal;

    const run = async () => {
      const startedAt = Date.now();
      try {
        setLoading(true);
        setError('');

        const [done, pending, canceled] = await Promise.all([
          getRomaneios(signal, { status: 'CONCLUÍDO', mode: 'list' }),
          getRomaneios(signal, { status: 'PENDENTE', mode: 'list' }),
          getRomaneios(signal, { status: 'CANCELADO', mode: 'list' }),
        ]);

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

        for (const r of nonCanceled) {
          const d = getPrimaryDate(r);
          const dt = dateForTodayMetric(r);
          const total = computeTotal(r);
          if (dt === today) todayTotal += total;
          if (dt === yesterday) yesterdayTotal += total;
          if (d && d.slice(0, 7) === ym) {
            monthTotal += total;
            monthCount += 1;
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

        setMetrics({
          todayTotal,
          yesterdayTotal,
          monthTotal,
          monthCount,
          pendingCount: (pending || []).length,
          doneCount: (done || []).length,
          canceledCount: (canceled || []).length,
          overduePendingCount,
          oldestPendingDays,
        });
        setSeries7d(points);
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
        setLoading(false);
      }
    };

    run();
    return () => controller.abort();
  }, []);

  const todayDeltaPct = useMemo(() => safePercentDelta(metrics.todayTotal, metrics.yesterdayTotal), [metrics]);
  const monthProgress = useMemo(() => {
    if (goalMonth <= 0) return 0;
    const p = metrics.monthTotal / goalMonth;
    if (!Number.isFinite(p)) return 0;
    return Math.max(0, Math.min(1, p));
  }, [metrics.monthTotal]);
  const ticketMedio = useMemo(() => (metrics.monthCount > 0 ? metrics.monthTotal / metrics.monthCount : 0), [metrics]);

  const pendingIsAlert = metrics.overduePendingCount > 0;

  const donutItems = useMemo(
    () => [
      { label: 'Concluídos', value: metrics.doneCount, color: '#22c55e', bg: 'bg-green-500' },
      { label: 'Pendentes', value: metrics.pendingCount, color: '#a855f7', bg: 'bg-purple-500' },
      { label: 'Cancelados', value: metrics.canceledCount, color: '#ef4444', bg: 'bg-red-500' },
    ],
    [metrics]
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
              {loading ? 'Atualizando métricas...' : error ? `Erro: ${error}` : 'Métricas atualizadas.'}
            </p>
          </div>
          <div className="hidden md:flex items-center gap-2 px-3 py-2 bg-gray-50 dark:bg-slate-800/60 border border-gray-100 dark:border-slate-700 rounded-2xl">
            <CalendarDays size={16} className="text-gray-400" />
            <span className="text-[10px] font-black uppercase tracking-widest text-gray-500 dark:text-slate-400">
              {isoToday().split('-').reverse().join('/')}
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 rounded-[28px] border border-gray-100 dark:border-slate-800 shadow-sm p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[10px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-widest">
                Faturamento Hoje
              </p>
              <p className="text-2xl font-black text-green-600 dark:text-green-400 mt-2">
                {formatCurrency(metrics.todayTotal)}
              </p>
              <p className="text-[11px] font-bold text-gray-500 dark:text-slate-400 mt-1">
                {todayDeltaPct === null
                  ? 'vs ontem: -'
                  : `${todayDeltaPct >= 0 ? '+' : ''}${todayDeltaPct.toFixed(1)}% vs ontem`}
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
              <p className="text-2xl font-black text-gray-900 dark:text-white mt-2 truncate">{formatCurrency(metrics.monthTotal)}</p>
              <div className="mt-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[10px] font-black uppercase tracking-widest text-gray-400 dark:text-slate-500">
                    Meta {formatCurrency(goalMonth)}
                  </span>
                  <span className="text-[10px] font-black uppercase tracking-widest text-gray-500 dark:text-slate-400">
                    {Math.round(monthProgress * 100)}%
                  </span>
                </div>
                <div className="h-2.5 bg-gray-100 dark:bg-slate-800 rounded-full overflow-hidden mt-2 border border-gray-100 dark:border-slate-700">
                  <div
                    className="h-full bg-yellow-400 rounded-full transition-all"
                    style={{ width: `${Math.round(monthProgress * 100)}%` }}
                  />
                </div>
              </div>
            </div>
            <div className="bg-yellow-50 dark:bg-yellow-900/20 p-3 rounded-2xl">
              <Wallet size={20} className="text-yellow-600 dark:text-yellow-400" />
            </div>
          </div>
        </div>

        <div
          className={`bg-white dark:bg-slate-900 rounded-[28px] border shadow-sm p-6 transition-colors ${
            pendingIsAlert
              ? 'border-red-200 dark:border-red-900/60 bg-red-50/40 dark:bg-red-900/10'
              : 'border-gray-100 dark:border-slate-800'
          }`}
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[10px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-widest">
                Romaneios Pendentes
              </p>
              <p className={`text-2xl font-black mt-2 ${pendingIsAlert ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-white'}`}>
                {metrics.pendingCount}
              </p>
              <p className="text-[11px] font-bold text-gray-500 dark:text-slate-400 mt-1">
                {metrics.overduePendingCount > 0
                  ? `${metrics.overduePendingCount} com +${overdueThresholdDays} dias`
                  : metrics.oldestPendingDays === null
                    ? 'Sem datas para análise'
                    : `Mais antigo: ${metrics.oldestPendingDays} dia(s)`}
              </p>
            </div>
            <div className={`p-3 rounded-2xl ${pendingIsAlert ? 'bg-red-100 dark:bg-red-900/30' : 'bg-purple-50 dark:bg-purple-900/20'}`}>
              {pendingIsAlert ? (
                <AlertTriangle size={20} className="text-red-600 dark:text-red-400" />
              ) : (
                <CalendarDays size={20} className="text-purple-600 dark:text-purple-400" />
              )}
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-[28px] border border-gray-100 dark:border-slate-800 shadow-sm p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[10px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-widest">
                Ticket Médio
              </p>
              <p className="text-2xl font-black text-indigo-700 dark:text-indigo-300 mt-2">{formatCurrency(ticketMedio)}</p>
              <p className="text-[11px] font-bold text-gray-500 dark:text-slate-400 mt-1">{metrics.monthCount} romaneio(s) no mês</p>
            </div>
            <div className="bg-indigo-50 dark:bg-indigo-900/20 p-3 rounded-2xl">
              <Receipt size={20} className="text-indigo-600 dark:text-indigo-400" />
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
                Últimos 7 dias (não cancelados)
              </h2>
              <p className="text-[11px] font-bold text-gray-500 dark:text-slate-400 mt-1">
                {loading ? 'Carregando série...' : series7d.length ? `Pico: ${formatCurrency(Math.max(...series7d.map((p) => p.value)))}` : '-'}
              </p>
            </div>
          </div>

          <div className="mt-4">
            <LineChart points={series7d} />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-[28px] border border-gray-100 dark:border-slate-800 shadow-sm p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[10px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-widest">Distribuição</p>
              <h2 className="text-sm md:text-base font-black text-gray-900 dark:text-white uppercase tracking-tight mt-1">Status dos romaneios</h2>
              <p className="text-[11px] font-bold text-gray-500 dark:text-slate-400 mt-1">
                {pendingIsAlert ? `Atenção: ${metrics.overduePendingCount} pendente(s) com +${overdueThresholdDays} dias.` : 'Sem alertas críticos.'}
              </p>
            </div>
          </div>

          <div className="mt-4">
            <DonutChart items={donutItems} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
