ALTER TABLE public.membership_plans
  ADD COLUMN IF NOT EXISTS flexible_booking boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS rollover_included boolean NOT NULL DEFAULT false;