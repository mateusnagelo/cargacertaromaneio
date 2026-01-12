import { supabase } from '../supabaseClient';
import { Observation } from '../types';

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

export const getObservations = async (signal?: AbortSignal): Promise<Observation[]> => {
  const query = supabase.from('observations').select('*');
  const { data, error } = await applyAbortSignal(query, signal);
  throwQueryError(error);
  return data;
};

export const addObservation = async (observation: Omit<Observation, 'id' | 'created_at'>): Promise<Observation> => {
  const { data, error } = await supabase.from('observations').insert(observation).select().single();
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
