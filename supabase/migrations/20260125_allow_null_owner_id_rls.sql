DO $$
BEGIN
  IF to_regclass('public.products') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS "products_select_owner" ON public.products';
    EXECUTE 'DROP POLICY IF EXISTS "products_update_owner" ON public.products';
    EXECUTE 'DROP POLICY IF EXISTS "products_delete_owner" ON public.products';
    EXECUTE 'CREATE POLICY "products_select_owner" ON public.products FOR SELECT TO authenticated USING (owner_id = auth.uid() OR owner_id IS NULL)';
    EXECUTE 'CREATE POLICY "products_update_owner" ON public.products FOR UPDATE TO authenticated USING (owner_id = auth.uid() OR owner_id IS NULL) WITH CHECK (owner_id = auth.uid())';
    EXECUTE 'CREATE POLICY "products_delete_owner" ON public.products FOR DELETE TO authenticated USING (owner_id = auth.uid() OR owner_id IS NULL)';
  END IF;

  IF to_regclass('public.observations') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS "observations_select_owner" ON public.observations';
    EXECUTE 'DROP POLICY IF EXISTS "observations_update_owner" ON public.observations';
    EXECUTE 'DROP POLICY IF EXISTS "observations_delete_owner" ON public.observations';
    EXECUTE 'CREATE POLICY "observations_select_owner" ON public.observations FOR SELECT TO authenticated USING (owner_id = auth.uid() OR owner_id IS NULL)';
    EXECUTE 'CREATE POLICY "observations_update_owner" ON public.observations FOR UPDATE TO authenticated USING (owner_id = auth.uid() OR owner_id IS NULL) WITH CHECK (owner_id = auth.uid())';
    EXECUTE 'CREATE POLICY "observations_delete_owner" ON public.observations FOR DELETE TO authenticated USING (owner_id = auth.uid() OR owner_id IS NULL)';
  END IF;

  IF to_regclass('public.companies') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS "companies_select_owner" ON public.companies';
    EXECUTE 'DROP POLICY IF EXISTS "companies_update_owner" ON public.companies';
    EXECUTE 'DROP POLICY IF EXISTS "companies_delete_owner" ON public.companies';
    EXECUTE 'CREATE POLICY "companies_select_owner" ON public.companies FOR SELECT TO authenticated USING (owner_id = auth.uid() OR owner_id IS NULL)';
    EXECUTE 'CREATE POLICY "companies_update_owner" ON public.companies FOR UPDATE TO authenticated USING (owner_id = auth.uid() OR owner_id IS NULL) WITH CHECK (owner_id = auth.uid())';
    EXECUTE 'CREATE POLICY "companies_delete_owner" ON public.companies FOR DELETE TO authenticated USING (owner_id = auth.uid() OR owner_id IS NULL)';
  END IF;

  IF to_regclass('public.customers') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS "customers_select_owner" ON public.customers';
    EXECUTE 'DROP POLICY IF EXISTS "customers_update_owner" ON public.customers';
    EXECUTE 'DROP POLICY IF EXISTS "customers_delete_owner" ON public.customers';
    EXECUTE 'CREATE POLICY "customers_select_owner" ON public.customers FOR SELECT TO authenticated USING (owner_id = auth.uid() OR owner_id IS NULL)';
    EXECUTE 'CREATE POLICY "customers_update_owner" ON public.customers FOR UPDATE TO authenticated USING (owner_id = auth.uid() OR owner_id IS NULL) WITH CHECK (owner_id = auth.uid())';
    EXECUTE 'CREATE POLICY "customers_delete_owner" ON public.customers FOR DELETE TO authenticated USING (owner_id = auth.uid() OR owner_id IS NULL)';
  END IF;

  IF to_regclass('public.expenses_stock') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS "expenses_stock_select_owner" ON public.expenses_stock';
    EXECUTE 'DROP POLICY IF EXISTS "expenses_stock_update_owner" ON public.expenses_stock';
    EXECUTE 'DROP POLICY IF EXISTS "expenses_stock_delete_owner" ON public.expenses_stock';
    EXECUTE 'CREATE POLICY "expenses_stock_select_owner" ON public.expenses_stock FOR SELECT TO authenticated USING (owner_id = auth.uid() OR owner_id IS NULL)';
    EXECUTE 'CREATE POLICY "expenses_stock_update_owner" ON public.expenses_stock FOR UPDATE TO authenticated USING (owner_id = auth.uid() OR owner_id IS NULL) WITH CHECK (owner_id = auth.uid())';
    EXECUTE 'CREATE POLICY "expenses_stock_delete_owner" ON public.expenses_stock FOR DELETE TO authenticated USING (owner_id = auth.uid() OR owner_id IS NULL)';
  END IF;

  IF to_regclass('public.despesas_estoque') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS "despesas_estoque_select_owner" ON public.despesas_estoque';
    EXECUTE 'DROP POLICY IF EXISTS "despesas_estoque_update_owner" ON public.despesas_estoque';
    EXECUTE 'DROP POLICY IF EXISTS "despesas_estoque_delete_owner" ON public.despesas_estoque';
    EXECUTE 'CREATE POLICY "despesas_estoque_select_owner" ON public.despesas_estoque FOR SELECT TO authenticated USING (owner_id = auth.uid() OR owner_id IS NULL)';
    EXECUTE 'CREATE POLICY "despesas_estoque_update_owner" ON public.despesas_estoque FOR UPDATE TO authenticated USING (owner_id = auth.uid() OR owner_id IS NULL) WITH CHECK (owner_id = auth.uid())';
    EXECUTE 'CREATE POLICY "despesas_estoque_delete_owner" ON public.despesas_estoque FOR DELETE TO authenticated USING (owner_id = auth.uid() OR owner_id IS NULL)';
  END IF;

  IF to_regclass('public.romaneios') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS "romaneios_select_owner" ON public.romaneios';
    EXECUTE 'DROP POLICY IF EXISTS "romaneios_update_owner" ON public.romaneios';
    EXECUTE 'DROP POLICY IF EXISTS "romaneios_delete_owner" ON public.romaneios';
    EXECUTE 'CREATE POLICY "romaneios_select_owner" ON public.romaneios FOR SELECT TO authenticated USING (owner_id = auth.uid() OR owner_id IS NULL)';
    EXECUTE 'CREATE POLICY "romaneios_update_owner" ON public.romaneios FOR UPDATE TO authenticated USING (owner_id = auth.uid() OR owner_id IS NULL) WITH CHECK (owner_id = auth.uid() AND (company_id IS NULL OR EXISTS (SELECT 1 FROM public.companies c WHERE c.id = company_id AND (c.owner_id = auth.uid() OR c.owner_id IS NULL))) AND (customer_id IS NULL OR EXISTS (SELECT 1 FROM public.customers cu WHERE cu.id = customer_id AND (cu.owner_id = auth.uid() OR cu.owner_id IS NULL))))';
    EXECUTE 'CREATE POLICY "romaneios_delete_owner" ON public.romaneios FOR DELETE TO authenticated USING (owner_id = auth.uid() OR owner_id IS NULL)';
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.romaneio_items') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS "romaneio_items_select_owner" ON public.romaneio_items';
    EXECUTE 'DROP POLICY IF EXISTS "romaneio_items_insert_owner" ON public.romaneio_items';
    EXECUTE 'DROP POLICY IF EXISTS "romaneio_items_update_owner" ON public.romaneio_items';
    EXECUTE 'DROP POLICY IF EXISTS "romaneio_items_delete_owner" ON public.romaneio_items';

    EXECUTE 'CREATE POLICY "romaneio_items_select_owner" ON public.romaneio_items FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.romaneios r WHERE r.id = romaneio_id AND (r.owner_id = auth.uid() OR r.owner_id IS NULL)))';
    EXECUTE 'CREATE POLICY "romaneio_items_insert_owner" ON public.romaneio_items FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.romaneios r WHERE r.id = romaneio_id AND (r.owner_id = auth.uid() OR r.owner_id IS NULL)))';
    EXECUTE 'CREATE POLICY "romaneio_items_update_owner" ON public.romaneio_items FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM public.romaneios r WHERE r.id = romaneio_id AND (r.owner_id = auth.uid() OR r.owner_id IS NULL))) WITH CHECK (EXISTS (SELECT 1 FROM public.romaneios r WHERE r.id = romaneio_id AND (r.owner_id = auth.uid() OR r.owner_id IS NULL)))';
    EXECUTE 'CREATE POLICY "romaneio_items_delete_owner" ON public.romaneio_items FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM public.romaneios r WHERE r.id = romaneio_id AND (r.owner_id = auth.uid() OR r.owner_id IS NULL)))';
  END IF;

  IF to_regclass('public.romaneio_expenses') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS "romaneio_expenses_select_owner" ON public.romaneio_expenses';
    EXECUTE 'DROP POLICY IF EXISTS "romaneio_expenses_insert_owner" ON public.romaneio_expenses';
    EXECUTE 'DROP POLICY IF EXISTS "romaneio_expenses_update_owner" ON public.romaneio_expenses';
    EXECUTE 'DROP POLICY IF EXISTS "romaneio_expenses_delete_owner" ON public.romaneio_expenses';

    EXECUTE 'CREATE POLICY "romaneio_expenses_select_owner" ON public.romaneio_expenses FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.romaneios r WHERE r.id = romaneio_id AND (r.owner_id = auth.uid() OR r.owner_id IS NULL)))';
    EXECUTE 'CREATE POLICY "romaneio_expenses_insert_owner" ON public.romaneio_expenses FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.romaneios r WHERE r.id = romaneio_id AND (r.owner_id = auth.uid() OR r.owner_id IS NULL)))';
    EXECUTE 'CREATE POLICY "romaneio_expenses_update_owner" ON public.romaneio_expenses FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM public.romaneios r WHERE r.id = romaneio_id AND (r.owner_id = auth.uid() OR r.owner_id IS NULL))) WITH CHECK (EXISTS (SELECT 1 FROM public.romaneios r WHERE r.id = romaneio_id AND (r.owner_id = auth.uid() OR r.owner_id IS NULL)))';
    EXECUTE 'CREATE POLICY "romaneio_expenses_delete_owner" ON public.romaneio_expenses FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM public.romaneios r WHERE r.id = romaneio_id AND (r.owner_id = auth.uid() OR r.owner_id IS NULL)))';
  END IF;
END $$;
