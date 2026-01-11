import { supabase } from '../supabaseClient';
import { RomaneioData } from '../types';

// Busca todos os romaneios com seus itens, clientes e empresas associadas
export const getRomaneios = async (signal?: AbortSignal): Promise<RomaneioData[]> => {
  const { data: romaneios, error } = await supabase
    .from('romaneios')
    .select(`
      *,
      customer:customers(*),
      company:companies(*)
    `)
    .abortSignal(signal);

  if (error) throw new Error(error.message);
  
  return (romaneios || []).map((r: any) => ({
    ...r,
    customer: r.customer,
    company: r.company,
    client: r.client ?? (r.customer ? {
      name: r.customer.name ?? '',
      cnpj: r.customer.cnpj ?? '',
      neighborhood: r.customer.neighborhood ?? '',
      ie: r.customer.ie ?? '/',
      city: r.customer.city ?? '',
      address: r.customer.address ?? '',
      state: r.customer.state ?? '',
    } : undefined),
  })) as RomaneioData[];
};

// Adiciona um novo romaneio e seus itens
export const addRomaneio = async (romaneioData: Omit<RomaneioData, 'id' | 'created_at'>, signal?: AbortSignal) => {
  const { company, customer, companyId, customerId, ...romaneioInfo } = romaneioData as any;

  const { data: newRomaneio, error: romaneioError } = await supabase
    .from('romaneios')
    .insert([{
      ...romaneioInfo,
    }])
    .select()
    .abortSignal(signal)
    .single();

  if (romaneioError) {
    console.error('Error adding romaneio:', romaneioError);
    throw new Error(romaneioError.message);
  }

  if (!newRomaneio) {
    throw new Error('Failed to create romaneio, no data returned.');
  }

  return newRomaneio;
};

// Deleta um romaneio e seus itens (usando cascade no DB)
export const deleteRomaneio = async (id: number) => {
  const { error } = await supabase
    .from('romaneios')
    .delete()
    .eq('id', id);

  if (error) throw new Error(error.message);
};

// Atualiza o status de um romaneio
export const updateRomaneioStatus = async (id: number, status: string) => {
    const { data, error } = await supabase
        .from('romaneios')
        .update({ status })
        .eq('id', id)
        .select();

    if (error) throw new Error(error.message);
    return data;
}
