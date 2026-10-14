ALTER TABLE public.rental_rooms ADD COLUMN full_day_hours integer;
ALTER TABLE public.rental_rooms ADD COLUMN slot_step_minutes integer NOT NULL DEFAULT 60;
ALTER TABLE public.rental_rooms ADD CONSTRAINT rental_rooms_full_day_hours_check CHECK (full_day_hours IS NULL OR (full_day_hours >= 1 AND full_day_hours <= 12));
ALTER TABLE public.rental_rooms ADD CONSTRAINT rental_rooms_slot_step_check CHECK (slot_step_minutes IN (30, 60));
COMMENT ON COLUMN public.rental_rooms.full_day_hours IS 'Hours blocked for a full-day booking; NULL means the whole opening window.';
COMMENT ON COLUMN public.rental_rooms.slot_step_minutes IS 'Start-time increment offered to renters (30 or 60 minutes).'