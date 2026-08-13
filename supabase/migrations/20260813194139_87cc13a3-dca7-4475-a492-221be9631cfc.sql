INSERT INTO public.platform_terms_acceptances (user_id, terms_id, terms_version, context)
SELECT u.id, t.id, t.version, 'admin_backfill'
FROM auth.users u
CROSS JOIN public.platform_terms t
WHERE u.email = 've-aesthetics@outlook.com' AND t.is_active = true
  AND NOT EXISTS (
    SELECT 1 FROM public.platform_terms_acceptances a
    WHERE a.user_id = u.id AND a.terms_id = t.id
  );