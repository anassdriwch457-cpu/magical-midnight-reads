
-- Site settings (singleton row)
CREATE TABLE IF NOT EXISTS public.site_settings (
  id BOOLEAN PRIMARY KEY DEFAULT TRUE,
  site_name TEXT NOT NULL DEFAULT 'Nuvia Toon',
  seo_description TEXT NOT NULL DEFAULT 'Discover trending manhwa and novels with a magical reading experience.',
  hero_series_id UUID REFERENCES public.series(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT site_settings_singleton CHECK (id = TRUE)
);

INSERT INTO public.site_settings (id) VALUES (TRUE) ON CONFLICT DO NOTHING;

ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read site settings" ON public.site_settings;
CREATE POLICY "Anyone can read site settings"
  ON public.site_settings FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Staff can update site settings" ON public.site_settings;
CREATE POLICY "Staff can update site settings"
  ON public.site_settings FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'manager'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'manager'));

-- Mass price update
CREATE OR REPLACE FUNCTION public.admin_mass_update_chapter_price(_series_id UUID, _price INT)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _count INT;
BEGIN
  IF NOT (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'manager') OR public.has_role(auth.uid(), 'admin')) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient privileges');
  END IF;
  IF _price < 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Price must be >= 0');
  END IF;
  UPDATE public.chapters SET price = _price WHERE series_id = _series_id;
  GET DIAGNOSTICS _count = ROW_COUNT;
  RETURN jsonb_build_object('success', true, 'updated', _count);
END;
$$;

-- Bulk update flags on series
CREATE OR REPLACE FUNCTION public.admin_bulk_update_series_flags(
  _ids UUID[],
  _is_trending BOOLEAN DEFAULT NULL,
  _is_popular BOOLEAN DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _count INT;
BEGIN
  IF NOT (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'manager') OR public.has_role(auth.uid(), 'admin')) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient privileges');
  END IF;
  UPDATE public.series
  SET is_trending = COALESCE(_is_trending, is_trending),
      is_popular  = COALESCE(_is_popular, is_popular),
      updated_at  = now()
  WHERE id = ANY(_ids);
  GET DIAGNOSTICS _count = ROW_COUNT;
  RETURN jsonb_build_object('success', true, 'updated', _count);
END;
$$;
