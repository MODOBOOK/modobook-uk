ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS auto_refund_on_cancel boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS no_refund_policy_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS no_refund_policy_text text;