ALTER TABLE public.staff_members
  ADD COLUMN IF NOT EXISTS can_use_prescribing boolean NOT NULL DEFAULT false;