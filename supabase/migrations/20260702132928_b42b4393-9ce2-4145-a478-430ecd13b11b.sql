
-- 1. Notifications table
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type text NOT NULL, -- 'booking' | 'form' | 'consent' | 'review' | 'other'
  title text NOT NULL,
  body text,
  emoji text,
  link text,
  entity_id uuid,
  entity_type text,
  read_at timestamptz,
  cleared_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS notifications_profile_created_idx
  ON public.notifications (profile_id, cleared_at, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Practitioner reads own notifications"
  ON public.notifications FOR SELECT TO authenticated
  USING (public.is_profile_owner(profile_id));

CREATE POLICY "Practitioner updates own notifications"
  ON public.notifications FOR UPDATE TO authenticated
  USING (public.is_profile_owner(profile_id))
  WITH CHECK (public.is_profile_owner(profile_id));

CREATE POLICY "Practitioner deletes own notifications"
  ON public.notifications FOR DELETE TO authenticated
  USING (public.is_profile_owner(profile_id));

-- 2. Realtime
ALTER TABLE public.notifications REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- 3. Helper: safe insert (bypasses RLS via SECURITY DEFINER for triggers)
CREATE OR REPLACE FUNCTION public.create_notification(
  p_profile_id uuid, p_type text, p_title text, p_body text,
  p_emoji text, p_link text, p_entity_id uuid, p_entity_type text
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF p_profile_id IS NULL THEN RETURN; END IF;
  INSERT INTO public.notifications (profile_id, type, title, body, emoji, link, entity_id, entity_type)
  VALUES (p_profile_id, p_type, p_title, p_body, p_emoji, p_link, p_entity_id, p_entity_type);
END; $$;

-- 4. Trigger: new booking (confirmed OR paid)
CREATE OR REPLACE FUNCTION public.notify_new_booking()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_name text; v_treatment text;
BEGIN
  -- Fire once when the appointment becomes real (confirmed) or paid
  IF (TG_OP = 'INSERT' AND (NEW.status = 'confirmed' OR NEW.payment_status = 'paid'))
     OR (TG_OP = 'UPDATE'
         AND ((NEW.status = 'confirmed' AND COALESCE(OLD.status,'') <> 'confirmed')
              OR (NEW.payment_status = 'paid' AND COALESCE(OLD.payment_status,'') <> 'paid')))
  THEN
    v_name := COALESCE(NEW.patient_name, NEW.patient_email, 'A patient');
    v_treatment := COALESCE(NEW.treatment_name_snapshot, 'a treatment');
    PERFORM public.create_notification(
      NEW.profile_id, 'booking',
      'New booking!',
      v_name || ' booked ' || v_treatment || ' on ' || to_char(NEW.scheduled_date, 'DD Mon') || ' at ' || to_char(NEW.start_time, 'HH24:MI'),
      '🎉', '/dashboard/bookings', NEW.id, 'appointment'
    );
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_notify_new_booking ON public.appointments;
CREATE TRIGGER trg_notify_new_booking
AFTER INSERT OR UPDATE OF status, payment_status ON public.appointments
FOR EACH ROW EXECUTE FUNCTION public.notify_new_booking();

-- 5. Trigger: medical form submitted
CREATE OR REPLACE FUNCTION public.notify_medical_form_submitted()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'submitted' AND COALESCE(OLD.status,'') <> 'submitted' THEN
    PERFORM public.create_notification(
      NEW.profile_id, 'form',
      'Medical form completed',
      'A patient just submitted a medical form.',
      '📝', '/dashboard/patients', NEW.id, 'medical_form'
    );
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_notify_medical_form_submitted ON public.appointment_medical_forms;
CREATE TRIGGER trg_notify_medical_form_submitted
AFTER UPDATE OF status ON public.appointment_medical_forms
FOR EACH ROW EXECUTE FUNCTION public.notify_medical_form_submitted();

-- 6. Trigger: consent signed
CREATE OR REPLACE FUNCTION public.notify_consent_signed()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_profile uuid;
BEGIN
  IF NEW.status = 'signed' AND COALESCE(OLD.status,'') <> 'signed' THEN
    SELECT profile_id INTO v_profile FROM public.appointments WHERE id = NEW.appointment_id;
    PERFORM public.create_notification(
      v_profile, 'consent',
      'Consent signed',
      'A patient just signed a consent form.',
      '✍️', '/dashboard/patients', NEW.id, 'consent'
    );
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_notify_consent_signed ON public.appointment_consents;
CREATE TRIGGER trg_notify_consent_signed
AFTER UPDATE OF status ON public.appointment_consents
FOR EACH ROW EXECUTE FUNCTION public.notify_consent_signed();

-- 7. Trigger: new review
CREATE OR REPLACE FUNCTION public.notify_new_review()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.create_notification(
    NEW.profile_id, 'review',
    'New review received',
    COALESCE(NEW.rating::text || '★ from a patient', 'A patient left a review'),
    '⭐', '/dashboard/reviews', NEW.id, 'review'
  );
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_notify_new_review ON public.patient_reviews;
CREATE TRIGGER trg_notify_new_review
AFTER INSERT ON public.patient_reviews
FOR EACH ROW EXECUTE FUNCTION public.notify_new_review();
