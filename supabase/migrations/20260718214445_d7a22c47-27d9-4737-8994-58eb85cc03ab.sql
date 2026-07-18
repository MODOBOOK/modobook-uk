-- Mark one base plan as the platform default, auto-provision trials for every new practitioner.

ALTER TABLE public.subscription_plans
  ADD COLUMN IF NOT EXISTS is_default boolean NOT NULL DEFAULT false;

-- Only one default at a time (partial unique index)
DROP INDEX IF EXISTS subscription_plans_one_default;
CREATE UNIQUE INDEX subscription_plans_one_default
  ON public.subscription_plans ((true)) WHERE is_default;

-- Pick a sensible existing default if none set: first active base plan by amount
UPDATE public.subscription_plans
SET is_default = true
WHERE id = (
  SELECT id FROM public.subscription_plans
  WHERE active AND (kind = 'base' OR kind IS NULL)
  ORDER BY amount_cents ASC
  LIMIT 1
)
AND NOT EXISTS (SELECT 1 FROM public.subscription_plans WHERE is_default);

-- Backfill: any practitioner_subscriptions row missing plan_id -> default plan
UPDATE public.practitioner_subscriptions ps
SET plan_id = (SELECT id FROM public.subscription_plans WHERE is_default LIMIT 1)
WHERE ps.plan_id IS NULL;

-- Backfill: every practitioner without a subscription row gets a trialing row
INSERT INTO public.practitioner_subscriptions (profile_id, plan_id, status, trial_end)
SELECT
  p.id,
  (SELECT id FROM public.subscription_plans WHERE is_default LIMIT 1),
  'trialing',
  now() + make_interval(days => COALESCE(
    (SELECT default_trial_days FROM public.subscription_plans WHERE is_default LIMIT 1),
    30
  ))
FROM public.profiles p
WHERE p.role = 'practitioner'
  AND NOT EXISTS (SELECT 1 FROM public.practitioner_subscriptions ps WHERE ps.profile_id = p.id);

-- Trigger: auto-create a trialing subscription for every new practitioner profile
CREATE OR REPLACE FUNCTION public.handle_new_practitioner_subscription()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  default_plan_id uuid;
  trial_days int;
BEGIN
  IF NEW.role IS DISTINCT FROM 'practitioner' THEN
    RETURN NEW;
  END IF;

  SELECT id, COALESCE(default_trial_days, 30)
    INTO default_plan_id, trial_days
  FROM public.subscription_plans
  WHERE is_default
  LIMIT 1;

  INSERT INTO public.practitioner_subscriptions (profile_id, plan_id, status, trial_end)
  VALUES (
    NEW.id,
    default_plan_id,
    'trialing',
    now() + make_interval(days => trial_days)
  )
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_profile_created_practitioner_sub ON public.profiles;
CREATE TRIGGER on_profile_created_practitioner_sub
AFTER INSERT ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.handle_new_practitioner_subscription();

-- Also handle role change to practitioner (e.g. via admin)
DROP TRIGGER IF EXISTS on_profile_role_practitioner_sub ON public.profiles;
CREATE TRIGGER on_profile_role_practitioner_sub
AFTER UPDATE OF role ON public.profiles
FOR EACH ROW
WHEN (NEW.role = 'practitioner' AND OLD.role IS DISTINCT FROM NEW.role)
EXECUTE FUNCTION public.handle_new_practitioner_subscription();