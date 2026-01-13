import { supabase } from '../supabaseClient';
import { Observation } from '../types';

const applyAbortSignal = (query: any, signal?: AbortSignal) => {
  if (signal && typeof query?.abortSignal === 'function') return query.abortSignal(signal);
  return query;
};

const uuidV4 = () => {
  const c: any = (globalThis as any).crypto;
  if (c?.randomUUID) return c.randomUUID();
  if (c?.getRandomValues) {
    const bytes = new Uint8Array(16);
    c.getRandomValues(bytes);
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes).map((b) => b.toString(16).padStart(2, '0'));
    return `${hex.slice(0, 4).join('')}-${hex.slice(4, 6).join('')}-${hex.slice(6, 8).join('')}-${hex.slice(8, 10).join('')}-${hex.slice(10, 16).join('')}`;
  }
  const s4 = () => Math.floor((1 + Math.random()) * 0x10000).toString(16).slice(1);
  return `${s4()}${s4()}-${s4()}-${s4()}-${s4()}-${s4()}${s4()}${s4()}`;
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

export const getObservations = async (signal?: AbortSignal): Promise<Observation[]> => {
  const query = supabase.from('observations').select('*');
  const { data, error } = await applyAbortSignal(query, signal);
  throwQueryError(error);
  return data;
};

export const addObservation = async (observation: Omit<Observation, 'id' | 'created_at'>): Promise<Observation> => {
  const payload: any = { id: uuidV4(), ...observation };
  const { data, error } = await supabase.from('observations').insert(payload).select().single();
  if (error) throw new Error(error.message);
  return data;
};

export const updateObservation = async (id: string, updates: Partial<Observation>): Promise<Observation> => {
  const { data, error } = await supabase.from('observations').update(updates).eq('id', id).select().single();
  if (error) throw new Error(error.message);
  return data;
};

export const deleteObservation = async (id: string): Promise<void> => {
  const { error } = await supabase.from('observations').delete().eq('id', id);
  if (error) throw new Error(error.message);
};
