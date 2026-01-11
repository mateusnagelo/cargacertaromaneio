import { supabase } from '../../supabaseClient';
import { Observation } from '../../types';

export const getObservations = async (signal?: AbortSignal): Promise<Observation[]> => {
  const { data, error } = await supabase.from('observations').select('*').abortSignal(signal);
  if (error) throw new Error(error.message);
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
