DO $$
BEGIN
  IF to_regclass('public.companies') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS banking jsonb';
  END IF;
END $$;
