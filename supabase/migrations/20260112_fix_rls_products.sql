alter table public.products enable row level security;

drop policy if exists "products_insert_anon" on public.products;
drop policy if exists "products_update_anon" on public.products;
drop policy if exists "products_delete_anon" on public.products;

drop policy if exists "products_insert_authenticated" on public.products;
drop policy if exists "products_update_authenticated" on public.products;
drop policy if exists "products_delete_authenticated" on public.products;

create policy "products_insert_anon" on public.products for insert to anon with check (true);
create policy "products_update_anon" on public.products for update to anon using (true) with check (true);
create policy "products_delete_anon" on public.products for delete to anon using (true);

create policy "products_insert_authenticated" on public.products for insert to authenticated with check (true);
create policy "products_update_authenticated" on public.products for update to authenticated using (true) with check (true);
create policy "products_delete_authenticated" on public.products for delete to authenticated using (true);
