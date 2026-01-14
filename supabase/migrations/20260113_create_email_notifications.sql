DO $$
BEGIN
  IF to_regclass('public.email_notifications') IS NULL THEN
    EXECUTE '
      CREATE TABLE public.email_notifications (
        id uuid NOT NULL DEFAULT gen_random_uuid(),
        created_at timestamp with time zone NOT NULL DEFAULT now(),
        owner_id uuid NOT NULL,
        romaneio_id text NOT NULL,
        type text NOT NULL,
        event_key text NOT NULL,
        to_email text,
        subject text,
        provider text,
        provider_message_id text,
        metadata jsonb,
        CONSTRAINT email_notifications_pkey PRIMARY KEY (id)
      )
    ';

    EXECUTE 'CREATE UNIQUE INDEX email_notifications_event_key_uidx ON public.email_notifications(event_key)';
    EXECUTE 'CREATE INDEX email_notifications_owner_idx ON public.email_notifications(owner_id)';
    EXECUTE 'ALTER TABLE public.email_notifications ENABLE ROW LEVEL SECURITY';

    EXECUTE 'GRANT SELECT, INSERT ON TABLE public.email_notifications TO authenticated';

    EXECUTE 'CREATE POLICY "email_notifications_select_owner" ON public.email_notifications FOR SELECT TO authenticated USING (owner_id = auth.uid())';
    EXECUTE 'CREATE POLICY "email_notifications_insert_owner" ON public.email_notifications FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid())';
  END IF;
END $$;

