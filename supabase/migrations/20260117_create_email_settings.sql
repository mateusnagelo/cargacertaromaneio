DO $$
BEGIN
  IF to_regclass('public.email_settings') IS NULL THEN
    EXECUTE '
      CREATE TABLE public.email_settings (
        id uuid NOT NULL DEFAULT gen_random_uuid(),
        created_at timestamp with time zone NOT NULL DEFAULT now(),
        owner_id uuid NOT NULL DEFAULT auth.uid(),
        from_email text NOT NULL,
        smtp_server text NOT NULL,
        smtp_username text NOT NULL,
        smtp_password text NOT NULL,
        smtp_port integer NOT NULL,
        auth_type text NOT NULL,
        default_charset text,
        from_name text,
        ide_charset text,
        CONSTRAINT email_settings_pkey PRIMARY KEY (id),
        CONSTRAINT email_settings_auth_type_check CHECK (auth_type IN (''TLS'', ''SSL''))
      )
    ';

    EXECUTE 'CREATE UNIQUE INDEX email_settings_owner_uidx ON public.email_settings(owner_id)';
    EXECUTE 'ALTER TABLE public.email_settings ENABLE ROW LEVEL SECURITY';

    EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.email_settings TO authenticated';
    EXECUTE 'REVOKE SELECT, INSERT, UPDATE, DELETE ON TABLE public.email_settings FROM anon';

    EXECUTE 'CREATE POLICY "email_settings_select_owner" ON public.email_settings FOR SELECT TO authenticated USING (owner_id = auth.uid())';
    EXECUTE 'CREATE POLICY "email_settings_insert_owner" ON public.email_settings FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid())';
    EXECUTE 'CREATE POLICY "email_settings_update_owner" ON public.email_settings FOR UPDATE TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid())';
    EXECUTE 'CREATE POLICY "email_settings_delete_owner" ON public.email_settings FOR DELETE TO authenticated USING (owner_id = auth.uid())';
  END IF;
END $$;

