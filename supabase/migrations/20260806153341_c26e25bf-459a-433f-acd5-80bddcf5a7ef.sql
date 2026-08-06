ALTER TABLE public.rental_rooms ADD COLUMN IF NOT EXISTS auto_invoice boolean NOT NULL DEFAULT false;
ALTER TABLE public.rental_bookings ADD COLUMN IF NOT EXISTS invoice_sent_at timestamptz;