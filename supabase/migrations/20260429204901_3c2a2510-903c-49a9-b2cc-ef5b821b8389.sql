REVOKE EXECUTE ON FUNCTION public.adjust_user_coins(UUID, INT, TEXT) FROM PUBLIC, anon;
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
GRANT EXECUTE ON FUNCTION public.admin_user_growth(INT) TO authenticated;