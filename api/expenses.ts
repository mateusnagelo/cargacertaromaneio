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

const isMissingTableError = (error: any) => {
  const msg = String(error?.message || '');
  return (
    (error as any)?.status === 404 ||
    msg.includes('Not Found') ||
    msg.includes("Could not find the table") ||
    msg.includes('schema cache') ||
    msg.includes('does not exist')
  );
};

const getExpensesTableCandidates = () => ['expenses_stock', 'despesas_estoque'];

export const getExpenses = async (signal?: AbortSignal): Promise<ExpenseStock[]> => {
  for (const table of getExpensesTableCandidates()) {
    const query = supabase.from(table).select('*');
    const { data, error } = await applyAbortSignal(query, signal);
    if (!error) {
      const rows: any[] = data || [];
      return rows.map((r) => ({ ...r, id: r?.id != null ? String(r.id) : r?.id })) as any;
    }
    if (isMissingTableError(error)) continue;
    throwQueryError(error);
  }
  return [];
};

export const addExpense = async (expense: Omit<ExpenseStock, 'id' | 'created_at'>) => {
  let lastError: any = null;
  for (const table of getExpensesTableCandidates()) {
    const { data, error } = await supabase.from(table).insert([expense]).select();
    if (!error) {
      const rows: any[] = data || [];
      return rows.map((r) => ({ ...r, id: r?.id != null ? String(r.id) : r?.id })) as any;
    }
    lastError = error;
    if (isMissingTableError(error)) continue;
    throwQueryError(error);
  }
  throwQueryError(lastError);
};

export const updateExpense = async (id: string, updates: Partial<ExpenseStock>) => {
  let lastError: any = null;
  for (const table of getExpensesTableCandidates()) {
    const { data, error } = await supabase.from(table).update(updates).eq('id', id).select();
    if (!error) {
      const rows: any[] = data || [];
      return rows.map((r) => ({ ...r, id: r?.id != null ? String(r.id) : r?.id })) as any;
    }
    lastError = error;
    if (isMissingTableError(error)) continue;
    throwQueryError(error);
  }
  throwQueryError(lastError);
};

export const deleteExpense = async (id: string) => {
  let lastError: any = null;
  for (const table of getExpensesTableCandidates()) {
    const { error } = await supabase.from(table).delete().eq('id', id);
    if (!error) return;
    lastError = error;
    if (isMissingTableError(error)) continue;
    throwQueryError(error);
  }
  throwQueryError(lastError);
};
