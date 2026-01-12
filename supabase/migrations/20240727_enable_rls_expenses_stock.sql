
-- Habilita RLS para a tabela de despesas
alter table public.expenses_stock enable row level security;

-- Permite que usuários anônimos leiam todas as despesas
create policy "expenses_stock_select_anon" on public.expenses_stock for select to anon using (true);

-- Permite que usuários anônimos insiram novas despesas
create policy "expenses_stock_insert_anon" on public.expenses_stock for insert to anon with check (true);

-- Permite que usuários anônimos atualizem despesas
create policy "expenses_stock_update_anon" on public.expenses_stock for update to anon using (true) with check (true);

-- Permite que usuários anônimos deletem despesas
create policy "expenses_stock_delete_anon" on public.expenses_stock for delete to anon using (true);
