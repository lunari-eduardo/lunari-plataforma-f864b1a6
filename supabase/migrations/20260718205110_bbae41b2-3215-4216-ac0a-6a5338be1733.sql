-- 1) Tabela
CREATE TABLE public.site_promotions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  subtitle text,
  badge_label text,
  target_plan_code text,
  target_credit_package_id uuid REFERENCES public.gallery_credit_packages(id) ON DELETE SET NULL,
  discount_type text NOT NULL DEFAULT 'percent' CHECK (discount_type IN ('percent','absolute','override')),
  discount_value_cents integer NOT NULL DEFAULT 0,
  starts_at timestamptz,
  ends_at timestamptz,
  is_active boolean NOT NULL DEFAULT false,
  show_on_home boolean NOT NULL DEFAULT true,
  show_on_pricing boolean NOT NULL DEFAULT true,
  cta_label text NOT NULL DEFAULT 'Aproveitar',
  cta_href text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2) GRANTs (obrigatório)
GRANT SELECT ON public.site_promotions TO anon;
GRANT SELECT ON public.site_promotions TO authenticated;
GRANT ALL    ON public.site_promotions TO service_role;

-- 3) RLS
ALTER TABLE public.site_promotions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public reads active promotions"
  ON public.site_promotions
  FOR SELECT
  TO anon, authenticated
  USING (
    is_active = true
    AND (starts_at IS NULL OR starts_at <= now())
    AND (ends_at   IS NULL OR ends_at   >  now())
  );

CREATE POLICY "Admins read all promotions"
  ON public.site_promotions
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins insert promotions"
  ON public.site_promotions
  FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins update promotions"
  ON public.site_promotions
  FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins delete promotions"
  ON public.site_promotions
  FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 4) Índices
CREATE INDEX idx_site_promotions_active_window
  ON public.site_promotions (is_active, starts_at, ends_at)
  WHERE is_active = true;

CREATE UNIQUE INDEX idx_site_promotions_unique_active_target
  ON public.site_promotions (COALESCE(target_plan_code,''), COALESCE(target_credit_package_id, '00000000-0000-0000-0000-000000000000'::uuid))
  WHERE is_active = true;

-- 5) Trigger updated_at (reusa função existente do projeto se houver; senão cria)
CREATE OR REPLACE FUNCTION public.set_site_promotions_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_site_promotions_updated_at
  BEFORE UPDATE ON public.site_promotions
  FOR EACH ROW
  EXECUTE FUNCTION public.set_site_promotions_updated_at();