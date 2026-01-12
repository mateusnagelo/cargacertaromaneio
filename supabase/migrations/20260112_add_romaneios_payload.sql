DO $$
BEGIN
  IF to_regclass('public.romaneios') IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'romaneios'
        AND column_name = 'payload'
    ) THEN
      EXECUTE 'ALTER TABLE public.romaneios ADD COLUMN payload jsonb';
    END IF;
  END IF;
END $$;
