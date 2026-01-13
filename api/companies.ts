import { supabase } from '../supabaseClient';
import { CompanyInfo } from '../types';

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

const getCompanyMetaKey = (id: string) => `bb_company_meta_${id}`;
const getCompanyBankingKey = (id: string) => `bb_company_banking_${id}`;

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

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

const DEFAULT_BANKING: CompanyInfo['banking'] = {
  bank: '',
  pix: '',
  type: 'CORRENTE',
  agency: '',
  account: '',
  owner: '',
};

type CompanyMeta = Pick<
  CompanyInfo,
  | 'cnpj'
  | 'ie'
  | 'location'
  | 'address'
  | 'cep'
  | 'tel'
  | 'logoUrl'
  | 'fantasyName'
  | 'email'
  | 'status'
  | 'openingDate'
  | 'legalNature'
  | 'capitalSocial'
  | 'cnaeMainCode'
  | 'cnaeMainDescription'
  | 'cnpjWsPayload'
>;

const DEFAULT_META: CompanyMeta = {
  cnpj: '',
  ie: '',
  location: '',
  address: '',
  cep: '',
  tel: '',
  logoUrl: '',
  fantasyName: '',
  email: '',
  status: '',
  openingDate: '',
  legalNature: '',
  capitalSocial: null,
  cnaeMainCode: '',
  cnaeMainDescription: '',
  cnpjWsPayload: null,
};

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

export const fetchCnpjWsCompany = async (cnpj: string, signal?: AbortSignal) => {
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

export const getCompanies = async (signal?: AbortSignal): Promise<CompanyInfo[]> => {
  const query = supabase
    .from('companies')
    .select('*');
  const { data, error } = await applyAbortSignal(query, signal);
  throwQueryError(error);
  return (data || []).map((row: any) => ({
    ...row,
    cnpj: String(row?.cnpj ?? readJson<CompanyMeta>(getCompanyMetaKey(String(row?.id)))?.cnpj ?? DEFAULT_META.cnpj),
    ie: String(row?.ie ?? readJson<CompanyMeta>(getCompanyMetaKey(String(row?.id)))?.ie ?? DEFAULT_META.ie),
    location: String(row?.location ?? readJson<CompanyMeta>(getCompanyMetaKey(String(row?.id)))?.location ?? DEFAULT_META.location),
    address: String(row?.address ?? readJson<CompanyMeta>(getCompanyMetaKey(String(row?.id)))?.address ?? DEFAULT_META.address),
    cep: String(row?.cep ?? readJson<CompanyMeta>(getCompanyMetaKey(String(row?.id)))?.cep ?? DEFAULT_META.cep),
    tel: String(row?.tel ?? readJson<CompanyMeta>(getCompanyMetaKey(String(row?.id)))?.tel ?? DEFAULT_META.tel),
    logoUrl: String(row?.logoUrl ?? readJson<CompanyMeta>(getCompanyMetaKey(String(row?.id)))?.logoUrl ?? DEFAULT_META.logoUrl),
    fantasyName: String(row?.fantasyName ?? readJson<CompanyMeta>(getCompanyMetaKey(String(row?.id)))?.fantasyName ?? DEFAULT_META.fantasyName),
    email: String(row?.email ?? readJson<CompanyMeta>(getCompanyMetaKey(String(row?.id)))?.email ?? DEFAULT_META.email),
    status: String(row?.status ?? readJson<CompanyMeta>(getCompanyMetaKey(String(row?.id)))?.status ?? DEFAULT_META.status),
    openingDate: String(row?.openingDate ?? readJson<CompanyMeta>(getCompanyMetaKey(String(row?.id)))?.openingDate ?? DEFAULT_META.openingDate),
    legalNature: String(row?.legalNature ?? readJson<CompanyMeta>(getCompanyMetaKey(String(row?.id)))?.legalNature ?? DEFAULT_META.legalNature),
    capitalSocial: (row?.capitalSocial ?? readJson<CompanyMeta>(getCompanyMetaKey(String(row?.id)))?.capitalSocial ?? DEFAULT_META.capitalSocial) as any,
    cnaeMainCode: String(row?.cnaeMainCode ?? readJson<CompanyMeta>(getCompanyMetaKey(String(row?.id)))?.cnaeMainCode ?? DEFAULT_META.cnaeMainCode),
    cnaeMainDescription: String(row?.cnaeMainDescription ?? readJson<CompanyMeta>(getCompanyMetaKey(String(row?.id)))?.cnaeMainDescription ?? DEFAULT_META.cnaeMainDescription),
    cnpjWsPayload: (row?.cnpjWsPayload ?? readJson<CompanyMeta>(getCompanyMetaKey(String(row?.id)))?.cnpjWsPayload ?? DEFAULT_META.cnpjWsPayload) as any,
    banking:
      row?.banking ??
      (() => {
        return readJson<CompanyInfo['banking']>(getCompanyBankingKey(String(row?.id))) ?? DEFAULT_BANKING;
      })(),
  })) as CompanyInfo[];
};

export const addCompany = async (company: Omit<CompanyInfo, 'id' | 'created_at'>, signal?: AbortSignal) => {
  const { data: userRes, error: userError } = await supabase.auth.getUser();
  throwQueryError(userError);
  const userId = userRes?.user?.id;
  if (!userId) throw new Error('Usuário não autenticado.');
  const tryInsert = async (payload: any) => {
    const query = supabase.from('companies').insert([payload]).select('*').single();
    const { data, error } = await applyAbortSignal(query, signal);
    throwQueryError(error);
    return data as any;
  };

  const removed: Record<string, any> = {};
  const payload: any = { ...company, owner_id: userId };
  const original: any = { ...company, owner_id: userId };

  for (let attempt = 0; attempt < 50; attempt++) {
    try {
      const inserted = await tryInsert(payload);
      const id = String(inserted?.id);

      const bankingToPersist = (inserted?.banking ?? removed.banking ?? company.banking ?? DEFAULT_BANKING) as CompanyInfo['banking'];
      writeJson(getCompanyBankingKey(id), bankingToPersist);

      const metaToPersist: CompanyMeta = {
        cnpj: String(inserted?.cnpj ?? removed.cnpj ?? company.cnpj ?? DEFAULT_META.cnpj),
        ie: String(inserted?.ie ?? removed.ie ?? company.ie ?? DEFAULT_META.ie),
        location: String(inserted?.location ?? removed.location ?? company.location ?? DEFAULT_META.location),
        address: String(inserted?.address ?? removed.address ?? company.address ?? DEFAULT_META.address),
        cep: String(inserted?.cep ?? removed.cep ?? company.cep ?? DEFAULT_META.cep),
        tel: String(inserted?.tel ?? removed.tel ?? company.tel ?? DEFAULT_META.tel),
        logoUrl: String(inserted?.logoUrl ?? removed.logoUrl ?? company.logoUrl ?? DEFAULT_META.logoUrl),
        fantasyName: String(inserted?.fantasyName ?? removed.fantasyName ?? company.fantasyName ?? DEFAULT_META.fantasyName),
        email: String(inserted?.email ?? removed.email ?? company.email ?? DEFAULT_META.email),
        status: String(inserted?.status ?? removed.status ?? company.status ?? DEFAULT_META.status),
        openingDate: String(inserted?.openingDate ?? removed.openingDate ?? company.openingDate ?? DEFAULT_META.openingDate),
        legalNature: String(inserted?.legalNature ?? removed.legalNature ?? company.legalNature ?? DEFAULT_META.legalNature),
        capitalSocial: (inserted?.capitalSocial ?? removed.capitalSocial ?? company.capitalSocial ?? DEFAULT_META.capitalSocial) as any,
        cnaeMainCode: String(inserted?.cnaeMainCode ?? removed.cnaeMainCode ?? company.cnaeMainCode ?? DEFAULT_META.cnaeMainCode),
        cnaeMainDescription: String(inserted?.cnaeMainDescription ?? removed.cnaeMainDescription ?? company.cnaeMainDescription ?? DEFAULT_META.cnaeMainDescription),
        cnpjWsPayload: (inserted?.cnpjWsPayload ?? removed.cnpjWsPayload ?? company.cnpjWsPayload ?? DEFAULT_META.cnpjWsPayload) as any,
      };
      writeJson(getCompanyMetaKey(id), metaToPersist);

      const backfillPayload: any = { ...original, ...removed };
      delete backfillPayload.id;
      delete backfillPayload.created_at;
      delete backfillPayload.name;

      if (Object.keys(backfillPayload).length > 0) {
        const updated = await updateCompany(id, backfillPayload, signal);
        return updated;
      }

      return { ...inserted, ...metaToPersist, banking: bankingToPersist } as CompanyInfo;
    } catch (err: any) {
      const msg = String(err?.message || '');
      const missing = getMissingColumnFromMessage(msg);
      if (missing && missing in payload) {
        removed[missing] = payload[missing];
        delete payload[missing];
        continue;
      }
      if (missing && missing === 'banking') {
        removed.banking = payload.banking;
        delete payload.banking;
        continue;
      }

      if (msg.includes('schema cache') && Object.keys(payload).length > 1) {
        Object.assign(removed, payload);
        for (const k of Object.keys(payload)) {
          if (k !== 'name') delete payload[k];
        }
        continue;
      }

      throw err;
    }
  }

  throw new Error('Falha ao cadastrar empresa: payload incompatível com o banco.');
};

export const updateCompany = async (id: string, updates: Partial<CompanyInfo>, signal?: AbortSignal) => {
  const payload: any = { ...updates };

  const persistLocal = (partial: Partial<CompanyInfo>) => {
    if (partial.banking) writeJson(getCompanyBankingKey(id), partial.banking);

    const currentMeta = readJson<CompanyMeta>(getCompanyMetaKey(id)) ?? DEFAULT_META;
    const mergedMeta: CompanyMeta = {
      cnpj: partial.cnpj ?? currentMeta.cnpj,
      ie: partial.ie ?? currentMeta.ie,
      location: partial.location ?? currentMeta.location,
      address: partial.address ?? currentMeta.address,
      cep: partial.cep ?? currentMeta.cep,
      tel: partial.tel ?? currentMeta.tel,
      logoUrl: partial.logoUrl ?? currentMeta.logoUrl,
      fantasyName: partial.fantasyName ?? currentMeta.fantasyName,
      email: partial.email ?? currentMeta.email,
      status: partial.status ?? currentMeta.status,
      openingDate: partial.openingDate ?? currentMeta.openingDate,
      legalNature: partial.legalNature ?? currentMeta.legalNature,
      capitalSocial: partial.capitalSocial ?? currentMeta.capitalSocial,
      cnaeMainCode: partial.cnaeMainCode ?? currentMeta.cnaeMainCode,
      cnaeMainDescription: partial.cnaeMainDescription ?? currentMeta.cnaeMainDescription,
      cnpjWsPayload: partial.cnpjWsPayload ?? currentMeta.cnpjWsPayload,
    };
    writeJson(getCompanyMetaKey(id), mergedMeta);
  };

  persistLocal(updates);

  for (let attempt = 0; attempt < 50; attempt++) {
    if (Object.keys(payload).length === 0) {
      const companies = await getCompanies(signal);
      const found = companies.find((c) => String(c.id) === String(id));
      if (!found) throw new Error('Empresa não encontrada após atualização.');
      return found;
    }

    try {
      const q = supabase.from('companies').update(payload).eq('id', id).select('*').single();
      const { data, error } = await applyAbortSignal(q, signal);
      throwQueryError(error);
      const meta = readJson<CompanyMeta>(getCompanyMetaKey(id)) ?? DEFAULT_META;
      const banking = readJson<CompanyInfo['banking']>(getCompanyBankingKey(id)) ?? DEFAULT_BANKING;
      return { ...(data as any), ...meta, banking: (data as any)?.banking ?? banking } as CompanyInfo;
    } catch (err: any) {
      const msg = String(err?.message || '');
      const missing = getMissingColumnFromMessage(msg);
      if (missing && missing in payload) {
        if (attempt < 6) {
          await sleep(800);
          continue;
        }
        delete payload[missing];
        continue;
      }
      if (missing && missing === 'banking') {
        delete payload.banking;
        continue;
      }
      if (msg.includes('schema cache')) {
        await sleep(800);
        continue;
      }
      throw err;
    }
  }

  throw new Error('Falha ao atualizar empresa: payload incompatível com o banco.');
};

export const deleteCompany = async (id: string, signal?: AbortSignal) => {
  const query = supabase.from('companies').delete({ count: 'exact' }).eq('id', id);
  const { error, count } = await applyAbortSignal(query, signal);
  throwQueryError(error);
  if (!count) {
    throw new Error('Empresa não foi excluída no banco (0 linhas afetadas). Verifique RLS/policies no Supabase.');
  }
  localStorage.removeItem(getCompanyBankingKey(id));
  localStorage.removeItem(getCompanyMetaKey(id));
};
