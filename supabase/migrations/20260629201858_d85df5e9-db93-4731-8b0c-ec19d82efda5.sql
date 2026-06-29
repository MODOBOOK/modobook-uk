
ALTER TABLE public.clinic_clients ADD COLUMN IF NOT EXISTS is_blocked boolean NOT NULL DEFAULT false;
ALTER TABLE public.clinic_clients ADD COLUMN IF NOT EXISTS block_reason text;
ALTER TABLE public.clinic_clients ADD COLUMN IF NOT EXISTS blocked_at timestamptz;
ALTER TABLE public.clinic_clients ADD COLUMN IF NOT EXISTS no_show_count integer NOT NULL DEFAULT 0;
