ALTER TABLE public.subscription_plans DROP CONSTRAINT IF EXISTS subscription_plans_kind_check;
ALTER TABLE public.subscription_plans ADD CONSTRAINT subscription_plans_kind_check
  CHECK (kind IN ('base','addon_location','addon_practitioner','addon_associates_module','addon_associate'));

INSERT INTO public.subscription_plans (kind, name, amount_cents, currency, interval, active)
VALUES
  ('addon_associates_module', 'Associates service', 499, 'gbp', 'month', true),
  ('addon_associate', 'Additional associate', 299, 'gbp', 'month', true);