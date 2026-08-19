UPDATE public.practitioner_subscriptions ps
SET comped = true
FROM public.profiles p
WHERE p.id = ps.profile_id AND p.email = 'bynurseryan@outlook.com';