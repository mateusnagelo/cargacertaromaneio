import { supabase } from '../supabaseClient';
import { CompanyInfo } from '../types';

export const getCompanies = async (signal?: AbortSignal): Promise<CompanyInfo[]> => {
  const { data, error } = await supabase
    .from('companies')
    .select('*')
    .abortSignal(signal);
  if (error) throw new Error(error.message);
  return data || [];
};

export const addCompany = async (company: Omit<CompanyInfo, 'id' | 'created_at'>) => {
  const { data, error } = await supabase
    .from('companies')
    .insert([company])
    .select();
  if (error) throw new Error(error.message);
  return data;
};

export const updateCompany = async (id: number, updates: Partial<CompanyInfo>) => {
  const { data, error } = await supabase
    .from('companies')
    .update(updates)
    .eq('id', id)
    .select();
  if (error) throw new Error(error.message);
  return data;
};

export const deleteCompany = async (id: number) => {
  const { error } = await supabase
    .from('companies')
    .delete()
    .eq('id', id);
  if (error) throw new Error(error.message);
};
