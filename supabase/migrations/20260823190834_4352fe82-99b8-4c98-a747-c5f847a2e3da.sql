DO $$
DECLARE t TEXT;
DECLARE tables TEXT[] := ARRAY[
  'addons','aftercare_templates','appointment_aftercare','appointment_consents',
  'appointment_medical_forms','appointment_reminder_rules','appointments',
  'availability_overrides','availability_rules','blocked_dates','blocked_times',
  'client_communications','client_concerns','client_files','client_medications',
  'client_notes','client_prescriptions','clinic_clients','clinic_gallery','clinic_testimonials',
  'concern_areas','concern_treatments','concerns','consent_templates','consultations',
  'discount_codes','email_customizations','email_templates','gift_card_purchases',
  'gift_card_redemptions','gift_cards','locations','medical_form_categories',
  'medical_form_templates','model_slots','notifications','offer_group_items','offer_groups',
  'package_builders','packages','patient_accounts','patient_ai_briefs','patient_invoices',
  'patient_practitioner_links','patient_reviews','patient_timeline_manual_events',
  'payment_links','payments','practitioners','pretreatment_templates','quiz_responses',
  'rental_blocks','rental_bookings','rental_hours','rental_rooms','training_bookings',
  'training_courses','training_pages','treatment_categories','treatment_consents',
  'treatment_plan_templates','treatment_plans','treatments'
];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name=t AND column_name='profile_id'
    ) THEN
      EXECUTE format('DROP POLICY IF EXISTS "Clinic staff manage %I" ON public.%I', t, t);
      EXECUTE format(
        'CREATE POLICY "Clinic staff manage %I" ON public.%I FOR ALL TO authenticated USING (public.is_clinic_staff(profile_id)) WITH CHECK (public.is_clinic_staff(profile_id))',
        t, t
      );
    END IF;
  END LOOP;
END $$;
