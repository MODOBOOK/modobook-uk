ALTER TABLE public.rental_rooms
  ADD COLUMN IF NOT EXISTS skip_room_selection boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS deposit_percent numeric NULL;

ALTER TABLE public.rental_bookings
  ADD COLUMN IF NOT EXISTS deposit_amount numeric NULL;