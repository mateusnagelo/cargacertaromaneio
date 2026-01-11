import { supabase } from '../supabaseClient';
import { CatalogProduct } from '../types';

export const getProducts = async (signal?: AbortSignal): Promise<CatalogProduct[]> => {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .abortSignal(signal);
  if (error) throw new Error(error.message);
  return data || [];
};

export const addProduct = async (product: Omit<CatalogProduct, 'id' | 'created_at'>, signal?: AbortSignal) => {
  const { data, error } = await supabase
    .from('products')
    .insert([product])
    .select()
    .abortSignal(signal);
  if (error) throw new Error(error.message);
  return data;
};

export const updateProduct = async (id: number, updates: Partial<CatalogProduct>) => {
  const { data, error } = await supabase
    .from('products')
    .update(updates)
    .eq('id', id)
    .select();
  if (error) throw new Error(error.message);
  return data;
};

export const deleteProduct = async (id: number) => {
  const { error } = await supabase
    .from('products')
    .delete()
    .eq('id', id);
  if (error) throw new Error(error.message);
};
