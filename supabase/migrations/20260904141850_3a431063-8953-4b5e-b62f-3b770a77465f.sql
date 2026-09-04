ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS notify_new_booking_email boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS new_booking_email_to text;