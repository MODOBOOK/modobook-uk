
-- 1) Repoint consultations.patient_id to clinic_clients (current patient table)
ALTER TABLE public.consultations DROP CONSTRAINT IF EXISTS consultations_patient_id_fkey;
ALTER TABLE public.consultations
  ADD CONSTRAINT consultations_patient_id_fkey
  FOREIGN KEY (patient_id) REFERENCES public.clinic_clients(id) ON DELETE SET NULL;

-- 2) Attach all the orphaned triggers the app relies on.

-- Snapshot treatment name/price into appointment rows on insert
DROP TRIGGER IF EXISTS trg_snapshot_appointment_treatment ON public.appointments;
CREATE TRIGGER trg_snapshot_appointment_treatment
  BEFORE INSERT ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.snapshot_appointment_treatment();

-- Sync newly-created appointments into clinic_clients (patient profile)
DROP TRIGGER IF EXISTS trg_sync_appointment_to_client ON public.appointments;
CREATE TRIGGER trg_sync_appointment_to_client
  AFTER INSERT OR UPDATE ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.sync_appointment_to_client();

-- Create medical forms automatically when an appointment is booked
DROP TRIGGER IF EXISTS trg_create_appointment_medical_forms ON public.appointments;
CREATE TRIGGER trg_create_appointment_medical_forms
  AFTER INSERT ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.create_appointment_medical_forms();

-- Schedule aftercare messages after booking
DROP TRIGGER IF EXISTS trg_schedule_appointment_aftercare ON public.appointments;
CREATE TRIGGER trg_schedule_appointment_aftercare
  AFTER INSERT ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.schedule_appointment_aftercare();

-- Create prescriber referrals when appointment requires one
DROP TRIGGER IF EXISTS trg_create_referral_for_appointment ON public.appointments;
CREATE TRIGGER trg_create_referral_for_appointment
  AFTER INSERT ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.create_referral_for_appointment();

-- Mirror submitted medical-form answers into the patient profile (GP, allergies, emergency contact, DOB)
DROP TRIGGER IF EXISTS trg_sync_medical_form_to_client ON public.appointment_medical_forms;
CREATE TRIGGER trg_sync_medical_form_to_client
  AFTER INSERT OR UPDATE OF status, response ON public.appointment_medical_forms
  FOR EACH ROW EXECUTE FUNCTION public.sync_medical_form_to_client();

-- Flag allergies on appointments + clinic_clients when medical form indicates one
DROP TRIGGER IF EXISTS trg_detect_allergies_from_medical_form ON public.appointment_medical_forms;
CREATE TRIGGER trg_detect_allergies_from_medical_form
  AFTER INSERT OR UPDATE OF status, response ON public.appointment_medical_forms
  FOR EACH ROW EXECUTE FUNCTION public.detect_allergies_from_medical_form();

-- Grant admin role automatically when an invited email signs up
DROP TRIGGER IF EXISTS trg_grant_admin_if_invited ON auth.users;
CREATE TRIGGER trg_grant_admin_if_invited
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.grant_admin_if_invited();

-- updated_at maintenance on key tables that already have an updated_at column
DROP TRIGGER IF EXISTS trg_consultations_updated_at ON public.consultations;
CREATE TRIGGER trg_consultations_updated_at BEFORE UPDATE ON public.consultations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_clinic_clients_updated_at ON public.clinic_clients;
CREATE TRIGGER trg_clinic_clients_updated_at BEFORE UPDATE ON public.clinic_clients
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_appointments_updated_at ON public.appointments;
CREATE TRIGGER trg_appointments_updated_at BEFORE UPDATE ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_prescriber_profiles_updated_at ON public.prescriber_profiles;
CREATE TRIGGER trg_prescriber_profiles_updated_at BEFORE UPDATE ON public.prescriber_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_prescriber_profiles_updated_at();

-- Backfill medical forms for already-existing appointments that have none yet,
-- so historic bookings also surface forms to the patient.
INSERT INTO public.appointment_medical_forms (appointment_id, template_id, profile_id)
SELECT a.id, tmf.template_id, a.profile_id
FROM public.appointments a
JOIN public.treatment_medical_forms tmf ON tmf.treatment_id = a.treatment_id
LEFT JOIN public.appointment_medical_forms existing
  ON existing.appointment_id = a.id AND existing.template_id = tmf.template_id
WHERE existing.id IS NULL
  AND a.status NOT IN ('cancelled');
