DO $$
BEGIN
  IF to_regclass('public.producer_payments') IS NULL THEN
    EXECUTE '
      CREATE TABLE public.producer_payments (
        id uuid NOT NULL DEFAULT gen_random_uuid(),
        created_at timestamp with time zone NOT NULL DEFAULT now(),
        owner_id uuid DEFAULT auth.uid(),
        romaneio_id bigint NOT NULL,
        producer_id uuid NOT NULL,
        amount numeric NOT NULL,
        paid_at date NOT NULL,
        method text,
        reference text,
        note text,
        CONSTRAINT producer_payments_pkey PRIMARY KEY (id),
        CONSTRAINT producer_payments_romaneio_id_fkey FOREIGN KEY (romaneio_id) REFERENCES public.romaneios(id) ON DELETE CASCADE,
        CONSTRAINT producer_payments_producer_id_fkey FOREIGN KEY (producer_id) REFERENCES public.producers(id)
      )
    ';
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS producer_payments_owner_id_idx ON public.producer_payments(owner_id);
CREATE INDEX IF NOT EXISTS producer_payments_producer_id_idx ON public.producer_payments(producer_id);
CREATE INDEX IF NOT EXISTS producer_payments_romaneio_id_idx ON public.producer_payments(romaneio_id);
CREATE INDEX IF NOT EXISTS producer_payments_paid_at_idx ON public.producer_payments(paid_at);

ALTER TABLE public.producer_payments ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.producer_payments TO authenticated;
REVOKE SELECT, INSERT, UPDATE, DELETE ON TABLE public.producer_payments FROM anon;

DROP POLICY IF EXISTS "producer_payments_select_owner" ON public.producer_payments;
DROP POLICY IF EXISTS "producer_payments_insert_owner" ON public.producer_payments;
DROP POLICY IF EXISTS "producer_payments_update_owner" ON public.producer_payments;
DROP POLICY IF EXISTS "producer_payments_delete_owner" ON public.producer_payments;

CREATE POLICY "producer_payments_select_owner" ON public.producer_payments
  FOR SELECT TO authenticated
  USING (
    owner_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.romaneios r WHERE r.id = romaneio_id AND (r.owner_id = auth.uid() OR r.owner_id IS NULL))
  );

CREATE POLICY "producer_payments_insert_owner" ON public.producer_payments
  FOR INSERT TO authenticated
  WITH CHECK (
    owner_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.romaneios r WHERE r.id = romaneio_id AND (r.owner_id = auth.uid() OR r.owner_id IS NULL))
    AND EXISTS (SELECT 1 FROM public.producers p WHERE p.id = producer_id AND (p.owner_id = auth.uid() OR p.owner_id IS NULL))
  );

CREATE POLICY "producer_payments_update_owner" ON public.producer_payments
  FOR UPDATE TO authenticated
  USING (
    owner_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.romaneios r WHERE r.id = romaneio_id AND (r.owner_id = auth.uid() OR r.owner_id IS NULL))
  )
  WITH CHECK (
    owner_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.romaneios r WHERE r.id = romaneio_id AND (r.owner_id = auth.uid() OR r.owner_id IS NULL))
    AND EXISTS (SELECT 1 FROM public.producers p WHERE p.id = producer_id AND (p.owner_id = auth.uid() OR p.owner_id IS NULL))
  );

CREATE POLICY "producer_payments_delete_owner" ON public.producer_payments
  FOR DELETE TO authenticated
  USING (
    owner_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.romaneios r WHERE r.id = romaneio_id AND (r.owner_id = auth.uid() OR r.owner_id IS NULL))
  );
