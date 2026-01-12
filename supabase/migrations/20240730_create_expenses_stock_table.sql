CREATE TABLE public.expenses_stock (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    code text,
    description text,
    default_unit_value numeric,
    CONSTRAINT expenses_stock_pkey PRIMARY KEY (id)
);

-- Habilitar RLS para a nova tabela
ALTER TABLE public.expenses_stock ENABLE ROW LEVEL SECURITY;

-- Permitir leitura pública
CREATE POLICY "Allow public read access to expenses_stock"
ON public.expenses_stock
FOR SELECT
TO public
USING (true);

-- Permitir inserção pública
CREATE POLICY "Allow public insert to expenses_stock"
ON public.expenses_stock
FOR INSERT
TO public
WITH CHECK (true);

-- Permitir atualização pública
CREATE POLICY "Allow public update to expenses_stock"
ON public.expenses_stock
FOR UPDATE
TO public
USING (true);

-- Permitir exclusão pública
CREATE POLICY "Allow public delete to expenses_stock"
ON public.expenses_stock
FOR DELETE
TO public
USING (true);
