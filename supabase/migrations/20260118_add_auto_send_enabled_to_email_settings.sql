ALTER TABLE IF EXISTS public.email_settings
ADD COLUMN IF NOT EXISTS auto_send_enabled boolean NOT NULL DEFAULT true;

