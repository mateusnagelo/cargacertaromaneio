
-- Habilita RLS para a tabela de empresas
alter table public.companies enable row level security;

-- Permite que usuários anônimos leiam todas as empresas
create policy "companies_select_anon" on public.companies for select to anon using (true);

-- Permite que usuários anônimos insiram novas empresas
create policy "companies_insert_anon" on public.companies for insert to anon with check (true);

-- Permite que usuários anônimos atualizem empresas
create policy "companies_update_anon" on public.companies for update to anon using (true) with check (true);

-- Permite que usuários anônimos deletem empresas
create policy "companies_delete_anon" on public.companies for delete to anon using (true);
