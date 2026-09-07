CREATE TABLE public.appointment_extras (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id uuid NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  treatment_id uuid REFERENCES public.treatments(id) ON DELETE SET NULL,
  name text NOT NULL,
  unit_price numeric NOT NULL DEFAULT 0,
  quantity integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX appointment_extras_appointment_idx ON public.appointment_extras(appointment_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.appointment_extras TO authenticated;
GRANT ALL ON public.appointment_extras TO service_role;

ALTER TABLE public.appointment_extras ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clinic team can manage appointment extras"
ON public.appointment_extras FOR ALL TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = appointment_extras.profile_id AND p.user_id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.staff_members s WHERE s.profile_id = appointment_extras.profile_id AND s.user_id = auth.uid() AND s.status = 'active')
)
WITH CHECK (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = appointment_extras.profile_id AND p.user_id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.staff_members s WHERE s.profile_id = appointment_extras.profile_id AND s.user_id = auth.uid() AND s.status = 'active')
);

CREATE TRIGGER update_appointment_extras_updated_at
BEFORE UPDATE ON public.appointment_extras
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();