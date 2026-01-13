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
  if (msg.toLowerCase().includes('column') && msg.toLowerCase().includes('does not exist')) return false;
  return (
    (error as any)?.status === 404 ||
    msg.includes('Not Found') ||
    msg.includes("Could not find the table") ||
    msg.includes('schema cache') ||
    (msg.toLowerCase().includes('relation') && msg.toLowerCase().includes('does not exist'))
  );
};

const getExpensesTableCandidates = () => ['expenses_stock', 'despesas_estoque'];

const toOptionalNumber = (v: any) => {
  if (v === null || v === undefined || v === '') return undefined;
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : undefined;
};

const normalizeExpenseRow = (row: any): ExpenseStock => {
  return {
    id: row?.id != null ? String(row.id) : '',
    created_at: row?.created_at,
    code: String(row?.code ?? ''),
    description: String(row?.description ?? ''),
    defaultUnitValue: toOptionalNumber(row?.defaultUnitValue ?? row?.default_unit_value),
  };
};

const toExpensePayload = (table: string, input: Partial<ExpenseStock>, ownerId: string | null) => {
  const base: any = {
    code: input.code,
    description: input.description,
  };
  if (ownerId) base.owner_id = ownerId;
  const value = toOptionalNumber((input as any).defaultUnitValue);
  if (table === 'expenses_stock') {
    if ('defaultUnitValue' in input) base.default_unit_value = value ?? null;
    return base;
  }
  if ('defaultUnitValue' in input) base.defaultUnitValue = value ?? null;
  return base;
};

export const getExpenses = async (signal?: AbortSignal): Promise<ExpenseStock[]> => {
  for (const table of getExpensesTableCandidates()) {
    const query = supabase.from(table).select('*');
    const { data, error } = await applyAbortSignal(query, signal);
    if (!error) {
      const rows: any[] = data || [];
      return rows.map(normalizeExpenseRow);
    }
    if (isMissingTableError(error)) continue;
    throwQueryError(error);
  }
  return [];
};

export const addExpense = async (expense: Omit<ExpenseStock, 'id' | 'created_at'>) => {
  const { data: userRes, error: userError } = await supabase.auth.getUser();
  throwQueryError(userError);
  const userId = userRes?.user?.id;
  if (!userId) throw new Error('Usuário não autenticado.');
  let lastError: any = null;
  for (const table of getExpensesTableCandidates()) {
    const payload = toExpensePayload(table, expense, userId);
    const { data, error } = await supabase.from(table).insert([payload]).select();
    if (!error) {
      const rows: any[] = data || [];
      return rows.map(normalizeExpenseRow);
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
    const payload = toExpensePayload(table, updates, null);
    const { data, error, count } = await supabase.from(table).update(payload, { count: 'exact' }).eq('id', id).select();
    if (!error) {
      if (!count) {
        throw new Error('Despesa não foi atualizada no banco (0 linhas afetadas). Verifique RLS/policies no Supabase.');
      }
      const rows: any[] = data || [];
      return rows.map(normalizeExpenseRow);
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
    const { error, count } = await supabase.from(table).delete({ count: 'exact' }).eq('id', id);
    if (!error) {
      if (!count) {
        throw new Error('Despesa não foi excluída no banco (0 linhas afetadas). Verifique RLS/policies no Supabase.');
      }
      return;
    }
    lastError = error;
    if (isMissingTableError(error)) continue;
    throwQueryError(error);
  }
  throwQueryError(lastError);
};
