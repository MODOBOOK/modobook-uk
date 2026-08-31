INSERT INTO public.appointment_reminder_rules (profile_id, hours_before, enabled)
SELECT p.id, 24, true
FROM public.profiles p
WHERE NOT EXISTS (
  SELECT 1 FROM public.appointment_reminder_rules r WHERE r.profile_id = p.id
);

CREATE OR REPLACE FUNCTION public.add_default_reminder_rule()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.appointment_reminder_rules (profile_id, hours_before, enabled)
  VALUES (NEW.id, 24, true)
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_default_reminder_rule ON public.profiles;
CREATE TRIGGER profiles_default_reminder_rule
AFTER INSERT ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.add_default_reminder_rule();