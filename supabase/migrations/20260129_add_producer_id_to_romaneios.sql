DO $$
BEGIN
  IF to_regclass('public.romaneios') IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'romaneios' AND column_name = 'producer_id'
    ) THEN
      EXECUTE 'ALTER TABLE public.romaneios ADD COLUMN producer_id uuid';
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE conname = 'romaneios_producer_id_fkey' AND conrelid = 'public.romaneios'::regclass
    ) THEN
      EXECUTE 'ALTER TABLE public.romaneios ADD CONSTRAINT romaneios_producer_id_fkey FOREIGN KEY (producer_id) REFERENCES public.producers(id)';
    END IF;
  END IF;
END $$;

DO $$
DECLARE
  pol record;
BEGIN
  IF to_regclass('public.romaneios') IS NOT NULL THEN
    FOR pol IN
      SELECT policyname
      FROM pg_policies
      WHERE schemaname = 'public' AND tablename = 'romaneios'
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.romaneios', pol.policyname);
    END LOOP;

    EXECUTE 'ALTER TABLE public.romaneios ENABLE ROW LEVEL SECURITY';

    EXECUTE 'CREATE POLICY "romaneios_select_owner" ON public.romaneios FOR SELECT TO authenticated USING (owner_id = auth.uid() OR owner_id IS NULL)';
    EXECUTE 'CREATE POLICY "romaneios_insert_owner" ON public.romaneios FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid() AND (company_id IS NULL OR EXISTS (SELECT 1 FROM public.companies c WHERE c.id = company_id AND (c.owner_id = auth.uid() OR c.owner_id IS NULL))) AND (customer_id IS NULL OR EXISTS (SELECT 1 FROM public.customers cu WHERE cu.id = customer_id AND (cu.owner_id = auth.uid() OR cu.owner_id IS NULL))) AND (producer_id IS NULL OR EXISTS (SELECT 1 FROM public.producers p WHERE p.id = producer_id AND (p.owner_id = auth.uid() OR p.owner_id IS NULL))))';
    EXECUTE 'CREATE POLICY "romaneios_update_owner" ON public.romaneios FOR UPDATE TO authenticated USING (owner_id = auth.uid() OR owner_id IS NULL) WITH CHECK (owner_id = auth.uid() AND (company_id IS NULL OR EXISTS (SELECT 1 FROM public.companies c WHERE c.id = company_id AND (c.owner_id = auth.uid() OR c.owner_id IS NULL))) AND (customer_id IS NULL OR EXISTS (SELECT 1 FROM public.customers cu WHERE cu.id = customer_id AND (cu.owner_id = auth.uid() OR cu.owner_id IS NULL))) AND (producer_id IS NULL OR EXISTS (SELECT 1 FROM public.producers p WHERE p.id = producer_id AND (p.owner_id = auth.uid() OR p.owner_id IS NULL))))';
    EXECUTE 'CREATE POLICY "romaneios_delete_owner" ON public.romaneios FOR DELETE TO authenticated USING (owner_id = auth.uid() OR owner_id IS NULL)';
  END IF;
END $$;
