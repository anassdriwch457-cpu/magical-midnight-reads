
REVOKE EXECUTE ON FUNCTION public.unlock_chapter(UUID) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.unlock_chapter(UUID) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.has_role(UUID, app_role) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.has_chapter_access(UUID, UUID) FROM anon, public;
