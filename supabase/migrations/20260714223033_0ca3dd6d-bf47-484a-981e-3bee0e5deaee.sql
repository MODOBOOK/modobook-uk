
ALTER TABLE public.treatments ADD COLUMN IF NOT EXISTS topup_reminder_days integer;
ALTER TABLE public.treatment_categories ADD COLUMN IF NOT EXISTS rebook_reminder_days integer;
ALTER TABLE public.treatment_categories ADD COLUMN IF NOT EXISTS topup_reminder_days integer;

CREATE TABLE IF NOT EXISTS public.appointment_rebook_reminders_sent (
  appointment_id uuid NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('rebook','topup')),
  sent_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (appointment_id, kind)
);
GRANT SELECT ON public.appointment_rebook_reminders_sent TO authenticated;
GRANT ALL ON public.appointment_rebook_reminders_sent TO service_role;
ALTER TABLE public.appointment_rebook_reminders_sent ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Practitioners can view their own rebook reminder log"
  ON public.appointment_rebook_reminders_sent
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.appointments a
      JOIN public.profiles p ON p.id = a.profile_id
      WHERE a.id = appointment_rebook_reminders_sent.appointment_id
        AND p.user_id = auth.uid()
    )
  );
