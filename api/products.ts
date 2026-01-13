import { supabase } from '../supabaseClient';
import { CatalogProduct } from '../types';

const applyAbortSignal = (query: any, signal?: AbortSignal) => {
  if (signal && typeof query?.abortSignal === 'function') return query.abortSignal(signal);
  return query;
};

type ProductOverride = Pick<CatalogProduct, 'name' | 'description' | 'price' | 'unit'>;

const getProductOverrideKey = (id: number) => `bb_product_override_${id}`;
const getProductDeletedKey = (id: number) => `bb_product_deleted_${id}`;

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

export const getProducts = async (signal?: AbortSignal): Promise<CatalogProduct[]> => {
  const query = supabase
    .from('products')
    .select('*');
  const { data, error } = await applyAbortSignal(query, signal);
  throwQueryError(error);
  const rows = (data || []) as CatalogProduct[];
  return rows.map((p) => {
    const override = readJson<ProductOverride>(getProductOverrideKey(p.id));
    if (!override) return p;
    return { ...p, ...override };
  });
};

export const addProduct = async (product: Omit<CatalogProduct, 'id' | 'created_at'>, signal?: AbortSignal) => {
  const query = supabase
    .from('products')
    .insert([product])
    .select()
  const { data, error } = await applyAbortSignal(query, signal);
  throwQueryError(error);
  return data;
};

export const updateProduct = async (id: number, updates: Partial<CatalogProduct>) => {
  const { error, count } = await supabase
    .from('products')
    .update(updates, { count: 'exact' })
    .eq('id', id)
  ;
  throwQueryError(error);
  if (!count) {
    throw new Error('Produto não foi atualizado no banco (0 linhas afetadas). Verifique RLS/policies no Supabase.');
  }
  localStorage.removeItem(getProductOverrideKey(id));
  return [];
};

export const deleteProduct = async (id: number) => {
  const { error, count } = await supabase
    .from('products')
    .delete({ count: 'exact' })
    .eq('id', id)
  ;
  throwQueryError(error);
  if (!count) {
    throw new Error('Produto não foi excluído no banco (0 linhas afetadas). Verifique RLS/policies no Supabase.');
  }
  localStorage.removeItem(getProductDeletedKey(id));
  localStorage.removeItem(getProductOverrideKey(id));
};
