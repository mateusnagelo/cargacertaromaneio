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
  throw new Error(msg);
};

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

    if (!merged.client && merged.customer) merged.client = merged.customer;
    if (!merged.customer && merged.client) merged.customer = merged.client;

    if (Array.isArray(merged.items) && !Array.isArray(merged.products)) {
      merged.products = merged.items;
    }
    if (Array.isArray(merged.romaneio_expenses) && !Array.isArray(merged.expenses)) {
      merged.expenses = merged.romaneio_expenses;
    }

    return merged as RomaneioData;
  });
};

export const addRomaneio = async (
  romaneio: Omit<RomaneioData, 'id' | 'created_at'>,
  signal?: AbortSignal
) => {
  const payload: any = { ...romaneio };

  if (typeof payload.number === 'string') {
    const asNumber = Number(payload.number);
    if (!Number.isFinite(asNumber)) payload.number = null;
  }

  const query = supabase
    .from('romaneios')
    .insert([payload])
    .select('*')
    .single();
  const { data, error } = await applyAbortSignal(query, signal);

  throwQueryError(error);
  if (!data) throw new Error('Failed to create romaneio');

  return data as any;
};

export const deleteRomaneio = async (id: string, signal?: AbortSignal): Promise<void> => {
  const query = supabase.from('romaneios').delete().eq('id', id);
  const { error } = await applyAbortSignal(query, signal);
  throwQueryError(error);
};

export const updateRomaneioStatus = async (id: string, status: RomaneioStatus, signal?: AbortSignal): Promise<void> => {
  const query = supabase.from('romaneios').update({ status }).eq('id', id);
  const { error } = await applyAbortSignal(query, signal);
  throwQueryError(error);
};
