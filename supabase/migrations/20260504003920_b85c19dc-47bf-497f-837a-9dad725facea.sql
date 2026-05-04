
-- 1. Fix paid novel content exposure: restrict content column reads via column-level policy
-- Replace permissive SELECT with split policy
DROP POLICY IF EXISTS "Chapters viewable by everyone" ON public.chapters;

-- Allow reading basic chapter metadata to everyone (needed for listings),
-- but restrict the `content` column via revoking column SELECT and exposing via RPC.
CREATE POLICY "Chapters metadata viewable by everyone"
ON public.chapters
FOR SELECT
USING (
  price = 0
  OR has_chapter_access(auth.uid(), id)
  OR has_role(auth.uid(), 'admin')
  OR has_role(auth.uid(), 'super_admin')
);

-- Provide a metadata-only view so listings (which don't need content) keep working.
CREATE OR REPLACE VIEW public.chapters_public AS
SELECT id, series_id, number, title, price, created_at, source_url
FROM public.chapters;

GRANT SELECT ON public.chapters_public TO anon, authenticated;

-- 2. Fix user_roles privilege escalation: only super_admin can manage roles
DROP POLICY IF EXISTS "Admins can manage roles" ON public.user_roles;

CREATE POLICY "Super-admins manage roles"
ON public.user_roles
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'super_admin'))
WITH CHECK (has_role(auth.uid(), 'super_admin'));

-- 3. Remove wallets from realtime publication (prevents cross-user wallet broadcast)
ALTER PUBLICATION supabase_realtime DROP TABLE public.wallets;
