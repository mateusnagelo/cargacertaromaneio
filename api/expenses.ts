import { supabase } from '../supabaseClient';
import { ExpenseStock } from '../types';

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

export const getExpenses = async (signal?: AbortSignal): Promise<ExpenseStock[]> => {
  const query = supabase
    .from('expenses_stock')
    .select('*');
  const { data, error } = await applyAbortSignal(query, signal);
  if (error) {
    if (error.message.includes("Could not find the table") || error.message.includes("schema cache")) {
      return [];
    }
    throwQueryError(error);
  }
  return data || [];
};

export const addExpense = async (expense: Omit<ExpenseStock, 'id' | 'created_at'>) => {
  const { data, error } = await supabase
    .from('expenses_stock')
    .insert([expense])
    .select();
  if (error) throw new Error(error.message);
  return data;
};

export const updateExpense = async (id: string, updates: Partial<ExpenseStock>) => {
  const { data, error } = await supabase
    .from('expenses_stock')
    .update(updates)
    .eq('id', id)
    .select();
  if (error) throw new Error(error.message);
  return data;
};

export const deleteExpense = async (id: string) => {
  const { error } = await supabase
    .from('expenses_stock')
    .delete()
    .eq('id', id);
  if (error) throw new Error(error.message);
};
