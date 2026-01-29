import { supabase } from '../supabaseClient';
import { Customer, CustomerRole } from '../types';

const applyAbortSignal = (query: any, signal?: AbortSignal) => {
  if (signal && typeof query?.abortSignal === 'function') return query.abortSignal(signal);
  return query;
};

const getMissingColumnFromMessage = (msg: string) => {
  const marker = "Could not find the '";
  const idx = msg.indexOf(marker);
  if (idx !== -1) {
    const rest = msg.slice(idx + marker.length);
    const end = rest.indexOf("' column");
    if (end !== -1) return rest.slice(0, end);
  }

  const match =
    msg.match(/Could not find the '([^']+)' column/i) ||
    msg.match(/column "([^"]+)" of relation "[^"]+" does not exist/i) ||
    msg.match(/column "([^"]+)" does not exist/i);
  return match?.[1] ?? null;
};

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

type CustomerOverride = Partial<Omit<Customer, 'id'>>;

const getCustomerOverrideKey = (id: string) => `bb_customer_override_${id}`;
const getProducerOverrideKey = (id: string) => `bb_producer_override_${id}`;

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

export const fetchCnpjWsCustomer = async (cnpj: string, signal?: AbortSignal) => {
  const clean = String(cnpj || '').replace(/\D/g, '');
  if (clean.length !== 14) throw new Error('CNPJ inválido.');

  const res = await fetch(`https://publica.cnpj.ws/cnpj/${clean}`, {
    method: 'GET',
    headers: { Accept: 'application/json' },
    signal,
  });

  if (!res.ok) {
    throw new Error('CNPJ não encontrado.');
  }

  return res.json();
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
    const normalizeRole = (v: unknown): CustomerRole | undefined => {
      const raw = String(v ?? '').trim().toUpperCase();
      if (!raw) return undefined;
      const s = raw.replace(/[\s\-]+/g, '_');
      if (s === 'CLIENTE' || s.includes('CLIENTE')) return 'CLIENTE';
      if (s === 'PRODUTOR_RURAL' || s === 'PRODUTOR' || s === 'RURAL') return 'PRODUTOR_RURAL';
      if (s.includes('PRODUTOR') || s.includes('RURAL')) return 'PRODUTOR_RURAL';
      return undefined;
    };

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
      role: normalizeRole(row.role ?? row.customer_role ?? row.tipo ?? row.type),
      cep: String(row.cep ?? ''),
      tel: String(row.tel ?? ''),
      email: String(row.email ?? ''),
      fantasyName: String(row.fantasyName ?? ''),
      status: String(row.status ?? ''),
      openingDate: String(row.openingDate ?? ''),
      legalNature: String(row.legalNature ?? ''),
      capitalSocial: (row.capitalSocial ?? null) as any,
      cnaeMainCode: String(row.cnaeMainCode ?? ''),
      cnaeMainDescription: String(row.cnaeMainDescription ?? ''),
      cnpjWsPayload: (row.cnpjWsPayload ?? null) as any,
    };
    const override = readJson<CustomerOverride>(getCustomerOverrideKey(customer.id));
    return override ? ({ ...customer, ...override } as Customer) : customer;
  }).filter(Boolean) as Customer[];
};

export const getProducers = async (signal?: AbortSignal): Promise<Customer[]> => {
  const query = supabase
    .from('producers')
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

    const producer: Customer = {
      id: String(row.id),
      name: String(row.name || ''),
      cnpj: String(row.cnpj ?? row.document ?? ''),
      neighborhood: String(row.neighborhood ?? neighborhoodFromAddress),
      ie: String(row.ie ?? '/'),
      city: String(row.city ?? cityFromAddress),
      address: String(address),
      state: String(row.state ?? stateFromAddress),
      role: 'PRODUTOR_RURAL',
      cep: String(row.cep ?? ''),
      tel: String(row.tel ?? ''),
      email: String(row.email ?? ''),
      fantasyName: String(row.fantasyName ?? ''),
      status: String(row.status ?? ''),
      openingDate: String(row.openingDate ?? ''),
      legalNature: String(row.legalNature ?? ''),
      capitalSocial: (row.capitalSocial ?? null) as any,
      cnaeMainCode: String(row.cnaeMainCode ?? ''),
      cnaeMainDescription: String(row.cnaeMainDescription ?? ''),
      cnpjWsPayload: (row.cnpjWsPayload ?? null) as any,
    };
    const override = readJson<CustomerOverride>(getProducerOverrideKey(producer.id));
    return override ? ({ ...producer, ...override } as Customer) : producer;
  }).filter(Boolean) as Customer[];
};

export const getCustomersByRole = async (role: CustomerRole, signal?: AbortSignal): Promise<Customer[]> => {
  const all = await getCustomers(signal);
  return all.filter((c) => (c?.role ?? 'CLIENTE') === role);
};

export const addCustomer = async (customer: Omit<Customer, 'id'>, signal?: AbortSignal) => {
  const { data: userRes, error: userError } = await supabase.auth.getUser();
  throwQueryError(userError);
  const userId = userRes?.user?.id;
  if (!userId) throw new Error('Usuário não autenticado.');
  const tryInsert = async (payload: any) => {
    const query = supabase
      .from('customers')
      .insert([payload])
      .select()
      .single();
    const { data, error } = await applyAbortSignal(query, signal);
    throwQueryError(error);
    return data as any;
  };

  const removed: Record<string, any> = {};
  const payload: any = {
    owner_id: userId,
    name: customer.name,
    cnpj: customer.cnpj,
    document: customer.cnpj,
    address: customer.address,
    ie: customer.ie ?? '/',
    neighborhood: customer.neighborhood ?? '',
    city: customer.city ?? '',
    state: customer.state ?? '',
    role: (customer as any)?.role ?? 'CLIENTE',
    cep: customer.cep ?? '',
    tel: customer.tel ?? '',
    email: customer.email ?? '',
    fantasyName: customer.fantasyName ?? '',
    status: customer.status ?? '',
    openingDate: customer.openingDate ?? '',
    legalNature: customer.legalNature ?? '',
    capitalSocial: customer.capitalSocial ?? null,
    cnaeMainCode: customer.cnaeMainCode ?? '',
    cnaeMainDescription: customer.cnaeMainDescription ?? '',
    cnpjWsPayload: customer.cnpjWsPayload ?? null,
  };
  const original: any = { ...payload };
  let lastErrorMessage = '';

  for (let attempt = 0; attempt < 50; attempt++) {
    try {
      const inserted = await tryInsert(payload);
      const id = String(inserted?.id);
      if (Object.keys(removed).length > 0) {
        writeJson(getCustomerOverrideKey(id), removed);
      }

      const backfillPayload: any = { ...original, ...removed };
      delete backfillPayload.id;
      delete backfillPayload.created_at;
      delete backfillPayload.name;
      delete backfillPayload.document;
      delete backfillPayload.address;

      if (Object.keys(backfillPayload).length > 0) {
        const updated = await updateCustomer(id, backfillPayload, signal);
        return Array.isArray(updated) ? inserted : updated;
      }

      return inserted;
    } catch (err: any) {
      const msg = String(err?.message || '');
      lastErrorMessage = msg;
      const missing = getMissingColumnFromMessage(msg);
      if (missing && attempt < 6) {
        await sleep(800);
        continue;
      }
      if (missing && missing in payload) {
        removed[missing] = payload[missing];
        delete payload[missing];
        continue;
      }
      if (msg.includes('schema cache')) {
        if (attempt < 6) {
          await sleep(800);
          continue;
        }
        if (Object.keys(payload).length > 2) {
          Object.assign(removed, payload);
          for (const k of Object.keys(payload)) {
            if (!['name', 'document', 'address'].includes(k)) delete payload[k];
          }
          continue;
        }
      }
      throw err;
    }
  }

  throw new Error(
    `Falha ao cadastrar cliente: ${lastErrorMessage ? lastErrorMessage : 'payload incompatível com o banco.'}`
  );
};

export const addProducer = async (producer: Omit<Customer, 'id'>, signal?: AbortSignal) => {
  const { data: userRes, error: userError } = await supabase.auth.getUser();
  throwQueryError(userError);
  const userId = userRes?.user?.id;
  if (!userId) throw new Error('Usuário não autenticado.');
  const tryInsert = async (payload: any) => {
    const query = supabase
      .from('producers')
      .insert([payload])
      .select()
      .single();
    const { data, error } = await applyAbortSignal(query, signal);
    throwQueryError(error);
    return data as any;
  };

  const removed: Record<string, any> = {};
  const payload: any = {
    owner_id: userId,
    name: producer.name,
    cnpj: producer.cnpj,
    document: producer.cnpj,
    address: producer.address,
    ie: producer.ie ?? '/',
    neighborhood: producer.neighborhood ?? '',
    city: producer.city ?? '',
    state: producer.state ?? '',
    role: 'PRODUTOR_RURAL',
    cep: producer.cep ?? '',
    tel: producer.tel ?? '',
    email: producer.email ?? '',
    fantasyName: producer.fantasyName ?? '',
    status: producer.status ?? '',
    openingDate: producer.openingDate ?? '',
    legalNature: producer.legalNature ?? '',
    capitalSocial: producer.capitalSocial ?? null,
    cnaeMainCode: producer.cnaeMainCode ?? '',
    cnaeMainDescription: producer.cnaeMainDescription ?? '',
    cnpjWsPayload: producer.cnpjWsPayload ?? null,
  };
  const original: any = { ...payload };
  let lastErrorMessage = '';

  for (let attempt = 0; attempt < 50; attempt++) {
    try {
      const inserted = await tryInsert(payload);
      const id = String(inserted?.id);
      if (Object.keys(removed).length > 0) {
        writeJson(getProducerOverrideKey(id), removed);
      }

      const backfillPayload: any = { ...original, ...removed };
      delete backfillPayload.id;
      delete backfillPayload.created_at;
      delete backfillPayload.name;
      delete backfillPayload.document;
      delete backfillPayload.address;

      if (Object.keys(backfillPayload).length > 0) {
        const updated = await updateProducer(id, backfillPayload, signal);
        return Array.isArray(updated) ? inserted : updated;
      }

      return inserted;
    } catch (err: any) {
      const msg = String(err?.message || '');
      lastErrorMessage = msg;
      const missing = getMissingColumnFromMessage(msg);
      if (missing && attempt < 6) {
        await sleep(800);
        continue;
      }
      if (missing && missing in payload) {
        removed[missing] = payload[missing];
        delete payload[missing];
        continue;
      }
      if (msg.includes('schema cache')) {
        if (attempt < 6) {
          await sleep(800);
          continue;
        }
        if (Object.keys(payload).length > 2) {
          Object.assign(removed, payload);
          for (const k of Object.keys(payload)) {
            if (!['name', 'document', 'address'].includes(k)) delete payload[k];
          }
          continue;
        }
      }
      throw err;
    }
  }

  throw new Error(
    `Falha ao cadastrar produtor: ${lastErrorMessage ? lastErrorMessage : 'payload incompatível com o banco.'}`
  );
};

export const updateCustomer = async (id: string, updates: Partial<Omit<Customer, 'id'>>, signal?: AbortSignal) => {
  const persistLocal = (partial: Partial<Omit<Customer, 'id'>>) => {
    const current = readJson<CustomerOverride>(getCustomerOverrideKey(id)) ?? {};
    writeJson(getCustomerOverrideKey(id), { ...current, ...partial });
  };

  persistLocal(updates);

  const updatePayload: Record<string, unknown> = { ...updates } as any;
  if (updates.cnpj !== undefined) {
    delete (updatePayload as any).cnpj;
    updatePayload.cnpj = updates.cnpj;
    updatePayload.document = updates.cnpj;
  }

  for (let attempt = 0; attempt < 50; attempt++) {
    if (Object.keys(updatePayload).length === 0) {
      return [];
    }

    try {
      const query = supabase
        .from('customers')
        .update(updatePayload)
        .eq('id', id)
        .select()
        .single();
      const { data, error } = await applyAbortSignal(query, signal);
      throwQueryError(error);
      localStorage.removeItem(getCustomerOverrideKey(id));
      return data;
    } catch (err: any) {
      const msg = String(err?.message || '');
      const missing = getMissingColumnFromMessage(msg);
      if (missing && missing in updatePayload) {
        if (attempt < 6) {
          await sleep(800);
          continue;
        }
        delete (updatePayload as any)[missing];
        continue;
      }
      if (msg.includes('schema cache')) {
        await sleep(800);
        continue;
      }
      throw err;
    }
  }

  throw new Error('Falha ao atualizar cliente: payload incompatível com o banco.');
};

export const updateProducer = async (id: string, updates: Partial<Omit<Customer, 'id'>>, signal?: AbortSignal) => {
  const persistLocal = (partial: Partial<Omit<Customer, 'id'>>) => {
    const current = readJson<CustomerOverride>(getProducerOverrideKey(id)) ?? {};
    writeJson(getProducerOverrideKey(id), { ...current, ...partial });
  };

  persistLocal(updates);

  const updatePayload: Record<string, unknown> = { ...updates } as any;
  if (updates.cnpj !== undefined) {
    delete (updatePayload as any).cnpj;
    updatePayload.cnpj = updates.cnpj;
    updatePayload.document = updates.cnpj;
  }

  for (let attempt = 0; attempt < 50; attempt++) {
    if (Object.keys(updatePayload).length === 0) {
      return [];
    }

    try {
      const query = supabase
        .from('producers')
        .update(updatePayload)
        .eq('id', id)
        .select()
        .single();
      const { data, error } = await applyAbortSignal(query, signal);
      throwQueryError(error);
      localStorage.removeItem(getProducerOverrideKey(id));
      return data;
    } catch (err: any) {
      const msg = String(err?.message || '');
      const missing = getMissingColumnFromMessage(msg);
      if (missing && missing in updatePayload) {
        if (attempt < 6) {
          await sleep(800);
          continue;
        }
        delete (updatePayload as any)[missing];
        continue;
      }
      if (msg.includes('schema cache')) {
        await sleep(800);
        continue;
      }
      throw err;
    }
  }

  throw new Error('Falha ao atualizar produtor: payload incompatível com o banco.');
};

export const deleteCustomer = async (id: string, signal?: AbortSignal) => {
  const query = supabase
    .from('customers')
    .delete({ count: 'exact' })
    .eq('id', id);
  const { error, count } = await applyAbortSignal(query, signal);
  throwQueryError(error);
  if (!count) {
    throw new Error('Cliente não foi excluído no banco (0 linhas afetadas). Verifique RLS/policies no Supabase.');
  }
  localStorage.removeItem(getCustomerOverrideKey(id));
  return [];
};

export const deleteProducer = async (id: string, signal?: AbortSignal) => {
  const query = supabase
    .from('producers')
    .delete({ count: 'exact' })
    .eq('id', id);
  const { error, count } = await applyAbortSignal(query, signal);
  throwQueryError(error);
  if (!count) {
    throw new Error('Produtor não foi excluído no banco (0 linhas afetadas). Verifique RLS/policies no Supabase.');
  }
  localStorage.removeItem(getProducerOverrideKey(id));
  return [];
};
