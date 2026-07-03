
-- Push-through notifications for Prescriber Hub events.

-- Helper: get profile_id from a user_id (prescribers)
CREATE OR REPLACE FUNCTION public._profile_id_for_user(p_user_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM public.profiles WHERE user_id = p_user_id LIMIT 1;
$$;

-- Helper: get practitioner user_id from profile_id
CREATE OR REPLACE FUNCTION public._user_id_for_profile(p_profile_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT user_id FROM public.profiles WHERE id = p_profile_id LIMIT 1;
$$;

-- 1) New referral / prescription request → notify prescriber
CREATE OR REPLACE FUNCTION public.notify_new_referral()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_profile uuid; v_title text; v_emoji text; v_type text; v_link text;
BEGIN
  IF NEW.prescriber_user_id IS NULL THEN RETURN NEW; END IF;
  v_profile := public._profile_id_for_user(NEW.prescriber_user_id);
  IF v_profile IS NULL THEN RETURN NEW; END IF;

  IF COALESCE(NEW.routing,'') = 'prescriber' THEN
    v_type := 'prescription_request'; v_emoji := '💊';
    v_title := 'New prescription request';
    v_link := '/hub/referrals';
  ELSE
    v_type := 'referral'; v_emoji := '📨';
    v_title := 'New referral';
    v_link := '/hub/referrals';
  END IF;

  PERFORM public.create_notification(
    v_profile, v_type, v_title,
    COALESCE(NEW.patient_name, NEW.patient_email, 'A patient') || ' — needs your review',
    v_emoji, v_link, NEW.id, 'referral'
  );
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_notify_new_referral ON public.prescriber_referrals;
CREATE TRIGGER trg_notify_new_referral
AFTER INSERT ON public.prescriber_referrals
FOR EACH ROW EXECUTE FUNCTION public.notify_new_referral();

-- 1b) Referral awaiting practitioner close → notify practitioner
CREATE OR REPLACE FUNCTION public.notify_referral_awaiting_close()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.awaiting_practitioner_close = true
     AND COALESCE(OLD.awaiting_practitioner_close,false) = false THEN
    PERFORM public.create_notification(
      NEW.practitioner_profile_id, 'referral_close',
      'Booking needs review',
      COALESCE(NEW.patient_name, 'A patient') || ' — prescriber consultation completed, ready to close',
      '✅', '/dashboard/consultations', NEW.id, 'referral'
    );
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_notify_referral_awaiting_close ON public.prescriber_referrals;
CREATE TRIGGER trg_notify_referral_awaiting_close
AFTER UPDATE OF awaiting_practitioner_close ON public.prescriber_referrals
FOR EACH ROW EXECUTE FUNCTION public.notify_referral_awaiting_close();

-- 2) New clinic visit request → notify the other side
CREATE OR REPLACE FUNCTION public.notify_new_clinic_visit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_prescriber_profile uuid; v_when text;
BEGIN
  v_when := to_char(NEW.visit_date, 'DD Mon') || ' at ' || to_char(NEW.start_time, 'HH24:MI');

  IF COALESCE(NEW.created_by,'') = 'practitioner' THEN
    -- Notify prescriber
    v_prescriber_profile := public._profile_id_for_user(NEW.prescriber_user_id);
    IF v_prescriber_profile IS NOT NULL THEN
      PERFORM public.create_notification(
        v_prescriber_profile, 'clinic_visit_request',
        'New clinic visit request',
        'A practitioner requested you visit on ' || v_when,
        '🏥', '/hub/visits', NEW.id, 'clinic_visit'
      );
    END IF;
  ELSE
    -- Prescriber-initiated → notify practitioner
    PERFORM public.create_notification(
      NEW.practitioner_profile_id, 'clinic_visit',
      'Prescriber visit scheduled',
      'Your prescriber scheduled a visit on ' || v_when,
      '🏥', '/dashboard/bookings', NEW.id, 'clinic_visit'
    );
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_notify_new_clinic_visit ON public.prescriber_clinic_visits;
CREATE TRIGGER trg_notify_new_clinic_visit
AFTER INSERT ON public.prescriber_clinic_visits
FOR EACH ROW EXECUTE FUNCTION public.notify_new_clinic_visit();

-- 2b) Clinic visit confirmed by prescriber → notify practitioner
CREATE OR REPLACE FUNCTION public.notify_clinic_visit_confirmed()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_when text;
BEGIN
  IF NEW.confirmed_by_prescriber = true
     AND COALESCE(OLD.confirmed_by_prescriber,false) = false THEN
    v_when := to_char(NEW.visit_date, 'DD Mon') || ' at ' || to_char(NEW.start_time, 'HH24:MI');
    PERFORM public.create_notification(
      NEW.practitioner_profile_id, 'clinic_visit_confirmed',
      'Clinic visit confirmed',
      'Prescriber confirmed the visit on ' || v_when,
      '✅', '/dashboard/bookings', NEW.id, 'clinic_visit'
    );
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_notify_clinic_visit_confirmed ON public.prescriber_clinic_visits;
CREATE TRIGGER trg_notify_clinic_visit_confirmed
AFTER UPDATE OF confirmed_by_prescriber ON public.prescriber_clinic_visits
FOR EACH ROW EXECUTE FUNCTION public.notify_clinic_visit_confirmed();

-- 3) New prescription issued (client_prescriptions) → notify practitioner
CREATE OR REPLACE FUNCTION public.notify_new_client_prescription()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.create_notification(
    NEW.profile_id, 'prescription_issued',
    'New Rx issued',
    COALESCE(NEW.product, 'A prescription') || ' has been added',
    '💊', '/dashboard/patients', NEW.id, 'prescription'
  );
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_notify_new_client_prescription ON public.client_prescriptions;
CREATE TRIGGER trg_notify_new_client_prescription
AFTER INSERT ON public.client_prescriptions
FOR EACH ROW EXECUTE FUNCTION public.notify_new_client_prescription();
