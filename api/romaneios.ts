import { supabase } from '../supabaseClient';
import { RomaneioData, RomaneioStatus } from '../types';

const applyAbortSignal = (query: any, signal?: AbortSignal) => {
  if (signal && typeof query?.abortSignal === 'function') return query.abortSignal(signal);
  return query;
};

const throwQueryError = (error: any) => {
  if (!error) return;
  const msg = String(error.message || error);
  if (msg.includes('AbortError') || msg.includes('signal is aborted')) {
    const e: any = new Error(msg);
    e.name = 'AbortError';
    throw e;
  }
  const details = error?.details ? ` ${String(error.details)}` : '';
  const hint = error?.hint ? ` ${String(error.hint)}` : '';
  const code = error?.code ? ` ${String(error.code)}` : '';
  const status = error?.status ? ` ${String(error.status)}` : '';
  throw new Error(`${msg}${details}${hint}${code}${status}`.trim());
};

const readJson = <T,>(key: string): T | null => {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
};

const writeJson = (key: string, value: unknown) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
  }
};

const deleteJson = (key: string) => {
  try {
    localStorage.removeItem(key);
  } catch {
  }
};

const getRomaneioBackupKey = (id: string) => `bb_romaneio_backup_${id}`;

export const getRomaneios = async (signal?: AbortSignal): Promise<RomaneioData[]> => {
  const tryFetch = async (select: string) => {
    const query = supabase.from('romaneios').select(select);
    const { data, error } = await applyAbortSignal(query, signal);
    throwQueryError(error);
    return (data || []) as any[];
  };

  let rows: any[] = [];
  try {
    rows = await tryFetch('*, company:companies(*), customer:customers(*)');
  } catch (err: any) {
    const msg = String(err?.message || '');
    if (msg.includes('Could not find a relationship') || msg.includes('schema cache')) {
      rows = await tryFetch('*');
    } else {
      throw err;
    }
  }

  return rows.map((r) => {
    const merged: any = { ...r };
    const payloadObj = merged?.payload && typeof merged.payload === 'object' ? merged.payload : null;
    if (payloadObj) {
      const fromPayload: any = { ...payloadObj };
      delete fromPayload.id;
      delete fromPayload.created_at;
      delete fromPayload.company_id;
      delete fromPayload.customer_id;
      delete fromPayload.companyId;
      delete fromPayload.customerId;
      delete fromPayload.number;
      delete fromPayload.status;
      Object.assign(merged, fromPayload);
    }

    if (merged.guia != null && merged.number == null) merged.number = String(merged.guia);
    if (merged.numero != null && merged.number == null) merged.number = String(merged.numero);
    if (merged.data_de_emissao && !merged.emissionDate) merged.emissionDate = merged.data_de_emissao;
    if (merged.criado_em && !merged.created_at) merged.created_at = merged.criado_em;
    if (merged.id_da_empresa && !merged.company_id) merged.company_id = merged.id_da_empresa;
    if (merged.id_do_cliente && !merged.customer_id) merged.customer_id = merged.id_do_cliente;
    if (merged['observações'] && !merged.observation) merged.observation = merged['observações'];
    if (merged.observacoes && !merged.observation) merged.observation = merged.observacoes;

    if (merged.id != null) merged.id = String(merged.id);

    if (typeof merged.status === 'string') {
      const s = merged.status.trim().toUpperCase();
      if (s.startsWith('PEND')) merged.status = 'PENDENTE';
      else if (s.replaceAll('Í', 'I').startsWith('CONCL')) merged.status = 'CONCLUÍDO';
      else if (s.startsWith('CANC')) merged.status = 'CANCELADO';
    }

    if (!merged.client && merged.customer) merged.client = merged.customer;
    if (!merged.customer && merged.client) merged.customer = merged.client;

    if (Array.isArray(merged.items) && !Array.isArray(merged.products)) {
      merged.products = merged.items;
    }
    if (Array.isArray(merged.romaneio_expenses) && !Array.isArray(merged.expenses)) {
      merged.expenses = merged.romaneio_expenses;
    }

    const backup = merged?.id ? readJson<Partial<RomaneioData>>(getRomaneioBackupKey(String(merged.id))) : null;
    if (backup) {
      const filled: any = { ...merged };
      for (const [k, v] of Object.entries(backup)) {
        if (filled[k] === undefined || filled[k] === null || filled[k] === '') filled[k] = v as any;
      }
      if (!Array.isArray(filled.products) && Array.isArray((backup as any).products)) filled.products = (backup as any).products;
      if (!Array.isArray(filled.expenses) && Array.isArray((backup as any).expenses)) filled.expenses = (backup as any).expenses;
      if (!filled.client && (backup as any).client) filled.client = (backup as any).client;
      if (!filled.banking && (backup as any).banking) filled.banking = (backup as any).banking;
      if (!filled.company && (backup as any).company) filled.company = (backup as any).company;
      if (!filled.customer && (backup as any).customer) filled.customer = (backup as any).customer;
      return filled as RomaneioData;
    }

    return merged as RomaneioData;
  });
};

export const addRomaneio = async (
  romaneio: Omit<RomaneioData, 'id' | 'created_at'>,
  signal?: AbortSignal
) => {
  const tryInsert = async (payload: any) => {
    for (const k of Object.keys(payload)) {
      if (payload[k] === '') payload[k] = null;
    }
    const query = supabase
      .from('romaneios')
      .insert([payload])
      .select('*')
      .single();
    const { data, error } = await applyAbortSignal(query, signal);
    if (error) return { data: null as any, error };
    return { data, error: null as any };
  };

  const productsArr: any[] = Array.isArray((romaneio as any)?.products) ? ((romaneio as any).products as any[]) : [];
  const expensesArr: any[] = Array.isArray((romaneio as any)?.expenses) ? ((romaneio as any).expenses as any[]) : [];
  const totalFromItems =
    productsArr.reduce((acc, p) => acc + (Number(p?.quantity || 0) * Number(p?.unitValue || 0)), 0) +
    expensesArr.reduce((acc, e) => acc + (Number(e?.total || 0) || 0), 0);
  const weightFromItems = productsArr.reduce((acc, p) => acc + (Number(p?.quantity || 0) * Number(p?.kg || 0)), 0);

  const toOptionalNumber = (v: unknown) => {
    if (v === null || v === undefined) return null;
    if (typeof v === 'number' && Number.isFinite(v)) return v;
    const s = String(v).trim();
    if (!s) return null;
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
  };

  const getNextNumericId = async () => {
    const q = supabase.from('romaneios').select('id').order('id', { ascending: false }).limit(1).single();
    const { data, error } = await applyAbortSignal(q, signal);
    if (error) return Date.now();
    const current = (data as any)?.id;
    const asNumber = toOptionalNumber(current);
    if (asNumber === null) return Date.now();
    const next = asNumber + 1;
    return Number.isFinite(next) ? next : Date.now();
  };

  const statusRaw = (romaneio as any)?.status ?? 'PENDENTE';
  const statusNorm = String(statusRaw).trim().toUpperCase();
  const statusPt =
    statusNorm === 'CONCLUÍDO' || statusNorm === 'CONCLUIDO'
      ? 'Concluído'
      : statusNorm === 'CANCELADO'
        ? 'Cancelado'
        : 'Pendente';

  const baseNumber = toOptionalNumber((romaneio as any)?.number);
  const baseCompanyId = (romaneio as any)?.company_id ?? (romaneio as any)?.companyId ?? (romaneio as any)?.company?.id ?? null;
  const baseCustomerId = (romaneio as any)?.customer_id ?? (romaneio as any)?.customerId ?? (romaneio as any)?.customer?.id ?? null;
  const baseDate = (romaneio as any)?.emissionDate ?? (romaneio as any)?.saleDate ?? null;
  const baseObs = (romaneio as any)?.observation ?? null;

  const candidatePt: any = {
    guia: baseNumber,
    numero: baseNumber,
    data_de_emissao: baseDate,
    status: statusPt,
    id_da_empresa: toOptionalNumber(baseCompanyId),
    id_do_cliente: toOptionalNumber(baseCustomerId),
    observacoes: baseObs,
    'observações': baseObs,
    montante_total: Number.isFinite(totalFromItems) ? totalFromItems : null,
    peso_total: Number.isFinite(weightFromItems) ? weightFromItems : null,
  };

  const candidateEn: any = {
    number: baseNumber,
    status: statusNorm || 'PENDENTE',
    company_id: baseCompanyId,
    customer_id: baseCustomerId,
    total_value: Number.isFinite(totalFromItems) ? totalFromItems : null,
    total_weight: Number.isFinite(weightFromItems) ? weightFromItems : null,
  };

  const candidates = [candidatePt, candidateEn];
  let lastError: any = null;

  for (const candidate of candidates) {
    const payload: any = { ...candidate };
    for (let attempt = 0; attempt < 20; attempt++) {
      const { data, error } = await tryInsert(payload);
      if (!error) {
        if (!data) throw new Error('Failed to create romaneio');
        const merged: any = { ...data };

        if (merged.guia != null && merged.number == null) merged.number = String(merged.guia);
        if (merged.numero != null && merged.number == null) merged.number = String(merged.numero);
        if (merged.data_de_emissao && !merged.emissionDate) merged.emissionDate = merged.data_de_emissao;
        if (merged.criado_em && !merged.created_at) merged.created_at = merged.criado_em;
        if (merged.id_da_empresa && !merged.company_id) merged.company_id = merged.id_da_empresa;
        if (merged.id_do_cliente && !merged.customer_id) merged.customer_id = merged.id_do_cliente;
        if (merged['observações'] && !merged.observation) merged.observation = merged['observações'];
        if (merged.observacoes && !merged.observation) merged.observation = merged.observacoes;

        if (merged.id != null) merged.id = String(merged.id);

        const backupId = String(merged.id || '');
        if (backupId) {
          const fullBackup: any = {
            ...(romaneio as any),
            id: backupId,
            created_at: merged.created_at ?? merged.criado_em ?? (romaneio as any)?.created_at,
            status: merged.status ?? (romaneio as any)?.status,
            number: merged.number ?? String((romaneio as any)?.number ?? ''),
          };
          writeJson(getRomaneioBackupKey(backupId), fullBackup);
        }

        if (backupId) {
          const updatePayload: any = { payload: { ...(romaneio as any), id: backupId } };
          const q = supabase.from('romaneios').update(updatePayload).eq('id', backupId).select('*').single();
          const res = await applyAbortSignal(q, signal);
          if (res?.error) {
            const msg = String(res.error.message || res.error);
            if (!(msg.includes("Could not find the 'payload'") || msg.includes('schema cache') || msg.includes('does not exist'))) {
              throwQueryError(res.error);
            }
          }
        }

        return merged as any;
      }

      lastError = error;
      const msg = String(error.message || error);

      if (msg.includes('null value in column') && msg.includes('"id"')) {
        if (!('id' in payload)) {
          payload.id = await getNextNumericId();
          continue;
        }
      }

      const match =
        msg.match(/Could not find the '([^']+)' column/) ||
        msg.match(/column "([^"]+)" of relation "[^"]+" does not exist/i) ||
        msg.match(/column "([^"]+)" does not exist/i);
      if (match?.[1]) {
        const missingColumn = match[1];
        if (missingColumn in payload) {
          delete payload[missingColumn];
          continue;
        }
      }

      if (
        msg.toLowerCase().includes('invalid input syntax') &&
        (msg.includes('bigint') || msg.includes('integer') || msg.includes('numeric'))
      ) {
        if ('id_da_empresa' in payload) payload.id_da_empresa = null;
        if ('id_do_cliente' in payload) payload.id_do_cliente = null;
        if ('guia' in payload) payload.guia = toOptionalNumber(payload.guia);
        if ('numero' in payload) payload.numero = toOptionalNumber(payload.numero);
        if ('montante_total' in payload) payload.montante_total = toOptionalNumber(payload.montante_total);
        if ('peso_total' in payload) payload.peso_total = toOptionalNumber(payload.peso_total);
        continue;
      }

      break;
    }
  }

  throwQueryError(lastError);
};

export const deleteRomaneio = async (id: string, signal?: AbortSignal): Promise<void> => {
  const query = supabase.from('romaneios').delete().eq('id', id);
  const { error } = await applyAbortSignal(query, signal);
  throwQueryError(error);
  deleteJson(getRomaneioBackupKey(String(id)));
};

export const updateRomaneioStatus = async (id: string, status: RomaneioStatus, signal?: AbortSignal): Promise<void> => {
  const query = supabase.from('romaneios').update({ status }).eq('id', id);
  const { error } = await applyAbortSignal(query, signal);
  throwQueryError(error);
};
