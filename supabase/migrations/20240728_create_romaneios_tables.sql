
CREATE TABLE public.romaneios (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    company_id uuid,
    customer_id uuid,
    "number" integer,
    total_value numeric,
    total_weight numeric,
    driver_name text,
    driver_license text,
    truck_plate text,
    truck_model text,
    observation_ids uuid[],
    banking jsonb,
    CONSTRAINT romaneios_pkey PRIMARY KEY (id),
    CONSTRAINT romaneios_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id),
    CONSTRAINT romaneios_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES customers(id)
);

CREATE TABLE public.romaneio_items (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    romaneio_id uuid,
    product_id uuid,
    quantity integer,
    unit_value numeric,
    total_value numeric,
    CONSTRAINT romaneio_items_pkey PRIMARY KEY (id),
    CONSTRAINT romaneio_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES products(id),
    CONSTRAINT romaneio_items_romaneio_id_fkey FOREIGN KEY (romaneio_id) REFERENCES romaneios(id) ON DELETE CASCADE
);

CREATE TABLE public.romaneio_expenses (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    romaneio_id uuid,
    expense_id uuid,
    quantity integer,
    unit_value numeric,
    total_value numeric,
    CONSTRAINT romaneio_expenses_pkey PRIMARY KEY (id),
    CONSTRAINT romaneio_expenses_expense_id_fkey FOREIGN KEY (expense_id) REFERENCES expenses_stock(id),
    CONSTRAINT romaneio_expenses_romaneio_id_fkey FOREIGN KEY (romaneio_id) REFERENCES romaneios(id) ON DELETE CASCADE
);

alter table public.romaneios enable row level security;
create policy "romaneios_select_anon" on public.romaneios for select to anon using (true);
create policy "romaneios_insert_anon" on public.romaneios for insert to anon with check (true);
create policy "romaneios_update_anon" on public.romaneios for update to anon using (true);
create policy "romaneios_delete_anon" on public.romaneios for delete to anon using (true);

alter table public.romaneio_items enable row level security;
create policy "romaneio_items_select_anon" on public.romaneio_items for select to anon using (true);
create policy "romaneio_items_insert_anon" on public.romaneio_items for insert to anon with check (true);
create policy "romaneio_items_update_anon" on public.romaneio_items for update to anon using (true);
create policy "romaneio_items_delete_anon" on public.romaneio_items for delete to anon using (true);

alter table public.romaneio_expenses enable row level security;
create policy "romaneio_expenses_select_anon" on public.romaneio_expenses for select to anon using (true);
create policy "romaneio_expenses_insert_anon" on public.romaneio_expenses for insert to anon with check (true);
create policy "romaneio_expenses_update_anon" on public.romaneio_expenses for update to anon using (true);
create policy "romaneio_expenses_delete_anon" on public.romaneio_expenses for delete to anon using (true);
