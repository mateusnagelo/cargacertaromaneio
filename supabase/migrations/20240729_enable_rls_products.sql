-- 1. Habilitar RLS para a tabela 'products'
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

-- 2. Remover políticas antigas (se existirem) para evitar conflitos
DROP POLICY IF EXISTS "Allow public read access to products" ON public.products;
DROP POLICY IF EXISTS "products_select_anon" ON public.products;
DROP POLICY IF EXISTS "products_insert_anon" ON public.products;
DROP POLICY IF EXISTS "products_update_anon" ON public.products;
DROP POLICY IF EXISTS "products_delete_anon" ON public.products;

DROP POLICY IF EXISTS "products_select_authenticated" ON public.products;
DROP POLICY IF EXISTS "products_insert_authenticated" ON public.products;
DROP POLICY IF EXISTS "products_update_authenticated" ON public.products;
DROP POLICY IF EXISTS "products_delete_authenticated" ON public.products;

-- 3. Criar uma nova política para permitir a leitura pública
CREATE POLICY "products_select_anon" ON public.products FOR SELECT TO anon USING (true);
CREATE POLICY "products_insert_anon" ON public.products FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "products_update_anon" ON public.products FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "products_delete_anon" ON public.products FOR DELETE TO anon USING (true);

CREATE POLICY "products_select_authenticated" ON public.products FOR SELECT TO authenticated USING (true);
CREATE POLICY "products_insert_authenticated" ON public.products FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "products_update_authenticated" ON public.products FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "products_delete_authenticated" ON public.products FOR DELETE TO authenticated USING (true);
