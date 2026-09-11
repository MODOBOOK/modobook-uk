DROP POLICY IF EXISTS "Anyone can create a training booking" ON public.training_bookings;

CREATE POLICY "Anyone can create a training booking"
  ON public.training_bookings FOR INSERT
  WITH CHECK (
    course_id IN (SELECT id FROM public.training_courses WHERE active = true)
    AND payment_status = 'pending'
    AND coalesce(amount_paid, 0) = 0
    AND stripe_payment_intent_id IS NULL
    AND status IN ('pending', 'confirmed')
  );