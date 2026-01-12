import { supabase } from '../supabaseClient';
import { CompanyInfo } from '../types';

const applyAbortSignal = (query: any, signal?: AbortSignal) => {
  if (signal && typeof query?.abortSignal === 'function') return query.abortSignal(signal);
  return query;
};

const getMissingColumnFromMessage = (msg: string) => {
  const marker = "Could not find the '";
  const idx = msg.indexOf(marker);
  if (idx === -1) return null;
  const rest = msg.slice(idx + marker.length);
  const end = rest.indexOf("' column");
  if (end === -1) return null;
  return rest.slice(0, end);
};

const getCompanyMetaKey = (id: string) => `bb_company_meta_${id}`;
const getCompanyBankingKey = (id: string) => `bb_company_banking_${id}`;

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

type CompanyMeta = Pick<CompanyInfo, 'location' | 'address' | 'cep' | 'tel' | 'logoUrl'>;

const DEFAULT_META: CompanyMeta = {
  location: '',
  address: '',
  cep: '',
  tel: '',
  logoUrl: '',
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

export const getCompanies = async (signal?: AbortSignal): Promise<CompanyInfo[]> => {
  const query = supabase
    .from('companies')
    .select('*');
  const { data, error } = await applyAbortSignal(query, signal);
  throwQueryError(error);
  return (data || []).map((row: any) => ({
    ...row,
    location: String(row?.location ?? readJson<CompanyMeta>(getCompanyMetaKey(String(row?.id)))?.location ?? DEFAULT_META.location),
    address: String(row?.address ?? readJson<CompanyMeta>(getCompanyMetaKey(String(row?.id)))?.address ?? DEFAULT_META.address),
    cep: String(row?.cep ?? readJson<CompanyMeta>(getCompanyMetaKey(String(row?.id)))?.cep ?? DEFAULT_META.cep),
    tel: String(row?.tel ?? readJson<CompanyMeta>(getCompanyMetaKey(String(row?.id)))?.tel ?? DEFAULT_META.tel),
    logoUrl: String(row?.logoUrl ?? readJson<CompanyMeta>(getCompanyMetaKey(String(row?.id)))?.logoUrl ?? DEFAULT_META.logoUrl),
    banking:
      row?.banking ??
      (() => {
        return readJson<CompanyInfo['banking']>(getCompanyBankingKey(String(row?.id))) ?? DEFAULT_BANKING;
      })(),
  })) as CompanyInfo[];
};

export const addCompany = async (company: Omit<CompanyInfo, 'id' | 'created_at'>, signal?: AbortSignal) => {
  const tryInsert = async (payload: any) => {
    const query = supabase.from('companies').insert([payload]).select('*').single();
    const { data, error } = await applyAbortSignal(query, signal);
    throwQueryError(error);
    return data as any;
  };

  const removed: Record<string, any> = {};
  const payload: any = { ...company };

  for (let attempt = 0; attempt < 10; attempt++) {
    try {
      const inserted = await tryInsert(payload);
      const id = String(inserted?.id);

      const bankingToPersist = (inserted?.banking ?? removed.banking ?? company.banking ?? DEFAULT_BANKING) as CompanyInfo['banking'];
      writeJson(getCompanyBankingKey(id), bankingToPersist);

      const metaToPersist: CompanyMeta = {
        location: String(inserted?.location ?? removed.location ?? company.location ?? DEFAULT_META.location),
        address: String(inserted?.address ?? removed.address ?? company.address ?? DEFAULT_META.address),
        cep: String(inserted?.cep ?? removed.cep ?? company.cep ?? DEFAULT_META.cep),
        tel: String(inserted?.tel ?? removed.tel ?? company.tel ?? DEFAULT_META.tel),
        logoUrl: String(inserted?.logoUrl ?? removed.logoUrl ?? company.logoUrl ?? DEFAULT_META.logoUrl),
      };
      writeJson(getCompanyMetaKey(id), metaToPersist);

      return {
        ...inserted,
        ...metaToPersist,
        banking: bankingToPersist,
      } as CompanyInfo;
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
      location: partial.location ?? currentMeta.location,
      address: partial.address ?? currentMeta.address,
      cep: partial.cep ?? currentMeta.cep,
      tel: partial.tel ?? currentMeta.tel,
      logoUrl: partial.logoUrl ?? currentMeta.logoUrl,
    };
    writeJson(getCompanyMetaKey(id), mergedMeta);
  };

  persistLocal(updates);

  for (let attempt = 0; attempt < 10; attempt++) {
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
        delete payload[missing];
        continue;
      }
      if (missing && missing === 'banking') {
        delete payload.banking;
        continue;
      }
      throw err;
    }
  }

  throw new Error('Falha ao atualizar empresa: payload incompatível com o banco.');
};

export const deleteCompany = async (id: string, signal?: AbortSignal) => {
  const query = supabase.from('companies').delete().eq('id', id);
  const { error } = await applyAbortSignal(query, signal);
  throwQueryError(error);
  localStorage.removeItem(getCompanyBankingKey(id));
  localStorage.removeItem(getCompanyMetaKey(id));
};
