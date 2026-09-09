ALTER TABLE public.practitioner_treatments ADD COLUMN IF NOT EXISTS price_cents integer;
GRANT SELECT ON public.practitioner_treatments TO anon;