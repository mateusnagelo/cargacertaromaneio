DO $$
BEGIN
  IF to_regclass('public.romaneios') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS "romaneios_select_owner" ON public.romaneios';
    EXECUTE 'DROP POLICY IF EXISTS "romaneios_update_owner" ON public.romaneios';
    EXECUTE 'DROP POLICY IF EXISTS "romaneios_delete_owner" ON public.romaneios';

    EXECUTE 'ALTER TABLE public.romaneios ENABLE ROW LEVEL SECURITY';

    EXECUTE 'CREATE POLICY "romaneios_select_owner" ON public.romaneios FOR SELECT TO authenticated USING (owner_id = auth.uid())';
    EXECUTE 'CREATE POLICY "romaneios_update_owner" ON public.romaneios FOR UPDATE TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid() AND (company_id IS NULL OR EXISTS (SELECT 1 FROM public.companies c WHERE c.id = company_id AND (c.owner_id = auth.uid() OR c.owner_id IS NULL))) AND (customer_id IS NULL OR EXISTS (SELECT 1 FROM public.customers cu WHERE cu.id = customer_id AND (cu.owner_id = auth.uid() OR cu.owner_id IS NULL))) AND (producer_id IS NULL OR EXISTS (SELECT 1 FROM public.producers p WHERE p.id = producer_id AND (p.owner_id = auth.uid() OR p.owner_id IS NULL))))';
    EXECUTE 'CREATE POLICY "romaneios_delete_owner" ON public.romaneios FOR DELETE TO authenticated USING (owner_id = auth.uid())';
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.romaneio_items') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS "romaneio_items_select_owner" ON public.romaneio_items';
    EXECUTE 'DROP POLICY IF EXISTS "romaneio_items_insert_owner" ON public.romaneio_items';
    EXECUTE 'DROP POLICY IF EXISTS "romaneio_items_update_owner" ON public.romaneio_items';
    EXECUTE 'DROP POLICY IF EXISTS "romaneio_items_delete_owner" ON public.romaneio_items';

    EXECUTE 'CREATE POLICY "romaneio_items_select_owner" ON public.romaneio_items FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.romaneios r WHERE r.id = romaneio_id AND r.owner_id = auth.uid()))';
    EXECUTE 'CREATE POLICY "romaneio_items_insert_owner" ON public.romaneio_items FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.romaneios r WHERE r.id = romaneio_id AND r.owner_id = auth.uid()))';
    EXECUTE 'CREATE POLICY "romaneio_items_update_owner" ON public.romaneio_items FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM public.romaneios r WHERE r.id = romaneio_id AND r.owner_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM public.romaneios r WHERE r.id = romaneio_id AND r.owner_id = auth.uid()))';
    EXECUTE 'CREATE POLICY "romaneio_items_delete_owner" ON public.romaneio_items FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM public.romaneios r WHERE r.id = romaneio_id AND r.owner_id = auth.uid()))';
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.romaneio_expenses') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS "romaneio_expenses_select_owner" ON public.romaneio_expenses';
    EXECUTE 'DROP POLICY IF EXISTS "romaneio_expenses_insert_owner" ON public.romaneio_expenses';
    EXECUTE 'DROP POLICY IF EXISTS "romaneio_expenses_update_owner" ON public.romaneio_expenses';
    EXECUTE 'DROP POLICY IF EXISTS "romaneio_expenses_delete_owner" ON public.romaneio_expenses';

    EXECUTE 'CREATE POLICY "romaneio_expenses_select_owner" ON public.romaneio_expenses FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.romaneios r WHERE r.id = romaneio_id AND r.owner_id = auth.uid()))';
    EXECUTE 'CREATE POLICY "romaneio_expenses_insert_owner" ON public.romaneio_expenses FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.romaneios r WHERE r.id = romaneio_id AND r.owner_id = auth.uid()))';
    EXECUTE 'CREATE POLICY "romaneio_expenses_update_owner" ON public.romaneio_expenses FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM public.romaneios r WHERE r.id = romaneio_id AND r.owner_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM public.romaneios r WHERE r.id = romaneio_id AND r.owner_id = auth.uid()))';
    EXECUTE 'CREATE POLICY "romaneio_expenses_delete_owner" ON public.romaneio_expenses FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM public.romaneios r WHERE r.id = romaneio_id AND r.owner_id = auth.uid()))';
  END IF;
END $$;
