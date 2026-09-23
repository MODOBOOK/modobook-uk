ALTER TABLE public.subscription_plans
  ADD COLUMN IF NOT EXISTS legacy boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS included_practitioners integer NOT NULL DEFAULT 1;

UPDATE public.subscription_plans SET is_default = false WHERE is_default;
UPDATE public.subscription_plans SET legacy = true WHERE id = '366314c4-265d-4cf4-898a-e6e2fbe621d8';

INSERT INTO public.subscription_plans (name, description, amount_cents, kind, is_default, included_practitioners, default_trial_days)
VALUES
  ('MODO Solo', 'For independent practitioners — 1 practitioner included', 3999, 'base', true, 1, 30),
  ('MODO Collective', 'For clinics and teams — 4 practitioners included', 5999, 'base', false, 4, 30);