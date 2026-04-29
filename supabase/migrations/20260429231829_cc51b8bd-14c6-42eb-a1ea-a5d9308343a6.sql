CREATE TABLE IF NOT EXISTS public.coin_purchase_sessions (
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
EXECUTE FUNCTION public.set_coin_purchase_sessions_updated_at();