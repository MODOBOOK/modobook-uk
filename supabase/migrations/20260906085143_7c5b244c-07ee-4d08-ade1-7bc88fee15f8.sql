CREATE TABLE public.sms_blasts (
  id uuid primary key default gen_random_uuid(),
  practitioner_id uuid not null,
  name text not null default 'SMS blast',
  body text not null,
  recipient_count integer not null default 0,
  segments integer not null default 1,
  billable_texts integer not null default 0,
  unit_price_pence integer not null default 10,
  total_pence integer not null default 0,
  status text not null default 'awaiting_payment',
  stripe_session_id text,
  stripe_payment_intent text,
  paid_at timestamptz,
  sent_at timestamptz,
  sent_count integer not null default 0,
  failed_count integer not null default 0,
  recipients jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

CREATE INDEX sms_blasts_practitioner_idx ON public.sms_blasts (practitioner_id, created_at desc);
CREATE UNIQUE INDEX sms_blasts_session_idx ON public.sms_blasts (stripe_session_id) WHERE stripe_session_id IS NOT NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sms_blasts TO authenticated;
GRANT ALL ON public.sms_blasts TO service_role;

ALTER TABLE public.sms_blasts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clinic team can manage their sms blasts"
ON public.sms_blasts FOR ALL TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = sms_blasts.practitioner_id AND p.user_id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.staff_members s WHERE s.profile_id = sms_blasts.practitioner_id AND s.user_id = auth.uid() AND s.status = 'active')
)
WITH CHECK (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = sms_blasts.practitioner_id AND p.user_id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.staff_members s WHERE s.profile_id = sms_blasts.practitioner_id AND s.user_id = auth.uid() AND s.status = 'active')
);

CREATE TRIGGER update_sms_blasts_updated_at BEFORE UPDATE ON public.sms_blasts
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();