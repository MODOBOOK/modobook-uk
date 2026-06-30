
ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS treatment_name_snapshot text,
  ADD COLUMN IF NOT EXISTS treatment_price_snapshot numeric(10,2);

-- Backfill
UPDATE public.appointments a
   SET treatment_name_snapshot = t.name,
       treatment_price_snapshot = t.price
  FROM public.treatments t
 WHERE a.treatment_id = t.id
   AND a.treatment_name_snapshot IS NULL;

-- Make treatment_id nullable + change FK to SET NULL
ALTER TABLE public.appointments ALTER COLUMN treatment_id DROP NOT NULL;
ALTER TABLE public.appointments DROP CONSTRAINT IF EXISTS appointments_treatment_id_fkey;
ALTER TABLE public.appointments
  ADD CONSTRAINT appointments_treatment_id_fkey
  FOREIGN KEY (treatment_id) REFERENCES public.treatments(id) ON DELETE SET NULL;

-- Trigger to populate snapshot on insert
CREATE OR REPLACE FUNCTION public.snapshot_appointment_treatment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.treatment_id IS NOT NULL AND (NEW.treatment_name_snapshot IS NULL OR NEW.treatment_name_snapshot = '') THEN
    SELECT name, price INTO NEW.treatment_name_snapshot, NEW.treatment_price_snapshot
      FROM public.treatments WHERE id = NEW.treatment_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_snapshot_appointment_treatment ON public.appointments;
CREATE TRIGGER trg_snapshot_appointment_treatment
BEFORE INSERT ON public.appointments
FOR EACH ROW EXECUTE FUNCTION public.snapshot_appointment_treatment();
