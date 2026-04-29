ALTER PUBLICATION supabase_realtime ADD TABLE public.wallets;
ALTER TABLE public.wallets REPLICA IDENTITY FULL;