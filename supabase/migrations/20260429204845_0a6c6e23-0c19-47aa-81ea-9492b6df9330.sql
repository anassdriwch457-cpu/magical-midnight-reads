-- Audit log for coin adjustments
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
$$;