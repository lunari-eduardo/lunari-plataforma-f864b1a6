ALTER TABLE public.categorias ALTER COLUMN cor DROP NOT NULL;
UPDATE public.categorias SET cor = NULL;