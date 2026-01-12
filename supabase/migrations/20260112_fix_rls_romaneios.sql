-- Fix RLS policies for romaneios and related tables to allow app usage with anon/authenticated
-- Safe to run even if some tables don't exist yet.

DO $$
BEGIN
  IF to_regclass('public.romaneios') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.romaneios ENABLE ROW LEVEL SECURITY';

    EXECUTE 'DROP POLICY IF EXISTS "romaneios_select_anon" ON public.romaneios';
    EXECUTE 'DROP POLICY IF EXISTS "romaneios_insert_anon" ON public.romaneios';
    EXECUTE 'DROP POLICY IF EXISTS "romaneios_update_anon" ON public.romaneios';
    EXECUTE 'DROP POLICY IF EXISTS "romaneios_delete_anon" ON public.romaneios';
    EXECUTE 'DROP POLICY IF EXISTS "romaneios_select_authenticated" ON public.romaneios';
    EXECUTE 'DROP POLICY IF EXISTS "romaneios_insert_authenticated" ON public.romaneios';
    EXECUTE 'DROP POLICY IF EXISTS "romaneios_update_authenticated" ON public.romaneios';
    EXECUTE 'DROP POLICY IF EXISTS "romaneios_delete_authenticated" ON public.romaneios';

    EXECUTE 'CREATE POLICY "romaneios_select_anon" ON public.romaneios FOR SELECT TO anon USING (true)';
    EXECUTE 'CREATE POLICY "romaneios_insert_anon" ON public.romaneios FOR INSERT TO anon WITH CHECK (true)';
    EXECUTE 'CREATE POLICY "romaneios_update_anon" ON public.romaneios FOR UPDATE TO anon USING (true) WITH CHECK (true)';
    EXECUTE 'CREATE POLICY "romaneios_delete_anon" ON public.romaneios FOR DELETE TO anon USING (true)';

    EXECUTE 'CREATE POLICY "romaneios_select_authenticated" ON public.romaneios FOR SELECT TO authenticated USING (true)';
    EXECUTE 'CREATE POLICY "romaneios_insert_authenticated" ON public.romaneios FOR INSERT TO authenticated WITH CHECK (true)';
    EXECUTE 'CREATE POLICY "romaneios_update_authenticated" ON public.romaneios FOR UPDATE TO authenticated USING (true) WITH CHECK (true)';
    EXECUTE 'CREATE POLICY "romaneios_delete_authenticated" ON public.romaneios FOR DELETE TO authenticated USING (true)';
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.romaneio_items') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.romaneio_items ENABLE ROW LEVEL SECURITY';

    EXECUTE 'DROP POLICY IF EXISTS "romaneio_items_select_anon" ON public.romaneio_items';
    EXECUTE 'DROP POLICY IF EXISTS "romaneio_items_insert_anon" ON public.romaneio_items';
    EXECUTE 'DROP POLICY IF EXISTS "romaneio_items_update_anon" ON public.romaneio_items';
    EXECUTE 'DROP POLICY IF EXISTS "romaneio_items_delete_anon" ON public.romaneio_items';
    EXECUTE 'DROP POLICY IF EXISTS "romaneio_items_select_authenticated" ON public.romaneio_items';
    EXECUTE 'DROP POLICY IF EXISTS "romaneio_items_insert_authenticated" ON public.romaneio_items';
    EXECUTE 'DROP POLICY IF EXISTS "romaneio_items_update_authenticated" ON public.romaneio_items';
    EXECUTE 'DROP POLICY IF EXISTS "romaneio_items_delete_authenticated" ON public.romaneio_items';

    EXECUTE 'CREATE POLICY "romaneio_items_select_anon" ON public.romaneio_items FOR SELECT TO anon USING (true)';
    EXECUTE 'CREATE POLICY "romaneio_items_insert_anon" ON public.romaneio_items FOR INSERT TO anon WITH CHECK (true)';
    EXECUTE 'CREATE POLICY "romaneio_items_update_anon" ON public.romaneio_items FOR UPDATE TO anon USING (true) WITH CHECK (true)';
    EXECUTE 'CREATE POLICY "romaneio_items_delete_anon" ON public.romaneio_items FOR DELETE TO anon USING (true)';

    EXECUTE 'CREATE POLICY "romaneio_items_select_authenticated" ON public.romaneio_items FOR SELECT TO authenticated USING (true)';
    EXECUTE 'CREATE POLICY "romaneio_items_insert_authenticated" ON public.romaneio_items FOR INSERT TO authenticated WITH CHECK (true)';
    EXECUTE 'CREATE POLICY "romaneio_items_update_authenticated" ON public.romaneio_items FOR UPDATE TO authenticated USING (true) WITH CHECK (true)';
    EXECUTE 'CREATE POLICY "romaneio_items_delete_authenticated" ON public.romaneio_items FOR DELETE TO authenticated USING (true)';
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.romaneio_expenses') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.romaneio_expenses ENABLE ROW LEVEL SECURITY';

    EXECUTE 'DROP POLICY IF EXISTS "romaneio_expenses_select_anon" ON public.romaneio_expenses';
    EXECUTE 'DROP POLICY IF EXISTS "romaneio_expenses_insert_anon" ON public.romaneio_expenses';
    EXECUTE 'DROP POLICY IF EXISTS "romaneio_expenses_update_anon" ON public.romaneio_expenses';
    EXECUTE 'DROP POLICY IF EXISTS "romaneio_expenses_delete_anon" ON public.romaneio_expenses';
    EXECUTE 'DROP POLICY IF EXISTS "romaneio_expenses_select_authenticated" ON public.romaneio_expenses';
    EXECUTE 'DROP POLICY IF EXISTS "romaneio_expenses_insert_authenticated" ON public.romaneio_expenses';
    EXECUTE 'DROP POLICY IF EXISTS "romaneio_expenses_update_authenticated" ON public.romaneio_expenses';
    EXECUTE 'DROP POLICY IF EXISTS "romaneio_expenses_delete_authenticated" ON public.romaneio_expenses';

    EXECUTE 'CREATE POLICY "romaneio_expenses_select_anon" ON public.romaneio_expenses FOR SELECT TO anon USING (true)';
    EXECUTE 'CREATE POLICY "romaneio_expenses_insert_anon" ON public.romaneio_expenses FOR INSERT TO anon WITH CHECK (true)';
    EXECUTE 'CREATE POLICY "romaneio_expenses_update_anon" ON public.romaneio_expenses FOR UPDATE TO anon USING (true) WITH CHECK (true)';
    EXECUTE 'CREATE POLICY "romaneio_expenses_delete_anon" ON public.romaneio_expenses FOR DELETE TO anon USING (true)';

    EXECUTE 'CREATE POLICY "romaneio_expenses_select_authenticated" ON public.romaneio_expenses FOR SELECT TO authenticated USING (true)';
    EXECUTE 'CREATE POLICY "romaneio_expenses_insert_authenticated" ON public.romaneio_expenses FOR INSERT TO authenticated WITH CHECK (true)';
    EXECUTE 'CREATE POLICY "romaneio_expenses_update_authenticated" ON public.romaneio_expenses FOR UPDATE TO authenticated USING (true) WITH CHECK (true)';
    EXECUTE 'CREATE POLICY "romaneio_expenses_delete_authenticated" ON public.romaneio_expenses FOR DELETE TO authenticated USING (true)';
  END IF;
END $$;
