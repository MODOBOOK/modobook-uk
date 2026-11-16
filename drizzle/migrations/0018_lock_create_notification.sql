REVOKE EXECUTE ON FUNCTION public.create_notification(uuid,text,text,text,text,text,uuid,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_notification(uuid,text,text,text,text,text,uuid,text) TO service_role;
REVOKE INSERT ON public.notifications FROM anon, authenticated;