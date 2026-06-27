
DROP POLICY IF EXISTS "Public read active availability rules" ON public.availability_rules;
CREATE POLICY "Public read active availability rules" ON public.availability_rules
  FOR SELECT TO anon, authenticated
  USING (public.is_active_profile(profile_id));

DROP POLICY IF EXISTS "Public read blocked dates for active clinics" ON public.blocked_dates;
CREATE POLICY "Public read blocked dates for active clinics" ON public.blocked_dates
  FOR SELECT TO anon, authenticated
  USING (public.is_active_profile(profile_id));

GRANT SELECT ON public.availability_rules TO anon, authenticated;
GRANT SELECT ON public.blocked_dates TO anon, authenticated;

GRANT INSERT ON public.appointments TO anon, authenticated;
DROP POLICY IF EXISTS "Public can request appointments" ON public.appointments;
CREATE POLICY "Public can request appointments" ON public.appointments
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    public.is_active_profile(profile_id)
    AND status = 'pending'
    AND payment_status = 'pending'
    AND package_purchase_id IS NULL
    AND stripe_payment_intent_id IS NULL
  );
