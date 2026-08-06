ALTER TABLE public.rental_bookings ADD COLUMN IF NOT EXISTS unit_index integer;
ALTER TABLE public.rental_blocks ADD COLUMN IF NOT EXISTS units integer;
COMMENT ON COLUMN public.rental_bookings.unit_index IS 'Auto-allocated room number within the pooled room entry (1-based)';
COMMENT ON COLUMN public.rental_blocks.units IS 'How many rooms this closure takes out; NULL means all of them';