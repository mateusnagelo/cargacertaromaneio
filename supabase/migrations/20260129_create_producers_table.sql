DO $$
BEGIN
  IF to_regclass('public.producers') IS NULL THEN
    EXECUTE '
      CREATE TABLE public.producers (
        id uuid NOT NULL DEFAULT gen_random_uuid(),
        created_at timestamp with time zone NOT NULL DEFAULT now(),
        owner_id uuid DEFAULT auth.uid(),
        name text,
        cnpj text,
        document text,
        address text,
        ie text,
        neighborhood text,
        city text,
        state text,
        role text DEFAULT ''PRODUTOR_RURAL'',
        cep text,
        tel text,
        email text,
        "fantasyName" text,
        status text,
        "openingDate" text,
        "legalNature" text,
        "capitalSocial" numeric,
        "cnaeMainCode" text,
        "cnaeMainDescription" text,
        "cnpjWsPayload" jsonb,
        CONSTRAINT producers_pkey PRIMARY KEY (id)
      )
    ';
  END IF;
END $$;

ALTER TABLE public.producers ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.producers TO authenticated;
REVOKE SELECT, INSERT, UPDATE, DELETE ON TABLE public.producers FROM anon;

DROP POLICY IF EXISTS "producers_select_owner" ON public.producers;
DROP POLICY IF EXISTS "producers_insert_owner" ON public.producers;
DROP POLICY IF EXISTS "producers_update_owner" ON public.producers;
DROP POLICY IF EXISTS "producers_delete_owner" ON public.producers;

CREATE POLICY "producers_select_owner" ON public.producers
  FOR SELECT TO authenticated
  USING (owner_id = auth.uid() OR owner_id IS NULL);

CREATE POLICY "producers_insert_owner" ON public.producers
  FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "producers_update_owner" ON public.producers
  FOR UPDATE TO authenticated
  USING (owner_id = auth.uid() OR owner_id IS NULL)
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "producers_delete_owner" ON public.producers
  FOR DELETE TO authenticated
  USING (owner_id = auth.uid() OR owner_id IS NULL);
