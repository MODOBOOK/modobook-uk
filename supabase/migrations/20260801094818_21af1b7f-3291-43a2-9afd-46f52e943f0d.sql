ALTER TABLE public.admin_broadcasts DROP CONSTRAINT IF EXISTS admin_broadcasts_audience_check;
ALTER TABLE public.admin_broadcasts ADD CONSTRAINT admin_broadcasts_audience_check CHECK (audience IN ('all_practitioners','user','waitlist'));
ALTER TABLE public.admin_broadcasts ADD COLUMN IF NOT EXISTS blocks jsonb;