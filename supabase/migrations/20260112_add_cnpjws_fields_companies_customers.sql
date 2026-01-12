DO $$
BEGIN
  IF to_regclass('public.companies') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS "cnpj" text';
    EXECUTE 'ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS "ie" text';
    EXECUTE 'ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS "location" text';
    EXECUTE 'ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS "address" text';
    EXECUTE 'ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS "cep" text';
    EXECUTE 'ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS "tel" text';
    EXECUTE 'ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS "logoUrl" text';

    EXECUTE 'ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS "fantasyName" text';
    EXECUTE 'ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS "email" text';
    EXECUTE 'ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS "status" text';
    EXECUTE 'ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS "openingDate" text';
    EXECUTE 'ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS "legalNature" text';
    EXECUTE 'ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS "capitalSocial" numeric';
    EXECUTE 'ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS "cnaeMainCode" text';
    EXECUTE 'ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS "cnaeMainDescription" text';
    EXECUTE 'ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS "cnpjWsPayload" jsonb';
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.customers') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS "cnpj" text';
    EXECUTE 'ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS "ie" text';
    EXECUTE 'ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS "neighborhood" text';
    EXECUTE 'ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS "city" text';
    EXECUTE 'ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS "state" text';
    EXECUTE 'ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS "cep" text';
    EXECUTE 'ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS "tel" text';

    EXECUTE 'ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS "email" text';
    EXECUTE 'ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS "fantasyName" text';
    EXECUTE 'ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS "status" text';
    EXECUTE 'ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS "openingDate" text';
    EXECUTE 'ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS "legalNature" text';
    EXECUTE 'ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS "capitalSocial" numeric';
    EXECUTE 'ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS "cnaeMainCode" text';
    EXECUTE 'ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS "cnaeMainDescription" text';
    EXECUTE 'ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS "cnpjWsPayload" jsonb';
  END IF;
END $$;

