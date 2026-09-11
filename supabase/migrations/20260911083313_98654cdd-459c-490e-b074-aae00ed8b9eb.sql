ALTER TABLE public.practitioners ADD COLUMN IF NOT EXISTS user_id uuid;
CREATE INDEX IF NOT EXISTS practitioners_user_id_idx ON public.practitioners (user_id);

-- Team members who already have a login and are linked to a practitioner card
UPDATE public.practitioners p
SET user_id = s.user_id
FROM public.staff_members s
WHERE s.practitioner_id = p.id
  AND s.user_id IS NOT NULL
  AND p.user_id IS NULL;

-- Solo clinics: the only practitioner is the clinic owner
UPDATE public.practitioners p
SET user_id = pr.user_id
FROM public.profiles pr
WHERE p.profile_id = pr.id
  AND pr.user_id IS NOT NULL
  AND p.user_id IS NULL
  AND (SELECT count(*) FROM public.practitioners x WHERE x.profile_id = p.profile_id) = 1;