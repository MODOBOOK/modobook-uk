-- Staff rows can now exist before an email is known (converted practitioners).
ALTER TABLE public.staff_members ALTER COLUMN invited_email DROP NOT NULL;

-- Convert every existing practitioner record into a staff member with the
-- Practitioner role, unless one is already linked to that practitioner.
INSERT INTO public.staff_members (profile_id, name, role, data_scope, practitioner_id, status)
SELECT p.profile_id, p.name, 'practitioner'::public.staff_role, 'own'::public.staff_scope, p.id,
       CASE WHEN p.active THEN 'invited'::public.staff_status ELSE 'disabled'::public.staff_status END
FROM public.practitioners p
WHERE NOT EXISTS (
  SELECT 1 FROM public.staff_members s WHERE s.practitioner_id = p.id
);

-- How many treating staff a clinic has (drives the per-seat charge).
CREATE OR REPLACE FUNCTION public.treating_staff_count(_profile_id UUID)
RETURNS INTEGER
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COUNT(*)::int
  FROM public.staff_members
  WHERE profile_id = _profile_id
    AND role = 'practitioner'
    AND status IN ('invited', 'active');
$$;

REVOKE EXECUTE ON FUNCTION public.treating_staff_count(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.treating_staff_count(UUID) TO authenticated, service_role;
