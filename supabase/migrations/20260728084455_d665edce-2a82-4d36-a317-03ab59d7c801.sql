CREATE TABLE public.competition_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign text NOT NULL DEFAULT 'tla-popup',
  full_name text NOT NULL,
  clinic_name text NOT NULL,
  instagram text,
  email text NOT NULL,
  phone text,
  notes text,
  consent_at timestamptz NOT NULL DEFAULT now(),
  consent_text text NOT NULL,
  marketing_opt_in boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'entered',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX competition_entries_campaign_idx ON public.competition_entries (campaign, created_at DESC);
CREATE UNIQUE INDEX competition_entries_campaign_email_idx ON public.competition_entries (campaign, lower(email));

GRANT ALL ON public.competition_entries TO service_role;

ALTER TABLE public.competition_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view competition entries"
ON public.competition_entries FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

GRANT SELECT ON public.competition_entries TO authenticated;