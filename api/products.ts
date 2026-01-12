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
  return rows
    .filter((p) => !readJson<boolean>(getProductDeletedKey(p.id)))
    .map((p) => {
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
  const { data, error } = await supabase
    .from('products')
    .update(updates)
    .eq('id', id)
    .select();
  throwQueryError(error);
  if (!data || data.length === 0) {
    const current = (readJson<ProductOverride>(getProductOverrideKey(id)) ?? {}) as Partial<ProductOverride>;
    const next: ProductOverride = {
      name: (updates.name ?? current.name ?? '') as any,
      description: (updates.description ?? current.description ?? null) as any,
      price: (updates.price ?? current.price ?? null) as any,
      unit: (updates.unit ?? current.unit ?? null) as any,
    };
    writeJson(getProductOverrideKey(id), next);
    return [];
  }
  localStorage.removeItem(getProductOverrideKey(id));
  return data;
};

export const deleteProduct = async (id: number) => {
  const { data, error } = await supabase
    .from('products')
    .delete()
    .eq('id', id)
    .select('id');
  throwQueryError(error);
  if (!data || (Array.isArray(data) && data.length === 0)) {
    writeJson(getProductDeletedKey(id), true);
    return;
  }
  localStorage.removeItem(getProductDeletedKey(id));
  localStorage.removeItem(getProductOverrideKey(id));
};
