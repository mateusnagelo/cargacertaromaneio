import { supabase } from '../supabaseClient';
import { Customer } from '../types';

export const getCustomers = async (signal?: AbortSignal) => {
  const { data, error } = await supabase
    .from('customers')
    .select('*')
    .abortSignal(signal);
  if (error) throw new Error(error.message);
  return data;
};

export const addCustomer = async (customer: Omit<Customer, 'id'>, signal?: AbortSignal) => {
  const { data, error } = await supabase
    .from('customers')
    .insert([customer])
    .select()
    .abortSignal(signal);
  if (error) throw new Error(error.message);
  return data;
};

export const updateCustomer = async (id: string, updates: Partial<Omit<Customer, 'id'>>, signal?: AbortSignal) => {
  const { data, error } = await supabase
    .from('customers')
    .update(updates)
    .eq('id', id)
    .select()
    .abortSignal(signal);
  if (error) throw new Error(error.message);
  return data;
};

export const deleteCustomer = async (id: string, signal?: AbortSignal) => {
  const { data, error } = await supabase
    .from('customers')
    .delete()
    .eq('id', id)
    .select()
    .abortSignal(signal);
  if (error) throw new Error(error.message);
  return data;
};
