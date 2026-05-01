
-- =========================
-- ENUMS
-- =========================
CREATE TYPE public.app_role AS ENUM ('admin', 'user');
CREATE TYPE public.series_type AS ENUM ('manga', 'novel');
CREATE TYPE public.series_status AS ENUM ('ongoing', 'completed', 'hiatus');

-- =========================
-- PROFILES
-- =========================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Profiles are viewable by everyone" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- =========================
-- USER ROLES (separate table for security)
-- =========================
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can manage roles" ON public.user_roles FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- =========================
-- WALLETS
-- =========================
CREATE TABLE public.wallets (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  coins INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own wallet" ON public.wallets FOR SELECT USING (auth.uid() = user_id);

-- =========================
-- SERIES
-- =========================
CREATE TABLE public.series (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  cover_url TEXT,
  banner_url TEXT,
  type series_type NOT NULL DEFAULT 'manga',
  status series_status NOT NULL DEFAULT 'ongoing',
  genres TEXT[] NOT NULL DEFAULT '{}',
  author TEXT,
  is_trending BOOLEAN NOT NULL DEFAULT false,
  is_popular BOOLEAN NOT NULL DEFAULT false,
  views INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.series ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Series viewable by everyone" ON public.series FOR SELECT USING (true);
CREATE POLICY "Admins manage series" ON public.series FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE INDEX idx_series_type ON public.series(type);
CREATE INDEX idx_series_status ON public.series(status);
CREATE INDEX idx_series_created ON public.series(created_at DESC);

-- =========================
-- CHAPTERS
-- =========================
CREATE TABLE public.chapters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  series_id UUID NOT NULL REFERENCES public.series(id) ON DELETE CASCADE,
  number NUMERIC(8,2) NOT NULL,
  title TEXT,
  price INT NOT NULL DEFAULT 0,
  content TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (series_id, number)
);
ALTER TABLE public.chapters ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Chapters viewable by everyone" ON public.chapters FOR SELECT USING (true);
CREATE POLICY "Admins manage chapters" ON public.chapters FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE INDEX idx_chapters_series ON public.chapters(series_id, number);

-- =========================
-- CHAPTER UNLOCKS (must be defined before chapter_pages policy)
-- =========================
CREATE TABLE public.chapter_unlocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  chapter_id UUID NOT NULL REFERENCES public.chapters(id) ON DELETE CASCADE,
  coins_spent INT NOT NULL DEFAULT 0,
  unlocked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, chapter_id)
);
ALTER TABLE public.chapter_unlocks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own unlocks" ON public.chapter_unlocks FOR SELECT USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.has_chapter_access(_user_id UUID, _chapter_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.chapters c WHERE c.id = _chapter_id AND c.price = 0
  ) OR EXISTS (
    SELECT 1 FROM public.chapter_unlocks WHERE user_id = _user_id AND chapter_id = _chapter_id
  ) OR public.has_role(_user_id, 'admin')
$$;

-- =========================
-- CHAPTER PAGES (manga images)
-- =========================
CREATE TABLE public.chapter_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chapter_id UUID NOT NULL REFERENCES public.chapters(id) ON DELETE CASCADE,
  page_number INT NOT NULL,
  image_url TEXT NOT NULL,
  UNIQUE (chapter_id, page_number)
);
ALTER TABLE public.chapter_pages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Pages visible if user has access" ON public.chapter_pages FOR SELECT
  USING (public.has_chapter_access(auth.uid(), chapter_id));
CREATE POLICY "Admins manage pages" ON public.chapter_pages FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE INDEX idx_chapter_pages ON public.chapter_pages(chapter_id, page_number);

-- =========================
-- SECURE UNLOCK FUNCTION (atomic coin deduction)
-- =========================
CREATE OR REPLACE FUNCTION public.unlock_chapter(_chapter_id UUID)
RETURNS JSONB LANGUAGE PLPGSQL SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _user UUID := auth.uid();
  _price INT;
  _balance INT;
BEGIN
  IF _user IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  SELECT price INTO _price FROM public.chapters WHERE id = _chapter_id;
  IF _price IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Chapter not found');
  END IF;

  IF EXISTS (SELECT 1 FROM public.chapter_unlocks WHERE user_id = _user AND chapter_id = _chapter_id) THEN
    RETURN jsonb_build_object('success', true, 'message', 'Already unlocked');
  END IF;

  IF _price = 0 THEN
    RETURN jsonb_build_object('success', true, 'message', 'Free chapter');
  END IF;

  -- Lock wallet row & check balance
  SELECT coins INTO _balance FROM public.wallets WHERE user_id = _user FOR UPDATE;
  IF _balance IS NULL THEN
    INSERT INTO public.wallets(user_id, coins) VALUES (_user, 0);
    _balance := 0;
  END IF;

  IF _balance < _price THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient coins', 'balance', _balance, 'price', _price);
  END IF;

  UPDATE public.wallets SET coins = coins - _price, updated_at = now() WHERE user_id = _user;
  INSERT INTO public.chapter_unlocks(user_id, chapter_id, coins_spent) VALUES (_user, _chapter_id, _price);

  RETURN jsonb_build_object('success', true, 'balance', _balance - _price);
END;
$$;

-- =========================
-- TRIGGER: auto-create profile + wallet on signup
-- =========================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE PLPGSQL SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)));
  INSERT INTO public.wallets (user_id, coins) VALUES (NEW.id, 0);
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user');
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =========================
-- STORAGE: chapter-images bucket (public)
-- =========================
INSERT INTO storage.buckets (id, name, public) VALUES ('chapter-images', 'chapter-images', true);

CREATE POLICY "Chapter images publicly readable" ON storage.objects FOR SELECT USING (bucket_id = 'chapter-images');
CREATE POLICY "Admins upload chapter images" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'chapter-images' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update chapter images" ON storage.objects FOR UPDATE
  USING (bucket_id = 'chapter-images' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete chapter images" ON storage.objects FOR DELETE
  USING (bucket_id = 'chapter-images' AND public.has_role(auth.uid(), 'admin'));

REVOKE EXECUTE ON FUNCTION public.unlock_chapter(UUID) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.unlock_chapter(UUID) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.has_role(UUID, app_role) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.has_chapter_access(UUID, UUID) FROM anon, public;
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'super_admin';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'manager';-- Audit log for coin adjustments
CREATE TABLE IF NOT EXISTS public.coin_adjustments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target_user_id UUID NOT NULL,
  actor_user_id UUID NOT NULL,
  delta INT NOT NULL,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.coin_adjustments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff view coin adjustments" ON public.coin_adjustments;
CREATE POLICY "Staff view coin adjustments" ON public.coin_adjustments
  FOR SELECT TO authenticated USING (
    public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'manager')
  );

-- Allow super_admin to also manage content (admin already covered)
DROP POLICY IF EXISTS "Admins manage series" ON public.series;
CREATE POLICY "Admins manage series" ON public.series FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

DROP POLICY IF EXISTS "Admins manage chapters" ON public.chapters;
CREATE POLICY "Admins manage chapters" ON public.chapters FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

DROP POLICY IF EXISTS "Admins manage pages" ON public.chapter_pages;
CREATE POLICY "Admins manage pages" ON public.chapter_pages FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

-- Adjust coins
CREATE OR REPLACE FUNCTION public.adjust_user_coins(_target UUID, _delta INT, _reason TEXT DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _actor UUID := auth.uid();
  _new_balance INT;
BEGIN
  IF _actor IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;
  IF NOT (public.has_role(_actor, 'super_admin') OR public.has_role(_actor, 'manager')) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient privileges');
  END IF;

  INSERT INTO public.wallets (user_id, coins)
  VALUES (_target, GREATEST(0, _delta))
  ON CONFLICT (user_id) DO UPDATE
    SET coins = GREATEST(0, public.wallets.coins + _delta), updated_at = now()
  RETURNING coins INTO _new_balance;

  INSERT INTO public.coin_adjustments(target_user_id, actor_user_id, delta, reason)
    VALUES (_target, _actor, _delta, _reason);

  RETURN jsonb_build_object('success', true, 'balance', _new_balance);
END;
$$;

-- Need unique constraint on wallets for ON CONFLICT
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'wallets_user_id_key'
  ) THEN
    ALTER TABLE public.wallets ADD CONSTRAINT wallets_user_id_key UNIQUE (user_id);
  END IF;
END $$;

-- List all users (staff only)
CREATE OR REPLACE FUNCTION public.admin_list_users()
RETURNS TABLE (
  id UUID,
  email TEXT,
  display_name TEXT,
  coins INT,
  created_at TIMESTAMPTZ,
  roles TEXT[]
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'manager')) THEN
    RAISE EXCEPTION 'Insufficient privileges';
  END IF;

  RETURN QUERY
  SELECT
    u.id,
    u.email::TEXT,
    p.display_name,
    COALESCE(w.coins, 0) AS coins,
    u.created_at,
    COALESCE(ARRAY_AGG(r.role::TEXT) FILTER (WHERE r.role IS NOT NULL), ARRAY[]::TEXT[]) AS roles
  FROM auth.users u
  LEFT JOIN public.profiles p ON p.id = u.id
  LEFT JOIN public.wallets w ON w.user_id = u.id
  LEFT JOIN public.user_roles r ON r.user_id = u.id
  GROUP BY u.id, u.email, p.display_name, w.coins, u.created_at
  ORDER BY u.created_at DESC;
END;
$$;

-- Set or remove a role (super_admin only)
CREATE OR REPLACE FUNCTION public.admin_set_user_role(_target UUID, _role app_role, _grant BOOLEAN)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'super_admin') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Super-admin required');
  END IF;
  IF _grant THEN
    INSERT INTO public.user_roles(user_id, role) VALUES (_target, _role)
      ON CONFLICT (user_id, role) DO NOTHING;
  ELSE
    DELETE FROM public.user_roles WHERE user_id = _target AND role = _role;
  END IF;
  RETURN jsonb_build_object('success', true);
END;
$$;

-- Total coins spent
CREATE OR REPLACE FUNCTION public.admin_total_sales()
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE _t BIGINT;
BEGIN
  IF NOT (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'manager')) THEN
    RAISE EXCEPTION 'Insufficient privileges';
  END IF;
  SELECT COALESCE(SUM(coins_spent),0) INTO _t FROM public.chapter_unlocks;
  RETURN _t;
END;
$$;

-- Top series
CREATE OR REPLACE FUNCTION public.admin_top_series(_limit INT DEFAULT 10)
RETURNS TABLE (
  series_id UUID,
  title TEXT,
  cover_url TEXT,
  unlocks BIGINT,
  revenue BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
BEGIN
  IF NOT (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'manager')) THEN
    RAISE EXCEPTION 'Insufficient privileges';
  END IF;
  RETURN QUERY
  SELECT s.id, s.title, s.cover_url,
         COUNT(u.id)::BIGINT AS unlocks,
         COALESCE(SUM(u.coins_spent),0)::BIGINT AS revenue
  FROM public.series s
  LEFT JOIN public.chapters c ON c.series_id = s.id
  LEFT JOIN public.chapter_unlocks u ON u.chapter_id = c.id
  GROUP BY s.id, s.title, s.cover_url
  ORDER BY unlocks DESC, revenue DESC
  LIMIT _limit;
END;
$$;

-- User growth per day
CREATE OR REPLACE FUNCTION public.admin_user_growth(_days INT DEFAULT 30)
RETURNS TABLE (day DATE, signups BIGINT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
BEGIN
  IF NOT (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'manager')) THEN
    RAISE EXCEPTION 'Insufficient privileges';
  END IF;
  RETURN QUERY
  SELECT d::DATE AS day,
         COALESCE(COUNT(u.id),0)::BIGINT AS signups
  FROM generate_series(CURRENT_DATE - (_days - 1), CURRENT_DATE, '1 day') d
  LEFT JOIN auth.users u ON u.created_at::DATE = d::DATE
  GROUP BY d
  ORDER BY d;
END;
$$;REVOKE EXECUTE ON FUNCTION public.adjust_user_coins(UUID, INT, TEXT) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_list_users() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_set_user_role(UUID, app_role, BOOLEAN) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_total_sales() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_top_series(INT) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_user_growth(INT) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.adjust_user_coins(UUID, INT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_users() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_user_role(UUID, app_role, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_total_sales() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_top_series(INT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_user_growth(INT) TO authenticated;NOTIFY pgrst, 'reload schema';DROP FUNCTION IF EXISTS public.admin_list_users();

CREATE OR REPLACE FUNCTION public.admin_revenue_daily(_days integer DEFAULT 30)
RETURNS TABLE(day date, revenue bigint, unlocks bigint)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'manager')) THEN
    RAISE EXCEPTION 'Insufficient privileges';
  END IF;
  RETURN QUERY
  SELECT d::DATE AS day,
         COALESCE(SUM(u.coins_spent), 0)::BIGINT AS revenue,
         COALESCE(COUNT(u.id), 0)::BIGINT AS unlocks
  FROM generate_series(CURRENT_DATE - (_days - 1), CURRENT_DATE, '1 day') d
  LEFT JOIN public.chapter_unlocks u ON u.unlocked_at::DATE = d::DATE
  GROUP BY d
  ORDER BY d;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_list_users()
RETURNS TABLE(id uuid, email text, display_name text, coins integer, created_at timestamp with time zone, roles text[], banned_until timestamp with time zone)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'manager')) THEN
    RAISE EXCEPTION 'Insufficient privileges';
  END IF;

  RETURN QUERY
  SELECT
    u.id,
    u.email::TEXT,
    p.display_name,
    COALESCE(w.coins, 0) AS coins,
    u.created_at,
    COALESCE(ARRAY_AGG(r.role::TEXT) FILTER (WHERE r.role IS NOT NULL), ARRAY[]::TEXT[]) AS roles,
    u.banned_until
  FROM auth.users u
  LEFT JOIN public.profiles p ON p.id = u.id
  LEFT JOIN public.wallets w ON w.user_id = u.id
  LEFT JOIN public.user_roles r ON r.user_id = u.id
  GROUP BY u.id, u.email, p.display_name, w.coins, u.created_at, u.banned_until
  ORDER BY u.created_at DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_finance_log(_limit integer DEFAULT 100)
RETURNS TABLE(occurred_at timestamp with time zone, kind text, user_id uuid, user_email text, amount integer, note text)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'manager')) THEN
    RAISE EXCEPTION 'Insufficient privileges';
  END IF;
  RETURN QUERY
  (
    SELECT cu.unlocked_at AS occurred_at,
           'unlock'::TEXT AS kind,
           cu.user_id,
           u.email::TEXT AS user_email,
           (-cu.coins_spent)::INT AS amount,
           ('Chapter ' || c.number::TEXT || ' · ' || COALESCE(s.title, 'Unknown')) AS note
    FROM public.chapter_unlocks cu
    LEFT JOIN auth.users u ON u.id = cu.user_id
    LEFT JOIN public.chapters c ON c.id = cu.chapter_id
    LEFT JOIN public.series s ON s.id = c.series_id
  )
  UNION ALL
  (
    SELECT ca.created_at AS occurred_at,
           'adjustment'::TEXT AS kind,
           ca.target_user_id AS user_id,
           u.email::TEXT AS user_email,
           ca.delta AS amount,
           COALESCE(ca.reason, 'Admin adjustment') AS note
    FROM public.coin_adjustments ca
    LEFT JOIN auth.users u ON u.id = ca.target_user_id
  )
  ORDER BY occurred_at DESC
  LIMIT _limit;
END;
$$;
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

UPDATE public.series
SET cover_url = 'https://rjwdxbnsnrahvogcyxld.supabase.co/storage/v1/object/public/chapter-images/seed/' || regexp_replace(cover_url, '^/src/assets/', '')
WHERE cover_url LIKE '/src/assets/%';

UPDATE public.series
SET banner_url = 'https://rjwdxbnsnrahvogcyxld.supabase.co/storage/v1/object/public/chapter-images/seed/' || regexp_replace(banner_url, '^/src/assets/', '')
WHERE banner_url LIKE '/src/assets/%';
-- Allow super_admin (and manager) to upload/update/delete chapter images,
-- not only the 'admin' uploader role.
DROP POLICY IF EXISTS "Admins upload chapter images" ON storage.objects;
DROP POLICY IF EXISTS "Admins update chapter images" ON storage.objects;
DROP POLICY IF EXISTS "Admins delete chapter images" ON storage.objects;

CREATE POLICY "Staff upload chapter images"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'chapter-images' AND (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
    OR public.has_role(auth.uid(), 'manager'::public.app_role)
  )
);

CREATE POLICY "Staff update chapter images"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'chapter-images' AND (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
    OR public.has_role(auth.uid(), 'manager'::public.app_role)
  )
);

CREATE POLICY "Staff delete chapter images"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'chapter-images' AND (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
    OR public.has_role(auth.uid(), 'manager'::public.app_role)
  )
);ALTER PUBLICATION supabase_realtime ADD TABLE public.wallets;
ALTER TABLE public.wallets REPLICA IDENTITY FULL;CREATE TABLE IF NOT EXISTS public.coin_purchase_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  package_id TEXT NOT NULL,
  stripe_session_id TEXT NOT NULL UNIQUE,
  stripe_payment_status TEXT NOT NULL DEFAULT 'unpaid',
  amount_total INT,
  currency TEXT,
  credited_coins INT NOT NULL DEFAULT 0,
  credited_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.coin_purchase_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own coin purchase sessions" ON public.coin_purchase_sessions;
CREATE POLICY "Users view own coin purchase sessions"
ON public.coin_purchase_sessions
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_coin_purchase_sessions_user_id_created_at
  ON public.coin_purchase_sessions(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_coin_purchase_sessions_session_id
  ON public.coin_purchase_sessions(stripe_session_id);

CREATE OR REPLACE FUNCTION public.set_coin_purchase_sessions_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_coin_purchase_sessions_updated_at ON public.coin_purchase_sessions;
CREATE TRIGGER set_coin_purchase_sessions_updated_at
BEFORE UPDATE ON public.coin_purchase_sessions
FOR EACH ROW
EXECUTE FUNCTION public.set_coin_purchase_sessions_updated_at();-- Import jobs tracker
CREATE TABLE public.import_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_url TEXT NOT NULL,
  source_site TEXT NOT NULL,
  series_id UUID REFERENCES public.series(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  total_chapters INT NOT NULL DEFAULT 0,
  completed_chapters INT NOT NULL DEFAULT 0,
  current_chapter TEXT,
  error TEXT,
  logs TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_import_jobs_created_at ON public.import_jobs(created_at DESC);
CREATE INDEX idx_import_jobs_status ON public.import_jobs(status);

ALTER TABLE public.import_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage import jobs"
ON public.import_jobs
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'manager'))
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'manager'));

-- Source URL on series/chapters for dedupe + traceability
ALTER TABLE public.series ADD COLUMN IF NOT EXISTS source_url TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_series_source_url ON public.series(source_url) WHERE source_url IS NOT NULL;

ALTER TABLE public.chapters ADD COLUMN IF NOT EXISTS source_url TEXT;
CREATE INDEX IF NOT EXISTS idx_chapters_source_url ON public.chapters(source_url);

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.set_import_jobs_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER trg_import_jobs_updated_at
BEFORE UPDATE ON public.import_jobs
FOR EACH ROW EXECUTE FUNCTION public.set_import_jobs_updated_at();