ALTER TABLE public.treatments
  ADD COLUMN IF NOT EXISTS leaflet_title text,
  ADD COLUMN IF NOT EXISTS leaflet_html text,
  ADD COLUMN IF NOT EXISTS leaflet_url text;