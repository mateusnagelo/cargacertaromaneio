import { supabase } from '../supabaseClient';
import { Customer } from '../types';

const applyAbortSignal = (query: any, signal?: AbortSignal) => {
  if (signal && typeof query?.abortSignal === 'function') return query.abortSignal(signal);
  return query;
};

type CustomerOverride = Partial<Omit<Customer, 'id'>>;

const getCustomerOverrideKey = (id: string) => `bb_customer_override_${id}`;
const getCustomerDeletedKey = (id: string) => `bb_customer_deleted_${id}`;

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

export const getCustomers = async (signal?: AbortSignal): Promise<Customer[]> => {
  const query = supabase
    .from('customers')
    .select('*');
  const { data, error } = await applyAbortSignal(query, signal);
  throwQueryError(error);
  return (data || []).map((row: any) => {
    const addressRaw = String(row.address ?? '');
    let address = addressRaw;
    let neighborhoodFromAddress = '';
    let cityFromAddress = '';
    let stateFromAddress = '';

    if (!row.city && addressRaw.includes(' - ')) {
      const [addressPart, cityStatePart] = addressRaw.split(' - ');
      address = addressPart;
      const [cityParsed, stateParsed] = cityStatePart.split('/');
      cityFromAddress = String(cityParsed ?? '');
      stateFromAddress = String(stateParsed ?? '');
    }

    if (!row.neighborhood && address.includes(', ')) {
      const parts = address.split(', ');
      neighborhoodFromAddress = parts.pop() || '';
      address = parts.join(', ');
    }

    const customer: Customer = {
      id: String(row.id),
      name: String(row.name || ''),
      cnpj: String(row.cnpj ?? row.document ?? ''),
      neighborhood: String(row.neighborhood ?? neighborhoodFromAddress),
      ie: String(row.ie ?? '/'),
      city: String(row.city ?? cityFromAddress),
      address: String(address),
      state: String(row.state ?? stateFromAddress),
    };
    if (readJson<boolean>(getCustomerDeletedKey(customer.id))) return null as any;
    const override = readJson<CustomerOverride>(getCustomerOverrideKey(customer.id));
    return override ? ({ ...customer, ...override } as Customer) : customer;
  }).filter(Boolean) as Customer[];
};

export const addCustomer = async (customer: Omit<Customer, 'id'>, signal?: AbortSignal) => {
  const insertPayload = {
    name: customer.name,
    document: customer.cnpj,
    address: customer.address,
  };
  const query = supabase
    .from('customers')
    .insert([insertPayload])
    .select()
  const { data, error } = await applyAbortSignal(query, signal);
  throwQueryError(error);
  return data;
};

export const updateCustomer = async (id: string, updates: Partial<Omit<Customer, 'id'>>, signal?: AbortSignal) => {
  const updatePayload: Record<string, unknown> = {};
  if (updates.name !== undefined) updatePayload.name = updates.name;
  if (updates.cnpj !== undefined) updatePayload.document = updates.cnpj;
  if (updates.address !== undefined) updatePayload.address = updates.address;

  const query = supabase
    .from('customers')
    .update(updatePayload)
    .eq('id', id)
    .select()
  const { data, error } = await applyAbortSignal(query, signal);
  throwQueryError(error);
  if (!data || data.length === 0) {
    const current = readJson<CustomerOverride>(getCustomerOverrideKey(id)) ?? {};
    writeJson(getCustomerOverrideKey(id), { ...current, ...updates });
    return [];
  }
  localStorage.removeItem(getCustomerOverrideKey(id));
  return data;
};

export const deleteCustomer = async (id: string, signal?: AbortSignal) => {
  const query = supabase
    .from('customers')
    .delete()
    .eq('id', id)
    .select()
  const { data, error } = await applyAbortSignal(query, signal);
  throwQueryError(error);
  if (!data || (Array.isArray(data) && data.length === 0)) {
    writeJson(getCustomerDeletedKey(id), true);
    return [];
  }
  localStorage.removeItem(getCustomerDeletedKey(id));
  localStorage.removeItem(getCustomerOverrideKey(id));
  return data;
};
