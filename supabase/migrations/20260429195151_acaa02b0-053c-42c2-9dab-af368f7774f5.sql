
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
