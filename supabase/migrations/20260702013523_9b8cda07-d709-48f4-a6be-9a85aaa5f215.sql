-- Track how much has actually been paid on an appointment, and hold slots briefly
-- while a patient completes checkout so abandoned bookings free up automatically.
ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS amount_paid_cents integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payment_hold_expires_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_appointments_payment_hold
  ON public.appointments(payment_hold_expires_at)
  WHERE payment_hold_expires_at IS NOT NULL;
