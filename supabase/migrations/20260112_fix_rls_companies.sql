DO $$
DECLARE
  pol record;
BEGIN
  FOR pol IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'companies'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.companies', pol.policyname);
  END LOOP;
END $$;

ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.companies TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.companies TO authenticated;

CREATE POLICY "companies_select_anon" ON public.companies
FOR SELECT TO anon
USING (true);

CREATE POLICY "companies_insert_anon" ON public.companies
FOR INSERT TO anon
WITH CHECK (true);

CREATE POLICY "companies_update_anon" ON public.companies
FOR UPDATE TO anon
USING (true)
WITH CHECK (true);

CREATE POLICY "companies_delete_anon" ON public.companies
FOR DELETE TO anon
USING (true);

CREATE POLICY "companies_select_authenticated" ON public.companies
FOR SELECT TO authenticated
USING (true);

CREATE POLICY "companies_insert_authenticated" ON public.companies
FOR INSERT TO authenticated
WITH CHECK (true);

CREATE POLICY "companies_update_authenticated" ON public.companies
FOR UPDATE TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "companies_delete_authenticated" ON public.companies
FOR DELETE TO authenticated
USING (true);
