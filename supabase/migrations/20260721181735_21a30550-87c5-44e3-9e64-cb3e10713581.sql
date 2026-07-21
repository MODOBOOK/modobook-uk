
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;
ALTER TABLE public.clinic_clients ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_profiles_is_demo ON public.profiles(is_demo) WHERE is_demo = true;
CREATE INDEX IF NOT EXISTS idx_clinic_clients_is_demo ON public.clinic_clients(is_demo) WHERE is_demo = true;
CREATE INDEX IF NOT EXISTS idx_appointments_is_demo ON public.appointments(is_demo) WHERE is_demo = true;

-- Trigger: propagate is_demo from parent profile to appointments/clinic_clients automatically
CREATE OR REPLACE FUNCTION public.propagate_demo_flag()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  parent_is_demo boolean;
BEGIN
  IF NEW.is_demo IS NULL OR NEW.is_demo = false THEN
    SELECT p.is_demo INTO parent_is_demo FROM public.profiles p WHERE p.id = NEW.profile_id;
    IF parent_is_demo THEN
      NEW.is_demo := true;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_propagate_demo_appointments ON public.appointments;
CREATE TRIGGER trg_propagate_demo_appointments
BEFORE INSERT ON public.appointments
FOR EACH ROW EXECUTE FUNCTION public.propagate_demo_flag();

DROP TRIGGER IF EXISTS trg_propagate_demo_clinic_clients ON public.clinic_clients;
CREATE TRIGGER trg_propagate_demo_clinic_clients
BEFORE INSERT ON public.clinic_clients
FOR EACH ROW EXECUTE FUNCTION public.propagate_demo_flag();
