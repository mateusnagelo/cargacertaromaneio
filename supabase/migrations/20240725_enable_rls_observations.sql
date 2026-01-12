
-- Habilita RLS para a tabela de observações
alter table public.observations enable row level security;

-- Permite que usuários anônimos leiam todas as observações
create policy "observations_select_anon" on public.observations for select to anon using (true);

-- Permite que usuários anônimos insiram novas observações
create policy "observations_insert_anon" on public.observations for insert to anon with check (true);

-- Permite que usuários anônimos atualizem suas próprias observações
-- (Neste caso, estamos permitindo a atualização de qualquer observação,
-- pois não há um conceito de "dono" da observação no schema atual)
create policy "observations_update_anon" on public.observations for update to anon using (true) with check (true);

-- Permite que usuários anônimos deletem observações
create policy "observations_delete_anon" on public.observations for delete to anon using (true);
