ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS general_rebook_reminders_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS general_rebook_reminder_days integer NOT NULL DEFAULT 90 CHECK (general_rebook_reminder_days > 0),
  ADD COLUMN IF NOT EXISTS general_rebook_followup_days integer CHECK (general_rebook_followup_days IS NULL OR general_rebook_followup_days > 0);

CREATE TABLE public.general_rebook_reminders_sent (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  appointment_id uuid NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
  patient_email text NOT NULL,
  stage smallint NOT NULL CHECK (stage IN (1, 2)),
  sent_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (profile_id, appointment_id, patient_email, stage)
);
GRANT SELECT ON public.general_rebook_reminders_sent TO authenticated;
GRANT ALL ON public.general_rebook_reminders_sent TO service_role;
ALTER TABLE public.general_rebook_reminders_sent ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Clinic members can view general rebook reminder history"
  ON public.general_rebook_reminders_sent
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      LEFT JOIN public.staff_members s
        ON s.profile_id = p.id
       AND s.user_id = auth.uid()
       AND s.status = 'active'
      WHERE p.id = general_rebook_reminders_sent.profile_id
        AND (p.user_id = auth.uid() OR s.user_id IS NOT NULL)
    )
  );

CREATE INDEX general_rebook_reminders_due_lookup_idx
  ON public.general_rebook_reminders_sent (profile_id, patient_email, appointment_id, stage);