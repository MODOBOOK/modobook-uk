INSERT INTO public.patient_points_ledger
  (patient_user_id, clinic_profile_id, delta, reason, ref_type, ref_id, note)
SELECT
  COALESCE(a.patient_user_id, pa.user_id),
  p.user_id,
  FLOOR(COALESCE(a.total_amount, 0) * s.points_per_pound_earn)::int,
  'booking_earned',
  'appointment',
  a.id,
  'Points earned on booking'
FROM public.appointments a
JOIN public.profiles p ON p.id = a.profile_id
JOIN public.clinic_referral_settings s
  ON s.clinic_profile_id = p.user_id
 AND COALESCE(s.earn_on_spend_enabled, false)
 AND COALESCE(s.points_per_pound_earn, 0) > 0
LEFT JOIN public.patient_accounts pa
  ON pa.profile_id = a.profile_id
 AND lower(pa.email) = lower(a.patient_email)
WHERE COALESCE(a.is_demo, false) = false
  AND a.status NOT IN ('cancelled', 'no_show')
  AND COALESCE(a.patient_user_id, pa.user_id) IS NOT NULL
  AND FLOOR(COALESCE(a.total_amount, 0) * s.points_per_pound_earn)::int > 0
  AND NOT EXISTS (
    SELECT 1 FROM public.patient_points_ledger l
    WHERE l.ref_type = 'appointment' AND l.ref_id = a.id
  );