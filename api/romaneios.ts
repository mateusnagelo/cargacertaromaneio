import { supabase } from '../supabaseClient';
import { RomaneioData, RomaneioKind, RomaneioStatus } from '../types';

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

const getMissingColumnFromMessage = (msg: string) => {
  const marker = "Could not find the '";
  const idx = msg.indexOf(marker);
  if (idx !== -1) {
    const rest = msg.slice(idx + marker.length);
    const end = rest.indexOf("' column");
    if (end !== -1) return rest.slice(0, end);
  }

  const match =
    msg.match(/Could not find the '([^']+)' column/i) ||
    msg.match(/column "([^"]+)" of relation "[^"]+" does not exist/i) ||
    msg.match(/column "([^"]+)" does not exist/i);
  return match?.[1] ?? null;
};

export type RomaneioDateFilterField = 'EMISSAO' | 'CRIACAO';

export type GetRomaneiosOptions = {
  search?: string;
  status?: RomaneioStatus | 'TODOS';
  kind?: RomaneioKind | 'TODOS';
  companyId?: string;
  customerId?: string;
  minTotal?: number | null;
  maxTotal?: number | null;
  fromDate?: string;
  toDate?: string;
  dateField?: RomaneioDateFilterField;
  limit?: number | null;
  mode?: 'full' | 'list';
};

const normalizeStatusInput = (status: RomaneioStatus) => {
  const s = String(status ?? '').trim().toUpperCase();
  if (s === 'CONCLUÍDO' || s === 'CONCLUIDO') return 'CONCLUÍDO';
  if (s === 'CANCELADO') return 'CANCELADO';
  return 'PENDENTE';
};

const statusValuesForDb = (status: RomaneioStatus) => {
  const s = normalizeStatusInput(status);
  if (s === 'CONCLUÍDO')
    return [
      'CONCLUÍDO',
      'CONCLUIDO',
      'Concluído',
      'Concluido',
      'concluído',
      'concluido',
      'ENTREGUE',
      'Entregue',
      'entregue',
    ];
  if (s === 'CANCELADO') return ['CANCELADO', 'Cancelado', 'cancelado'];
  return ['PENDENTE', 'Pendente', 'pendente'];
};

const isUuidLike = (v: unknown) => {
  const s = String(v ?? '').trim();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
};

const toOptionalNumber = (v: unknown) => {
  if (v === null || v === undefined) return null;
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  const s = String(v).trim();
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
};

const mapRomaneioRow = (row: any, opts?: { applyPayload?: boolean; applyBackup?: boolean }) => {
  const applyPayload = opts?.applyPayload ?? true;
  const applyBackup = opts?.applyBackup ?? true;

  const merged: any = { ...(row || {}) };
  if (typeof merged?.payload === 'string') {
    const raw = String(merged.payload || '').trim();
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') merged.payload = parsed;
      } catch {
      }
    }
  }

  const normalizeStatusLoose = (v: unknown): RomaneioStatus | '' => {
    const s = String(v ?? '').trim();
    if (!s) return '';
    const up = s.toUpperCase();
    if (up.startsWith('PEND')) return 'PENDENTE';
    if (up.includes('SAIU') && up.includes('ENTREGA')) return 'PENDENTE';
    if (up.startsWith('FINALIZ')) return 'CONCLUÍDO';
    if (up.startsWith('FECH')) return 'CONCLUÍDO';
    if (up.startsWith('ENCERR')) return 'CONCLUÍDO';
    if (up.startsWith('PAGO')) return 'CONCLUÍDO';
    if (up.startsWith('ENTREG')) return 'CONCLUÍDO';
    if (up.replaceAll('Í', 'I').startsWith('CONCL')) return 'CONCLUÍDO';
    if (up.startsWith('CANC')) return 'CANCELADO';
    if (up.includes('CANCEL')) return 'CANCELADO';
    if (up.startsWith('ANUL')) return 'CANCELADO';
    return '';
  };

  const readObj = (v: unknown) => (v && typeof v === 'object' ? (v as any) : null);
  const pickStatusCandidates = (obj: any) => {
    if (!obj) return [] as any[];
    const nested =
      readObj(obj.romaneio) ||
      readObj(obj.pedido) ||
      readObj(obj.document) ||
      readObj(obj.entrega) ||
      readObj(obj.tracking) ||
      null;
    return [
      obj.status,
      obj.statusRomaneio,
      obj.status_romaneio,
      obj.situacao,
      obj.situação,
      obj.statusPedido,
      obj.status_pedido,
      obj.situacaoPedido,
      obj.situacao_pedido,
      nested?.status,
      nested?.statusRomaneio,
      nested?.status_romaneio,
      nested?.situacao,
      nested?.situação,
    ];
  };

  if (applyPayload) {
    const payloadObj = merged?.payload && typeof merged.payload === 'object' ? merged.payload : null;
    if (payloadObj) {
      const fromPayload: any = { ...payloadObj };
      delete fromPayload.id;
      delete fromPayload.created_at;
      delete fromPayload.company_id;
      delete fromPayload.customer_id;
      delete fromPayload.producer_id;
      delete fromPayload.companyId;
      delete fromPayload.customerId;
      delete fromPayload.producerId;

      const payloadNumber = fromPayload.number ?? fromPayload.guia ?? fromPayload.numero;
      if (merged.number !== undefined && merged.number !== null && merged.number !== '' && payloadNumber !== undefined) {
        delete fromPayload.number;
      }

      const mergedStatusNorm = normalizeStatusLoose(merged.status);
      const payloadStatusRaw =
        fromPayload.status ?? fromPayload.statusRomaneio ?? fromPayload.status_romaneio ?? fromPayload.situacao ?? fromPayload.situação;
      if (merged.status !== undefined && merged.status !== null && String(merged.status).trim() !== '') {
        delete fromPayload.status;
        delete fromPayload.statusRomaneio;
        delete fromPayload.status_romaneio;
        delete fromPayload.situacao;
        delete fromPayload.situação;
      } else if (payloadStatusRaw !== undefined) {
        fromPayload.status = payloadStatusRaw;
      }

      Object.assign(merged, fromPayload);
    }
  }

  if (merged.guia != null && merged.number == null) merged.number = String(merged.guia);
  if (merged.numero != null && merged.number == null) merged.number = String(merged.numero);
  if (merged.data_de_emissao && !merged.emissionDate) merged.emissionDate = merged.data_de_emissao;
  if (merged.criado_em && !merged.created_at) merged.created_at = merged.criado_em;
  if (merged.id_da_empresa && !merged.company_id) merged.company_id = merged.id_da_empresa;
  if (merged.id_do_cliente && !merged.customer_id) merged.customer_id = merged.id_do_cliente;
  if (merged['observações'] && !merged.observation) merged.observation = merged['observações'];
  if (merged.observacoes && !merged.observation) merged.observation = merged.observacoes;
  if (merged.due_date && !merged.dueDate) merged.dueDate = merged.due_date;
  if (merged.data_vencimento && !merged.dueDate) merged.dueDate = merged.data_vencimento;
  if (merged.data_de_vencimento && !merged.dueDate) merged.dueDate = merged.data_de_vencimento;
  if (merged.vencimento && !merged.dueDate) merged.dueDate = merged.vencimento;
  if (merged.payment_status && !merged.paymentStatus) merged.paymentStatus = merged.payment_status;
  if (merged.status_pagamento && !merged.paymentStatus) merged.paymentStatus = merged.status_pagamento;
  if (merged.payment_date && !merged.paymentDate) merged.paymentDate = merged.payment_date;
  if (merged.data_pagamento && !merged.paymentDate) merged.paymentDate = merged.data_pagamento;

  if (merged.id != null) merged.id = String(merged.id);

  {
    const payloadObj = merged?.payload && typeof merged.payload === 'object' ? merged.payload : null;
    const baseCandidates = [
      merged.status,
      merged.statusRomaneio,
      merged.status_romaneio,
      merged.situacao,
      merged.situação,
    ];
    const baseNormalized = baseCandidates.map(normalizeStatusLoose).filter(Boolean) as RomaneioStatus[];
    const basePreferred =
      baseNormalized.find((s) => s === 'CONCLUÍDO' || s === 'CANCELADO') || baseNormalized[0] || '';
    if (basePreferred) {
      merged.status = basePreferred;
    } else {
      const payloadCandidates = payloadObj ? pickStatusCandidates(payloadObj) : [];
      const normalized = payloadCandidates.map(normalizeStatusLoose).filter(Boolean) as RomaneioStatus[];
      const preferred = normalized.find((s) => s === 'CONCLUÍDO' || s === 'CANCELADO') || normalized[0] || '';
      if (preferred) merged.status = preferred;
    }
  }

  if (!merged.customer && merged.producer) merged.customer = merged.producer;
  if (!merged.customer_id && merged.producer_id) merged.customer_id = merged.producer_id;
  if (!merged.customerId && merged.customer_id) merged.customerId = String(merged.customer_id);
  if (!merged.client && merged.customer) merged.client = merged.customer;
  if (!merged.customer && merged.client) merged.customer = merged.client;

  if (Array.isArray(merged.items) && !Array.isArray(merged.products)) {
    merged.products = merged.items;
  }
  if (Array.isArray(merged.romaneio_expenses) && !Array.isArray(merged.expenses)) {
    merged.expenses = merged.romaneio_expenses;
  }

  if (applyBackup) {
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
      if ((filled.number === undefined || filled.number === null || filled.number === '') && filled.id != null) {
        filled.number = String(filled.id);
      }
      return filled as RomaneioData;
    }
  }

  if ((merged.number === undefined || merged.number === null || merged.number === '') && merged.id != null) {
    merged.number = String(merged.id);
  }
  return merged as RomaneioData;
};

export const getRomaneios = async (signal?: AbortSignal, options?: GetRomaneiosOptions): Promise<RomaneioData[]> => {
  const opts = options ?? {};
  const mode: 'full' | 'list' = opts.mode ?? 'full';
  const search = String(opts.search ?? '').trim();
  const searchDigits = search.replace(/\D/g, '');
  const searchIsNumber = !!searchDigits && searchDigits === search;

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

  const fromDateOnly = toIsoDateOnly(opts.fromDate);
  const toDateOnly = toIsoDateOnly(opts.toDate);
  const hasDateFilter = !!fromDateOnly || !!toDateOnly;
  const dateField: RomaneioDateFilterField = (opts.dateField as any) || 'EMISSAO';

  const normalizeLimit = (v: unknown) => {
    if (v === null || v === undefined) return null;
    const n = typeof v === 'number' ? v : Number(String(v).trim());
    if (!Number.isFinite(n)) return null;
    const int = Math.floor(n);
    return int >= 1 ? int : null;
  };
  const limit = normalizeLimit(opts.limit);
  const kindFilter: RomaneioKind | null =
    (opts.kind as any) && opts.kind !== 'TODOS' ? (String(opts.kind).trim().toUpperCase() as RomaneioKind) : null;
  const queryLimit = kindFilter && limit !== null ? Math.min(200, Math.max(limit, limit * 5)) : limit;

  const inferKind = (r?: Partial<RomaneioData> | null): RomaneioKind => {
    const k = String((r as any)?.kind ?? '').trim().toUpperCase();
    if (k === 'COMPRA') return 'COMPRA';
    if (k === 'VENDA') return 'VENDA';
    const producerId = (r as any)?.producer_id ?? (r as any)?.producerId ?? (r as any)?.producer?.id ?? null;
    if (producerId) return 'COMPRA';
    const nature = String((r as any)?.natureOfOperation ?? '').trim().toUpperCase();
    if (nature.includes('COMPRA')) return 'COMPRA';
    return 'VENDA';
  };

  const normalizeTotalNumber = (v: unknown) => {
    if (v === null || v === undefined) return null;
    const n = typeof v === 'number' ? v : Number(String(v).replace(',', '.'));
    return Number.isFinite(n) ? n : null;
  };

  const minTotal = normalizeTotalNumber(opts.minTotal);
  const maxTotal = normalizeTotalNumber(opts.maxTotal);

  const tryFetch = async (
    select: string,
    withRelations: boolean,
    config?: {
      totalColumn?: string | null;
      numberColumn?: string | null;
      companyIdColumn?: string | null;
      customerIdColumn?: string | null;
      producerIdColumn?: string | null;
      dateColumn?: string | null;
      dateMode?: 'timestamp' | 'date_only';
      ignoreStatus?: boolean;
    }
  ) => {
    let query: any = supabase.from('romaneios').select(select);

    if (!config?.ignoreStatus && opts.status && opts.status !== 'TODOS') {
      query = query.in('status', statusValuesForDb(opts.status));
    }

    if (opts.companyId) {
      const col = config?.companyIdColumn ?? 'company_id';
      if (col) query = query.eq(col, String(opts.companyId));
    }

    if (opts.customerId) {
      if (kindFilter === 'COMPRA') {
        const col = config?.producerIdColumn ?? 'producer_id';
        if (col) query = query.eq(col, String(opts.customerId));
      } else {
        const col = config?.customerIdColumn ?? 'customer_id';
        if (col) query = query.eq(col, String(opts.customerId));
      }
    }

    if (hasDateFilter) {
      const dateCol = config?.dateColumn ?? null;
      if (dateCol) {
        if (config?.dateMode === 'timestamp') {
          if (fromDateOnly) query = query.gte(dateCol, `${fromDateOnly}T00:00:00.000`);
          if (toDateOnly) query = query.lte(dateCol, `${toDateOnly}T23:59:59.999`);
        } else {
          if (fromDateOnly) query = query.gte(dateCol, fromDateOnly);
          if (toDateOnly) query = query.lte(dateCol, toDateOnly);
        }
      }
    }

    const totalCol = config?.totalColumn ?? 'total_value';
    if (totalCol) {
      if (minTotal !== null) query = query.gte(totalCol, minTotal);
      if (maxTotal !== null) query = query.lte(totalCol, maxTotal);
    }

    if (search) {
      if (searchIsNumber) {
        const numberCol = config?.numberColumn ?? 'number';
        const n = Number(searchDigits);
        if (Number.isFinite(n) && numberCol) query = query.eq(numberCol, n);
      } else if (withRelations) {
        query = query.ilike('name', `%${search}%`, { foreignTable: kindFilter === 'COMPRA' ? 'producers' : 'customers' });
      }
    }

    query = query.order('id', { ascending: false });
    if (queryLimit !== null) query = query.limit(queryLimit);

    const { data, error } = await applyAbortSignal(query, signal);
    throwQueryError(error);
    return (data || []) as any[];
  };

  const selects: Array<{ select: string; withRelations: boolean; applyPayload?: boolean }> = (() => {
    if (mode === 'list') {
      const base: Array<{ select: string; withRelations: boolean; applyPayload?: boolean }> = [
        {
          select:
            'id,created_at,number,status,company_id,customer_id,total_value,payload,company:companies(id,name),customer:customers(id,name)',
          withRelations: true,
          applyPayload: true,
        },
        {
          select:
            'id,created_at,guia,numero,status,company_id,id_da_empresa,customer_id,id_do_cliente,total_value,payload,company:companies(id,name),customer:customers(id,name)',
          withRelations: true,
          applyPayload: true,
        },
        { select: 'id,created_at,number,status,company_id,customer_id,total_value,payload', withRelations: false, applyPayload: true },
        {
          select: 'id,created_at,guia,numero,status,company_id,id_da_empresa,customer_id,id_do_cliente,total_value,payload',
          withRelations: false,
          applyPayload: true,
        },
        { select: 'id,created_at,status,payload', withRelations: false, applyPayload: true },
        { select: 'id,criado_em,status,payload', withRelations: false, applyPayload: true },
        { select: 'id,created_at,guia,numero,status,montante_total,payload', withRelations: false, applyPayload: true },
        { select: 'id,criado_em,guia,numero,status,montante_total,payload', withRelations: false, applyPayload: true },
        {
          select: 'id,created_at,number,status,company_id,customer_id,total_value,company:companies(id,name),customer:customers(id,name)',
          withRelations: true,
        },
        {
          select:
            'id,created_at,guia,numero,status,company_id,id_da_empresa,customer_id,id_do_cliente,total_value,company:companies(id,name),customer:customers(id,name)',
          withRelations: true,
        },
        { select: 'id,created_at,number,status,company_id,customer_id,total_value', withRelations: false },
        { select: 'id,created_at,guia,numero,status,company_id,id_da_empresa,customer_id,id_do_cliente,total_value', withRelations: false },
        {
          select: 'id,created_at,company_id,customer_id,total_value,payload,company:companies(id,name),customer:customers(id,name)',
          withRelations: true,
          applyPayload: true,
        },
        {
          select: 'id,created_at,id_da_empresa,id_do_cliente,total_value,payload,company:companies(id,name),customer:customers(id,name)',
          withRelations: true,
          applyPayload: true,
        },
        { select: 'id,created_at,company_id,customer_id,total_value,payload', withRelations: false, applyPayload: true },
        { select: 'id,created_at,id_da_empresa,id_do_cliente,total_value,payload', withRelations: false, applyPayload: true },
        { select: 'id,created_at,total_value,payload', withRelations: false, applyPayload: true },
        { select: 'id,created_at,payload', withRelations: false, applyPayload: true },
      ];

      if (kindFilter === 'COMPRA') {
        return [
          {
            select:
              'id,created_at,number,status,company_id,producer_id,total_value,payload,company:companies(id,name),producer:producers(id,name)',
            withRelations: true,
            applyPayload: true,
          },
          {
            select:
              'id,created_at,company_id,producer_id,total_value,payload,company:companies(id,name),producer:producers(id,name)',
            withRelations: true,
            applyPayload: true,
          },
          { select: 'id,created_at,number,status,company_id,producer_id,total_value,payload', withRelations: false, applyPayload: true },
          { select: 'id,created_at,company_id,producer_id,total_value,payload', withRelations: false, applyPayload: true },
          ...base,
        ];
      }

      return base;
    }

    if (kindFilter === 'COMPRA') {
      return [
        { select: '*, company:companies(*), producer:producers(*), customer:customers(*)', withRelations: true, applyPayload: true },
        { select: '*', withRelations: false, applyPayload: true },
      ];
    }

    return [
      { select: '*, company:companies(*), customer:customers(*)', withRelations: true, applyPayload: true },
      { select: '*', withRelations: false, applyPayload: true },
    ];
  })();

  const totalColumns: Array<string | null> = minTotal !== null || maxTotal !== null ? ['total_value', 'montante_total', null] : [null];
  const numberColumns: Array<string | null> = search && searchIsNumber ? ['number', 'guia', 'numero', null] : [null];
  const statusFilterVariants: Array<boolean> = opts.status && opts.status !== 'TODOS' ? [false, true] : [false];
  const companyIdColumns: Array<string | null> =
    opts.companyId
      ? isUuidLike(opts.companyId)
        ? ['company_id', null]
        : toOptionalNumber(opts.companyId) !== null
          ? ['id_da_empresa', 'company_id', null]
          : ['company_id', 'id_da_empresa', null]
      : [null];
  const customerIdColumns: Array<string | null> =
    opts.customerId
      ? isUuidLike(opts.customerId)
        ? ['customer_id', null]
        : toOptionalNumber(opts.customerId) !== null
          ? ['id_do_cliente', 'customer_id', null]
          : ['customer_id', 'id_do_cliente', null]
      : [null];
  const producerIdColumns: Array<string | null> = opts.customerId ? (isUuidLike(opts.customerId) ? ['producer_id', null] : ['producer_id', null]) : [null];
  const dateColumns: Array<string | null> = hasDateFilter
    ? dateField === 'CRIACAO'
      ? ['created_at', 'criado_em', null]
      : ['issue_date', 'data_de_emissao', 'created_at', 'criado_em', null]
    : [null];
  const dateModes: Array<'timestamp' | 'date_only'> = hasDateFilter ? ['timestamp', 'date_only'] : ['timestamp'];

  let rows: any[] = [];
  let lastError: any = null;
  let applyPayloadFromSelect = mode === 'full';
  let ignoreStatusUsed = false;

  for (const s of selects) {
    let mustFallbackToNoRelations = false;
    for (const ignoreStatus of statusFilterVariants) {
      for (const totalColumn of totalColumns) {
        for (const numberColumn of numberColumns) {
          for (const companyIdColumn of companyIdColumns) {
              for (const customerIdColumn of (kindFilter === 'COMPRA' ? producerIdColumns : customerIdColumns)) {
              for (const dateColumn of dateColumns) {
                for (const dateMode of dateModes) {
                  try {
                    rows = await tryFetch(s.select, s.withRelations, {
                      totalColumn,
                      numberColumn,
                      companyIdColumn,
                        customerIdColumn: kindFilter === 'COMPRA' ? null : customerIdColumn,
                        producerIdColumn: kindFilter === 'COMPRA' ? customerIdColumn : null,
                      dateColumn,
                      dateMode,
                      ignoreStatus,
                    });
                    lastError = null;
                    applyPayloadFromSelect = mode === 'full' ? true : !!s.applyPayload;
                    ignoreStatusUsed = ignoreStatus;
                    break;
                  } catch (err: any) {
                    lastError = err;
                    const msg = String(err?.message || '');
                    if (msg.includes('Could not find a relationship') || msg.includes('schema cache')) {
                      mustFallbackToNoRelations = true;
                      break;
                    }
                    const missing = getMissingColumnFromMessage(msg);
                    if (missing) continue;
                    if (msg.includes('invalid input syntax for type uuid') && (opts.companyId || opts.customerId)) continue;
                    if (
                      hasDateFilter &&
                      msg.includes('invalid input syntax') &&
                      (msg.includes('timestamp') || msg.includes('date'))
                    ) {
                      continue;
                    }
                    break;
                  }
                }
                if (!lastError || mustFallbackToNoRelations) break;
              }
            }
            if (!lastError || mustFallbackToNoRelations) break;
          }
        }
        if (!lastError) break;
        if (mustFallbackToNoRelations) break;
      }
      if (!lastError) break;
      if (mustFallbackToNoRelations) break;
    }
    if (!lastError) break;
    if (mustFallbackToNoRelations) continue;
  }

  if (lastError && rows.length === 0) throw lastError;

  const applyPayload = applyPayloadFromSelect;
  const applyBackup = mode === 'full';
  const mapped = rows.map((r) => mapRomaneioRow(r, { applyPayload, applyBackup }));
  let filtered = mapped;
  if (opts.status && opts.status !== 'TODOS' && ignoreStatusUsed) {
    const desired = normalizeStatusInput(opts.status as RomaneioStatus);
    filtered = filtered.filter((r) => normalizeStatusInput((r as any)?.status as any) === desired);
  }
  if (kindFilter) {
    filtered = filtered.filter((r) => inferKind(r) === kindFilter);
  }
  return limit !== null ? filtered.slice(0, limit) : filtered;
};

export const getRomaneioById = async (id: string, signal?: AbortSignal): Promise<RomaneioData> => {
  const idStr = String(id ?? '').trim();
  if (!idStr) throw new Error('ID do romaneio inválido.');

  const idAsNumber = toOptionalNumber(idStr);

  const filters: Array<{ col: string; value: any }> = [];
  const push = (col: string, value: any) => {
    if (value === null || value === undefined || value === '') return;
    const key = `${col}:${typeof value === 'string' ? value : JSON.stringify(value)}`;
    if ((push as any)._keys?.has(key)) return;
    if (!(push as any)._keys) (push as any)._keys = new Set<string>();
    (push as any)._keys.add(key);
    filters.push({ col, value });
  };

  push('id', idStr);
  if (idAsNumber !== null) push('id', idAsNumber);
  if (idAsNumber !== null) {
    push('number', idAsNumber);
    push('guia', idAsNumber);
    push('numero', idAsNumber);
  }

  const selects: Array<{ select: string; withRelations: boolean }> = [
    { select: '*, company:companies(*), customer:customers(*), producer:producers(*)', withRelations: true },
    { select: '*', withRelations: false },
  ];

  let lastError: any = null;

  for (const sel of selects) {
    for (const f of filters) {
      try {
        const q: any = (supabase as any)
          .from('romaneios')
          .select(sel.select)
          .eq(f.col as any, f.value)
          .limit(1)
          .single();
        const { data, error } = await applyAbortSignal(q, signal);
        if (error) {
          lastError = error;
          const msg = String(error.message || error);
          if (msg.includes('Could not find a relationship') || msg.includes('schema cache')) break;
          const missing = getMissingColumnFromMessage(msg);
          if (missing) continue;
          continue;
        }
        return mapRomaneioRow(data, { applyPayload: true, applyBackup: true });
      } catch (e: any) {
        lastError = e;
      }
    }
  }

  throwQueryError(lastError);
};

export const addRomaneio = async (
  romaneio: Omit<RomaneioData, 'id' | 'created_at'>,
  signal?: AbortSignal
) => {
  const getLocalDate = () => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  const toLocalNoonIsoFromDateOnly = (dateOnly: string) => {
    const s = String(dateOnly ?? '').trim();
    const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return '';
    const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0, 0);
    if (!Number.isFinite(d.getTime())) return '';
    return d.toISOString();
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

  const localNoonIso = (() => {
    const d = new Date();
    d.setHours(12, 0, 0, 0);
    return d.toISOString();
  })();

  const romaneioForPayload: any = { ...(romaneio as any) };
  if (!romaneioForPayload.emissionDate) romaneioForPayload.emissionDate = getLocalDate();
  if (!romaneioForPayload.saleDate) romaneioForPayload.saleDate = romaneioForPayload.emissionDate || getLocalDate();
  const issueDateIso = toLocalNoonIsoFromDateOnly(romaneioForPayload.emissionDate) || localNoonIso;
  const dueDateOnly = toIsoDateOnly(romaneioForPayload.dueDate ?? (romaneio as any)?.dueDate ?? '');
  const paymentStatusRaw = String((romaneioForPayload as any)?.paymentStatus ?? (romaneio as any)?.payment_status ?? '').trim();
  const paymentStatusKey = paymentStatusRaw ? paymentStatusRaw.toUpperCase().replaceAll(' ', '_') : '';
  const paymentDateOnly = toIsoDateOnly((romaneioForPayload as any)?.paymentDate ?? (romaneio as any)?.payment_date ?? '');

  const { data: userRes, error: userError } = await supabase.auth.getUser();
  throwQueryError(userError);
  const userId = userRes?.user?.id;
  if (!userId) throw new Error('Usuário não autenticado.');
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

  const inferKind = (r?: Partial<RomaneioData> | null): RomaneioKind => {
    const k = String((r as any)?.kind ?? '').trim().toUpperCase();
    if (k === 'COMPRA') return 'COMPRA';
    if (k === 'VENDA') return 'VENDA';
    const producerId = (r as any)?.producer_id ?? (r as any)?.producerId ?? (r as any)?.producer?.id ?? null;
    if (producerId) return 'COMPRA';
    const nature = String((r as any)?.natureOfOperation ?? '').trim().toUpperCase();
    if (nature.includes('COMPRA')) return 'COMPRA';
    return 'VENDA';
  };

  const productsArr: any[] = Array.isArray((romaneio as any)?.products) ? ((romaneio as any).products as any[]) : [];
  const expensesArr: any[] = Array.isArray((romaneio as any)?.expenses) ? ((romaneio as any).expenses as any[]) : [];
  const productsTotal = productsArr.reduce((acc, p) => acc + (Number(p?.quantity || 0) * Number(p?.unitValue || 0)), 0);
  const expensesTotal = expensesArr.reduce((acc, e) => acc + (Number(e?.total || 0) || 0), 0);
  const kind = inferKind(romaneio as any);
  const totalFromItems = kind === 'COMPRA' ? productsTotal - expensesTotal : productsTotal + expensesTotal;
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
  const basePartyId =
    kind === 'COMPRA'
      ? ((romaneio as any)?.producer_id ??
        (romaneio as any)?.producerId ??
        (romaneio as any)?.producer?.id ??
        (romaneio as any)?.customer_id ??
        (romaneio as any)?.customerId ??
        (romaneio as any)?.customer?.id ??
        null)
      : ((romaneio as any)?.customer_id ?? (romaneio as any)?.customerId ?? (romaneio as any)?.customer?.id ?? null);
  const baseCustomerId = kind === 'COMPRA' ? null : basePartyId;
  const baseProducerId = kind === 'COMPRA' ? basePartyId : null;
  const baseDate = romaneioForPayload?.emissionDate ?? romaneioForPayload?.saleDate ?? null;
  const baseObs = (romaneio as any)?.observation ?? null;

  const candidatePtNoAccent: any = {
    created_at: localNoonIso,
    criado_em: localNoonIso,
    issue_date: issueDateIso,
    guia: baseNumber,
    numero: baseNumber,
    data_de_emissao: baseDate,
    due_date: dueDateOnly,
    data_vencimento: dueDateOnly,
    data_de_vencimento: dueDateOnly,
    vencimento: dueDateOnly,
    status: statusPt,
    id_da_empresa: toOptionalNumber(baseCompanyId),
    id_do_cliente: toOptionalNumber(baseCustomerId),
    observacoes: baseObs,
    montante_total: Number.isFinite(totalFromItems) ? totalFromItems : null,
    peso_total: Number.isFinite(weightFromItems) ? weightFromItems : null,
    status_pagamento: paymentStatusKey || null,
    data_pagamento: paymentDateOnly || null,
  };

  const candidatePtAccent: any = {
    created_at: localNoonIso,
    criado_em: localNoonIso,
    issue_date: issueDateIso,
    guia: baseNumber,
    numero: baseNumber,
    data_de_emissao: baseDate,
    due_date: dueDateOnly,
    data_vencimento: dueDateOnly,
    data_de_vencimento: dueDateOnly,
    vencimento: dueDateOnly,
    status: statusPt,
    id_da_empresa: toOptionalNumber(baseCompanyId),
    id_do_cliente: toOptionalNumber(baseCustomerId),
    'observações': baseObs,
    montante_total: Number.isFinite(totalFromItems) ? totalFromItems : null,
    peso_total: Number.isFinite(weightFromItems) ? weightFromItems : null,
    status_pagamento: paymentStatusKey || null,
    data_pagamento: paymentDateOnly || null,
  };

  const candidateEn: any = {
    created_at: localNoonIso,
    criado_em: localNoonIso,
    issue_date: issueDateIso,
    due_date: dueDateOnly,
    number: baseNumber,
    status: statusNorm || 'PENDENTE',
    company_id: baseCompanyId,
    customer_id: baseCustomerId,
    producer_id: baseProducerId,
    total_value: Number.isFinite(totalFromItems) ? totalFromItems : null,
    total_weight: Number.isFinite(weightFromItems) ? weightFromItems : null,
    payment_status: paymentStatusKey || null,
    payment_date: paymentDateOnly || null,
  };

  const candidates = [candidatePtNoAccent, candidatePtAccent, candidateEn];
  let lastError: any = null;

  const compactPayload = (input: any) => {
    const out: any = { ...input };
    for (const k of Object.keys(out)) {
      if (out[k] === undefined || out[k] === null || out[k] === '') delete out[k];
    }
    return out;
  };

  for (const candidate of candidates) {
    const payload: any = compactPayload(candidate);
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
        if (merged.number === undefined || merged.number === null || merged.number === '') {
          const inputNumber = String((romaneio as any)?.number ?? '').trim();
          merged.number = inputNumber || String(merged.id || '');
        }

        const backupId = String(merged.id || '');
        if (backupId) {
          const fullBackup: any = {
            ...(romaneio as any),
            id: backupId,
            created_at: merged.created_at ?? merged.criado_em ?? (romaneio as any)?.created_at,
            status: merged.status ?? (romaneio as any)?.status,
            number: merged.number,
          };
          writeJson(getRomaneioBackupKey(backupId), fullBackup);
        }

        if (backupId) {
          const updatePayload: any = { payload: { ...(romaneioForPayload as any), id: backupId } };
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

      if (msg.toLowerCase().includes('duplicate key') && msg.toLowerCase().includes('id')) {
        payload.id = await getNextNumericId();
        continue;
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
        if ('id_da_empresa' in payload) payload.id_da_empresa = toOptionalNumber(payload.id_da_empresa);
        if ('id_do_cliente' in payload) payload.id_do_cliente = toOptionalNumber(payload.id_do_cliente);
        if ('guia' in payload) payload.guia = toOptionalNumber(payload.guia);
        if ('numero' in payload) payload.numero = toOptionalNumber(payload.numero);
        if ('montante_total' in payload) payload.montante_total = toOptionalNumber(payload.montante_total);
        if ('peso_total' in payload) payload.peso_total = toOptionalNumber(payload.peso_total);
        continue;
      }

      if (msg.toLowerCase().includes('invalid input syntax') && msg.toLowerCase().includes('date')) {
        if ('issue_date' in payload && typeof baseDate === 'string' && baseDate) {
          payload.issue_date = baseDate;
          continue;
        }
      }

      break;
    }
  }

  throwQueryError(lastError);
};

export const updateRomaneio = async (
  id: string,
  romaneio: Partial<Omit<RomaneioData, 'id' | 'created_at'>>,
  signal?: AbortSignal
): Promise<RomaneioData> => {
  const toLocalNoonIsoFromDateOnly = (dateOnly: string) => {
    const s = String(dateOnly ?? '').trim();
    const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return '';
    const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0, 0);
    if (!Number.isFinite(d.getTime())) return '';
    return d.toISOString();
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

  const backupKey = getRomaneioBackupKey(String(id));
  writeJson(backupKey, { ...(romaneio as any), id: String(id) });

  const { data: userRes, error: userError } = await supabase.auth.getUser();
  throwQueryError(userError);
  const userId = userRes?.user?.id;
  if (!userId) throw new Error('Usuário não autenticado.');

  const inferKind = (r?: Partial<RomaneioData> | null): RomaneioKind => {
    const k = String((r as any)?.kind ?? '').trim().toUpperCase();
    if (k === 'COMPRA') return 'COMPRA';
    if (k === 'VENDA') return 'VENDA';
    const producerId = (r as any)?.producer_id ?? (r as any)?.producerId ?? (r as any)?.producer?.id ?? null;
    if (producerId) return 'COMPRA';
    const nature = String((r as any)?.natureOfOperation ?? '').trim().toUpperCase();
    if (nature.includes('COMPRA')) return 'COMPRA';
    return 'VENDA';
  };

  const productsArr: any[] = Array.isArray((romaneio as any)?.products) ? ((romaneio as any).products as any[]) : [];
  const expensesArr: any[] = Array.isArray((romaneio as any)?.expenses) ? ((romaneio as any).expenses as any[]) : [];
  const productsTotal = productsArr.reduce((acc, p) => acc + (Number(p?.quantity || 0) * Number(p?.unitValue || 0)), 0);
  const expensesTotal = expensesArr.reduce((acc, e) => acc + (Number(e?.total || 0) || 0), 0);
  const kind = inferKind(romaneio as any);
  const totalFromItems = kind === 'COMPRA' ? productsTotal - expensesTotal : productsTotal + expensesTotal;
  const weightFromItems = productsArr.reduce((acc, p) => acc + (Number(p?.quantity || 0) * Number(p?.kg || 0)), 0);

  const toOptionalNumber = (v: unknown) => {
    if (v === null || v === undefined) return null;
    if (typeof v === 'number' && Number.isFinite(v)) return v;
    const s = String(v).trim();
    if (!s) return null;
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
  };

  const isUuid = (v: string) =>
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);

  const toOptionalUuidString = (v: unknown) => {
    if (v === null || v === undefined) return null;
    const s = String(v).trim();
    if (!s) return null;
    return isUuid(s) ? s : null;
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
  const basePartyId =
    kind === 'COMPRA'
      ? ((romaneio as any)?.producer_id ??
        (romaneio as any)?.producerId ??
        (romaneio as any)?.producer?.id ??
        (romaneio as any)?.customer_id ??
        (romaneio as any)?.customerId ??
        (romaneio as any)?.customer?.id ??
        null)
      : ((romaneio as any)?.customer_id ?? (romaneio as any)?.customerId ?? (romaneio as any)?.customer?.id ?? null);
  const baseCustomerId = kind === 'COMPRA' ? null : basePartyId;
  const baseProducerId = kind === 'COMPRA' ? basePartyId : null;
  const baseDate = (romaneio as any)?.emissionDate ?? (romaneio as any)?.saleDate ?? null;
  const issueDateIso = typeof baseDate === 'string' ? toLocalNoonIsoFromDateOnly(baseDate) : '';
  const dueDateOnly = toIsoDateOnly((romaneio as any)?.dueDate ?? (romaneio as any)?.due_date ?? '');
  const paymentStatusRaw = String((romaneio as any)?.paymentStatus ?? (romaneio as any)?.payment_status ?? '').trim();
  const paymentStatusKey = paymentStatusRaw ? paymentStatusRaw.toUpperCase().replaceAll(' ', '_') : '';
  const paymentDateOnly = toIsoDateOnly((romaneio as any)?.paymentDate ?? (romaneio as any)?.payment_date ?? '');
  const baseObs = (romaneio as any)?.observation ?? null;
  const baseBanking = (romaneio as any)?.banking ?? (romaneio as any)?.company?.banking ?? null;

  const fullPayload = { ...(romaneio as any), id: String(id) };

  const candidateDbNumeric: any = {
    owner_id: userId,
    status: statusPt,
    company_id: toOptionalNumber(baseCompanyId),
    customer_id: toOptionalNumber(baseCustomerId),
    producer_id: toOptionalNumber(baseProducerId),
    issue_date: issueDateIso || baseDate,
    due_date: dueDateOnly,
    total_amount: Number.isFinite(totalFromItems) ? totalFromItems : null,
    observations: baseObs,
    banking: baseBanking,
    payment_status: paymentStatusKey || null,
    payment_date: paymentDateOnly || null,
  };

  const candidatePtNoAccent: any = {
    owner_id: userId,
    guia: baseNumber,
    numero: baseNumber,
    data_de_emissao: baseDate,
    due_date: dueDateOnly,
    data_vencimento: dueDateOnly,
    data_de_vencimento: dueDateOnly,
    vencimento: dueDateOnly,
    status: statusPt,
    id_da_empresa: toOptionalNumber(baseCompanyId),
    id_do_cliente: toOptionalNumber(baseCustomerId),
    observacoes: baseObs,
    montante_total: Number.isFinite(totalFromItems) ? totalFromItems : null,
    peso_total: Number.isFinite(weightFromItems) ? weightFromItems : null,
    banking: baseBanking,
    status_pagamento: paymentStatusKey || null,
    data_pagamento: paymentDateOnly || null,
  };

  const candidatePtAccent: any = {
    owner_id: userId,
    guia: baseNumber,
    numero: baseNumber,
    data_de_emissao: baseDate,
    due_date: dueDateOnly,
    data_vencimento: dueDateOnly,
    data_de_vencimento: dueDateOnly,
    vencimento: dueDateOnly,
    status: statusPt,
    id_da_empresa: toOptionalNumber(baseCompanyId),
    id_do_cliente: toOptionalNumber(baseCustomerId),
    'observações': baseObs,
    montante_total: Number.isFinite(totalFromItems) ? totalFromItems : null,
    peso_total: Number.isFinite(weightFromItems) ? weightFromItems : null,
    banking: baseBanking,
    status_pagamento: paymentStatusKey || null,
    data_pagamento: paymentDateOnly || null,
  };

  const candidateEn: any = {
    owner_id: userId,
    number: baseNumber,
    status: statusNorm || 'PENDENTE',
    company_id: toOptionalUuidString(baseCompanyId),
    customer_id: toOptionalUuidString(baseCustomerId),
    producer_id: toOptionalUuidString(baseProducerId),
    issue_date: issueDateIso || baseDate,
    due_date: dueDateOnly,
    total_value: Number.isFinite(totalFromItems) ? totalFromItems : null,
    total_weight: Number.isFinite(weightFromItems) ? weightFromItems : null,
    banking: baseBanking,
  };

  const compactPayload = (input: any) => {
    const out: any = { ...input };
    for (const k of Object.keys(out)) {
      if (out[k] === undefined || out[k] === null || out[k] === '') delete out[k];
    }
    return out;
  };

  const normalizeRow = (row: any): RomaneioData => {
    const merged: any = { ...row };
    const payloadObj = merged?.payload && typeof merged.payload === 'object' ? merged.payload : null;
    if (payloadObj) {
      const fromPayload: any = { ...payloadObj };
      delete fromPayload.id;
      delete fromPayload.created_at;
      delete fromPayload.company_id;
      delete fromPayload.customer_id;
      delete fromPayload.producer_id;
      delete fromPayload.companyId;
      delete fromPayload.customerId;
      delete fromPayload.producerId;
      delete fromPayload.number;
      delete fromPayload.status;
      Object.assign(merged, fromPayload);
    }

    if (merged.issue_date && !merged.emissionDate) merged.emissionDate = merged.issue_date;
    if (merged.total_amount != null && merged.total_value == null) merged.total_value = merged.total_amount;
    if (merged.observations && !merged.observation) merged.observation = merged.observations;
    if (merged.due_date && !merged.dueDate) merged.dueDate = merged.due_date;
    if (merged.data_vencimento && !merged.dueDate) merged.dueDate = merged.data_vencimento;
    if (merged.data_de_vencimento && !merged.dueDate) merged.dueDate = merged.data_de_vencimento;
    if (merged.vencimento && !merged.dueDate) merged.dueDate = merged.vencimento;
    if (merged.payment_status && !merged.paymentStatus) merged.paymentStatus = merged.payment_status;
    if (merged.status_pagamento && !merged.paymentStatus) merged.paymentStatus = merged.status_pagamento;
    if (merged.payment_date && !merged.paymentDate) merged.paymentDate = merged.payment_date;
    if (merged.data_pagamento && !merged.paymentDate) merged.paymentDate = merged.data_pagamento;

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
      else if (s.includes('SAIU') && s.includes('ENTREGA')) merged.status = 'PENDENTE';
      else if (s.startsWith('ENTREG')) merged.status = 'CONCLUÍDO';
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

    if ((merged.number === undefined || merged.number === null || merged.number === '') && merged.id != null) {
      merged.number = String(merged.id);
    }
    return merged as RomaneioData;
  };

  const candidates = [candidateDbNumeric, candidateEn, candidatePtNoAccent, candidatePtAccent];
  let lastError: any = null;

  const pushUniqueFilter = (
    list: Array<{ col: string; value: any }>,
    col: string,
    value: any
  ) => {
    if (value === undefined) return;
    const key = `${col}:${typeof value === 'string' ? value : JSON.stringify(value)}`;
    if ((list as any)._keys?.has(key)) return;
    if (!(list as any)._keys) (list as any)._keys = new Set<string>();
    (list as any)._keys.add(key);
    list.push({ col, value });
  };

  const filters: Array<{ col: string; value: any }> = [];
  const idStr = String(id);
  const idLooksUuid = isUuid(idStr);
  if (idLooksUuid) pushUniqueFilter(filters, 'id', idStr);

  const idAsNumber = toOptionalNumber(id);
  if (idAsNumber !== null) pushUniqueFilter(filters, 'id', idAsNumber);
  if (!isUuid(String(id)) || idAsNumber !== null) {
    pushUniqueFilter(filters, 'guia', idAsNumber ?? String(id));
    pushUniqueFilter(filters, 'numero', idAsNumber ?? String(id));
    pushUniqueFilter(filters, 'number', idAsNumber ?? String(id));
  }

  if (baseNumber !== null) {
    pushUniqueFilter(filters, 'guia', baseNumber);
    pushUniqueFilter(filters, 'numero', baseNumber);
    pushUniqueFilter(filters, 'number', baseNumber);
  }

  const tryUpdate = async (payload: any) => {
    let lastRes: any = null;
    for (const f of filters) {
      const query = (supabase as any)
        .from('romaneios')
        .update(payload, { count: 'exact' })
        .eq(f.col as any, f.value)
        .select('*');
      const res: any = await applyAbortSignal(query, signal);
      lastRes = res;

      if (!res?.error && res?.count) return res;
      if (!res?.error && !res?.count) continue;

      const code = String((res?.error as any)?.code || '');
      const msg = String(res?.error?.message || res?.error || '');
      if (
        f.col === 'id' &&
        !idLooksUuid &&
        msg.toLowerCase().includes('invalid input syntax') &&
        msg.toLowerCase().includes('uuid')
      ) {
        continue;
      }
      if (msg.includes("Could not find the '") && msg.includes("' column")) {
        const m = msg.match(/Could not find the '([^']+)' column/i);
        if (m?.[1] && m[1] === f.col) continue;
      }
      if (
        code === '42703' ||
        (msg.toLowerCase().includes('does not exist') &&
          (msg.includes(`romaneios.${f.col}`) ||
            msg.includes(`romaneios."${f.col}"`) ||
            msg.includes(`"${f.col}"`) ||
            msg.includes(`'${f.col}'`)))
      ) {
        continue;
      }
      break;
    }
    return lastRes;
  };

  for (const candidate of candidates) {
    const payload: any = compactPayload(candidate);
    let shouldClearBackup = false;

    for (let attempt = 0; attempt < 50; attempt++) {
      if (Object.keys(payload).length === 0) break;
      const res: any = await tryUpdate(payload);
      if (!res?.error) {
        if (!res?.count) {
          lastError = new Error('Romaneio não foi atualizado no banco (0 linhas afetadas).');
          break;
        }
        const row = Array.isArray(res?.data) ? res.data[0] : res?.data;
        const hasPayloadColumn = !!row && Object.prototype.hasOwnProperty.call(row, 'payload');
        if (hasPayloadColumn) {
          const payloadRes: any = await tryUpdate({ payload: fullPayload });
          if (!payloadRes?.error && payloadRes?.count) {
            shouldClearBackup = true;
            const payloadRow = Array.isArray(payloadRes?.data) ? payloadRes.data[0] : payloadRes?.data;
            if (shouldClearBackup) deleteJson(backupKey);
            return normalizeRow(payloadRow);
          }
        }

        if (shouldClearBackup) deleteJson(backupKey);
        return normalizeRow(row);
      }

      lastError = res.error;
      const msg = String(res.error.message || res.error);

      const match =
        msg.match(/Could not find the '([^']+)' column/) ||
        msg.match(/column "([^"]+)" of relation "[^"]+" does not exist/i) ||
        msg.match(/column "([^"]+)" does not exist/i);
      if (match?.[1]) {
        const missingColumn = match[1];
        if (missingColumn in payload) {
          if (attempt < 6 && msg.includes('schema cache')) {
            await new Promise<void>((r) => setTimeout(() => r(), 800));
            continue;
          }
          delete payload[missingColumn];
          continue;
        }
      }

      if (msg.includes('schema cache')) {
        await new Promise<void>((r) => setTimeout(() => r(), 800));
        continue;
      }

      if (
        msg.toLowerCase().includes('invalid input syntax') &&
        (msg.includes('bigint') || msg.includes('integer') || msg.includes('numeric'))
      ) {
        if ('id_da_empresa' in payload) payload.id_da_empresa = toOptionalNumber(payload.id_da_empresa);
        if ('id_do_cliente' in payload) payload.id_do_cliente = toOptionalNumber(payload.id_do_cliente);
        if ('guia' in payload) payload.guia = toOptionalNumber(payload.guia);
        if ('numero' in payload) payload.numero = toOptionalNumber(payload.numero);
        if ('montante_total' in payload) payload.montante_total = toOptionalNumber(payload.montante_total);
        if ('peso_total' in payload) payload.peso_total = toOptionalNumber(payload.peso_total);
        if ('total_value' in payload) payload.total_value = toOptionalNumber(payload.total_value);
        if ('total_weight' in payload) payload.total_weight = toOptionalNumber(payload.total_weight);
        continue;
      }

      if (msg.toLowerCase().includes('invalid input syntax') && msg.toLowerCase().includes('date')) {
        if ('issue_date' in payload && typeof baseDate === 'string' && baseDate) {
          payload.issue_date = baseDate;
          continue;
        }
      }

      if (msg.toLowerCase().includes('invalid input syntax') && msg.toLowerCase().includes('uuid')) {
        let changed = false;
        for (const k of ['company_id', 'customer_id', 'producer_id', 'owner_id']) {
          if (k in payload) {
            const v = String(payload[k] ?? '').trim();
            if (!v || !isUuid(v)) {
              delete payload[k];
              changed = true;
            }
          }
        }
        if (changed) continue;
      }

      break;
    }
  }

  throwQueryError(lastError);
};

export const deleteRomaneio = async (id: string, signal?: AbortSignal): Promise<void> => {
  const isUuid = (v: string) =>
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
  const idStr = String(id);
  const idLooksUuid = isUuid(idStr);
  const idAsNumber = (() => {
    const s = idStr.trim();
    if (!s) return null;
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
  })();

  const filters: Array<{ col: string; value: any }> = [];
  if (idLooksUuid) filters.push({ col: 'id', value: idStr });
  if (idAsNumber !== null) filters.push({ col: 'id', value: idAsNumber });
  filters.push({ col: 'guia', value: idAsNumber ?? idStr });
  filters.push({ col: 'numero', value: idAsNumber ?? idStr });
  filters.push({ col: 'number', value: idAsNumber ?? idStr });

  let lastError: any = null;
  for (const f of filters) {
    const query = (supabase as any).from('romaneios').delete({ count: 'exact' }).eq(f.col, f.value);
    const { error, count } = await applyAbortSignal(query, signal);
    if (error) {
      lastError = error;
      const msg = String(error?.message || error);
      if (f.col === 'id' && !idLooksUuid && msg.toLowerCase().includes('invalid input syntax') && msg.toLowerCase().includes('uuid')) {
        continue;
      }
      if (
        String((error as any)?.code || '') === '42703' ||
        (msg.toLowerCase().includes('does not exist') &&
          (msg.includes(`romaneios.${f.col}`) ||
            msg.includes(`romaneios."${f.col}"`) ||
            msg.includes(`"${f.col}"`) ||
            msg.includes(`'${f.col}'`)))
      ) {
        continue;
      }
      continue;
    }
    if (count) {
      deleteJson(getRomaneioBackupKey(idStr));
      return;
    }
  }

  throwQueryError(lastError || new Error('Romaneio não foi excluído no banco (0 linhas afetadas).'));
};

export const updateRomaneioStatus = async (id: string, status: RomaneioStatus, signal?: AbortSignal): Promise<void> => {
  const isUuid = (v: string) =>
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
  const idStr = String(id);
  const idLooksUuid = isUuid(idStr);
  const idAsNumber = (() => {
    const s = idStr.trim();
    if (!s) return null;
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
  })();

  const filters: Array<{ col: string; value: any }> = [];
  if (idLooksUuid) filters.push({ col: 'id', value: idStr });
  if (idAsNumber !== null) filters.push({ col: 'id', value: idAsNumber });
  filters.push({ col: 'guia', value: idAsNumber ?? idStr });
  filters.push({ col: 'numero', value: idAsNumber ?? idStr });
  filters.push({ col: 'number', value: idAsNumber ?? idStr });

  const { data: userRes, error: userErr } = await supabase.auth.getUser();
  throwQueryError(userErr);
  const userId = userRes?.user?.id || '';

  let lastError: any = null;
  for (const f of filters) {
    const tryUpdate = async (payload: any) => {
      const query = (supabase as any).from('romaneios').update(payload, { count: 'exact' }).eq(f.col, f.value);
      return await applyAbortSignal(query, signal);
    };

    const res1: any = await tryUpdate({ status });
    if (res1?.error) {
      lastError = res1.error;
      const msg = String(res1.error?.message || res1.error);
      if (f.col === 'id' && !idLooksUuid && msg.toLowerCase().includes('invalid input syntax') && msg.toLowerCase().includes('uuid')) {
        continue;
      }
      if (
        String((res1.error as any)?.code || '') === '42703' ||
        (msg.toLowerCase().includes('does not exist') &&
          (msg.includes(`romaneios.${f.col}`) ||
            msg.includes(`romaneios."${f.col}"`) ||
            msg.includes(`"${f.col}"`) ||
            msg.includes(`'${f.col}'`)))
      ) {
        continue;
      }
      continue;
    }
    if (res1?.count) return;

    if (userId) {
      const res2: any = await tryUpdate({ status, owner_id: userId });
      if (res2?.error) {
        lastError = res2.error;
        const msg = String(res2.error?.message || res2.error);
        const code = String((res2.error as any)?.code || '');
        if (code === '42703' || msg.toLowerCase().includes('does not exist')) {
          continue;
        }
        continue;
      }
      if (res2?.count) return;
    }
  }

  throwQueryError(lastError || new Error('Romaneio não foi atualizado no banco (0 linhas afetadas).'));
};

export type RomaneioEmailNotificationType =
  | 'ROMANEIO_CRIADO'
  | 'LEMBRETE_PAGAMENTO';

export const sendRomaneioEmailNotification = async (
  params: { romaneioId: string; type: RomaneioEmailNotificationType },
  signal?: AbortSignal
): Promise<{ skipped?: boolean; reason?: string } | null> => {
  try {
    try {
      const raw = (globalThis as any)?.localStorage?.getItem('cc_auto_send_enabled');
      if (raw === '0' || raw === 'false') return { skipped: true, reason: 'auto_send_disabled' };
    } catch {
    }

    const { data: sessionRes } = await supabase.auth.getSession();
    const accessToken = sessionRes?.session?.access_token || '';
    const userId = sessionRes?.session?.user?.id || '';
    if (!accessToken) throw new Error('Sessão expirada. Faça login novamente para enviar e-mail.');
    if (userId) {
      try {
        const { data } = await applyAbortSignal(
          supabase.from('email_settings').select('*').eq('owner_id', userId).limit(1).maybeSingle(),
          signal
        );
        const enabled = (data as any)?.auto_send_enabled;
        if (enabled === false) return { skipped: true, reason: 'auto_send_disabled' };
      } catch {
      }
    }

    const invokeOnce = async () => {
      return (supabase as any).functions.invoke('send-romaneio-email', { body: params, signal });
    };

    let res: any = await invokeOnce();
    if (res?.error) {
      const errObj: any = res.error || null;
      const status =
        Number(errObj?.context?.status) || Number(errObj?.status) || Number(errObj?.statusCode) || null;
      if (status === 401) {
        try {
          await supabase.auth.refreshSession();
        } catch {
        }
        res = await invokeOnce();
      }
    }
    if (res?.error) {
      const errObj: any = res.error || null;
      const status =
        Number(errObj?.context?.status) ||
        Number(errObj?.status) ||
        Number(errObj?.statusCode) ||
        null;
      const bodyText =
        typeof errObj?.context?.body === 'string'
          ? errObj.context.body
          : typeof errObj?.context?.response === 'string'
            ? errObj.context.response
            : '';
      let bodyMsg = '';
      try {
        const parsed = bodyText ? JSON.parse(bodyText) : null;
        bodyMsg = String((parsed as any)?.error || (parsed as any)?.message || '').trim();
      } catch {
      }
      const base = String(errObj?.message || errObj || 'Falha ao enviar e-mail');
      const detail = bodyMsg || bodyText;
      const statusPart = status ? `HTTP ${status}` : '';
      throw new Error([base, statusPart, detail].filter(Boolean).join(' - '));
    }
    return (res?.data ?? null) as any;
  } catch (e: any) {
    const msg = String(e?.message || e || '');
    if (msg.includes('AbortError') || msg.includes('aborted')) return null;
    throw e;
  }
};
