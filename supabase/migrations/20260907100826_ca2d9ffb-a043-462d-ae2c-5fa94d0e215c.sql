ALTER TABLE public.staff_members
  ADD COLUMN IF NOT EXISTS can_manage_rota boolean NOT NULL DEFAULT false;