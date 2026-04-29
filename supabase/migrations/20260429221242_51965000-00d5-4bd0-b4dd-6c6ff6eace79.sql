DROP FUNCTION IF EXISTS public.admin_list_users();

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