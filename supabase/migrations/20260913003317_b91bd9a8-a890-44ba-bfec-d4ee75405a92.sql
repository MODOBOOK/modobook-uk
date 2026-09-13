
-- 1. One card payment reference can only ever be logged once per booking
CREATE UNIQUE INDEX IF NOT EXISTS payments_appointment_stripe_intent_unique
  ON public.payments (appointment_id, stripe_payment_intent_id)
  WHERE appointment_id IS NOT NULL
    AND stripe_payment_intent_id IS NOT NULL
    AND stripe_payment_intent_id LIKE 'pi\_%';

-- 2. Ignore accidental double entries of the same manual payment
CREATE OR REPLACE FUNCTION public.prevent_duplicate_payment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.appointment_id IS NOT NULL AND coalesce(NEW.status,'succeeded') = 'succeeded' THEN
    IF EXISTS (
      SELECT 1 FROM public.payments p
      WHERE p.appointment_id = NEW.appointment_id
        AND p.amount = NEW.amount
        AND coalesce(p.status,'succeeded') = 'succeeded'
        AND p.created_at > now() - interval '2 minutes'
    ) THEN
      RETURN NULL;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_duplicate_payment ON public.payments;
CREATE TRIGGER trg_prevent_duplicate_payment
BEFORE INSERT ON public.payments
FOR EACH ROW EXECUTE FUNCTION public.prevent_duplicate_payment();

-- 3. Keep the booking's paid total derived from its payment entries
CREATE OR REPLACE FUNCTION public.recalc_appointment_amount_paid()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target uuid := coalesce(NEW.appointment_id, OLD.appointment_id);
  total int;
BEGIN
  IF target IS NULL THEN
    RETURN coalesce(NEW, OLD);
  END IF;
  SELECT coalesce(round(sum(amount) * 100)::int, 0) INTO total
  FROM public.payments
  WHERE appointment_id = target AND coalesce(status,'succeeded') = 'succeeded';

  UPDATE public.appointments
  SET amount_paid_cents = total
  WHERE id = target AND coalesce(amount_paid_cents, 0) <> total;

  RETURN coalesce(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_recalc_appointment_amount_paid ON public.payments;
CREATE TRIGGER trg_recalc_appointment_amount_paid
AFTER INSERT OR UPDATE OR DELETE ON public.payments
FOR EACH ROW EXECUTE FUNCTION public.recalc_appointment_amount_paid();
