GRANT EXECUTE ON FUNCTION public.has_chapter_access(uuid, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_chapter_content(uuid) TO anon, authenticated;