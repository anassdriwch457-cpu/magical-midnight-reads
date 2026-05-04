
-- Drop the previously created view (Security Definer View linter error)
DROP VIEW IF EXISTS public.chapters_public;

-- Restore permissive metadata SELECT so listings keep working
DROP POLICY IF EXISTS "Chapters metadata viewable by everyone" ON public.chapters;
CREATE POLICY "Chapters viewable by everyone"
ON public.chapters
FOR SELECT
USING (true);

-- Revoke direct access to the sensitive `content` column from public roles
REVOKE SELECT (content) ON public.chapters FROM anon, authenticated;

-- Provide a gated RPC to fetch chapter content only when the caller has access
CREATE OR REPLACE FUNCTION public.get_chapter_content(_chapter_id uuid)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _content text;
  _price int;
BEGIN
  SELECT price, content INTO _price, _content
  FROM public.chapters
  WHERE id = _chapter_id;

  IF _price IS NULL THEN
    RETURN NULL;
  END IF;

  IF _price = 0 OR public.has_chapter_access(auth.uid(), _chapter_id) THEN
    RETURN _content;
  END IF;

  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.get_chapter_content(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_chapter_content(uuid) TO anon, authenticated;
