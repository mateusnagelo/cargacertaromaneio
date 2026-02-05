import { supabase } from '../supabaseClient';
import { ProducerPayment } from '../types';

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
  throw new Error(msg);
};

const toOptionalNumber = (v: any) => {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
};

const toDbBigIntId = (v: unknown) => {
  const s = String(v ?? '').trim();
  if (!s) return s;
  if (/^\d+$/.test(s)) {
    const n = Number(s);
    if (Number.isSafeInteger(n)) return n;
  }
  return s;
};

const normalizeRow = (row: any): ProducerPayment => {
  return {
    id: String(row?.id ?? ''),
    created_at: row?.created_at,
    romaneioId: String(row?.romaneio_id ?? row?.romaneioId ?? ''),
    producerId: String(row?.producer_id ?? row?.producerId ?? ''),
    amount: toOptionalNumber(row?.amount) ?? 0,
    paidAt: String(row?.paid_at ?? row?.paidAt ?? ''),
    method: row?.method != null ? String(row.method) : undefined,
    reference: row?.reference != null ? String(row.reference) : undefined,
    note: row?.note != null ? String(row.note) : undefined,
  };
};

export type GetProducerPaymentsOptions = {
  romaneioId?: string;
  producerId?: string;
  fromDate?: string;
  toDate?: string;
  limit?: number | null;
};

export const getProducerPayments = async (signal?: AbortSignal, options?: GetProducerPaymentsOptions): Promise<ProducerPayment[]> => {
  const opts = options ?? {};
  let q: any = supabase.from('producer_payments').select('*').order('paid_at', { ascending: false }).order('created_at', { ascending: false });
  if (opts.romaneioId) q = q.eq('romaneio_id', toDbBigIntId(opts.romaneioId));
  if (opts.producerId) q = q.eq('producer_id', opts.producerId);
  if (opts.fromDate) q = q.gte('paid_at', opts.fromDate);
  if (opts.toDate) q = q.lte('paid_at', opts.toDate);
  if (opts.limit != null) q = q.limit(Math.max(1, Math.min(500, Math.floor(opts.limit))));
  const { data, error } = await applyAbortSignal(q, signal);
  throwQueryError(error);
  return (data || []).map(normalizeRow);
};

export const addProducerPayment = async (payment: Omit<ProducerPayment, 'id' | 'created_at'>, signal?: AbortSignal) => {
  const { data: userRes, error: userError } = await supabase.auth.getUser();
  throwQueryError(userError);
  const userId = userRes?.user?.id;
  if (!userId) throw new Error('Usuário não autenticado.');

  const payload: any = {
    owner_id: userId,
    romaneio_id: toDbBigIntId(payment.romaneioId),
    producer_id: payment.producerId,
    amount: toOptionalNumber(payment.amount) ?? 0,
    paid_at: payment.paidAt,
    method: payment.method ?? null,
    reference: payment.reference ?? null,
    note: payment.note ?? null,
  };

  const q: any = supabase.from('producer_payments').insert([payload]).select('*');
  const { data, error } = await applyAbortSignal(q, signal);
  throwQueryError(error);
  return (data || []).map(normalizeRow);
};

export const updateProducerPayment = async (
  id: string,
  payment: Omit<ProducerPayment, 'id' | 'created_at'>,
  signal?: AbortSignal
): Promise<ProducerPayment> => {
  const paymentId = String(id || '').trim();
  if (!paymentId) throw new Error('ID do pagamento inválido.');

  const payload: any = {
    romaneio_id: toDbBigIntId(payment.romaneioId),
    producer_id: payment.producerId,
    amount: toOptionalNumber(payment.amount) ?? 0,
    paid_at: payment.paidAt,
    method: payment.method ?? null,
    reference: payment.reference ?? null,
    note: payment.note ?? null,
  };

  const q: any = supabase.from('producer_payments').update(payload).eq('id', paymentId).select('*').limit(1);
  const { data, error } = await applyAbortSignal(q, signal);
  throwQueryError(error);

  const row = Array.isArray(data) ? data[0] : data;
  if (!row) throw new Error('Pagamento não foi atualizado no banco. Verifique RLS/policies no Supabase.');
  return normalizeRow(row);
};

export const deleteProducerPayment = async (id: string, signal?: AbortSignal) => {
  const q: any = supabase.from('producer_payments').delete({ count: 'exact' }).eq('id', id);
  const { error, count } = await applyAbortSignal(q, signal);
  throwQueryError(error);
  if (!count) throw new Error('Pagamento não foi excluído no banco (0 linhas afetadas). Verifique RLS/policies no Supabase.');
};
