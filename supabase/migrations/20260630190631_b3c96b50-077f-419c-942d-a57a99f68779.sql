ALTER TABLE public.treatments
  ADD COLUMN IF NOT EXISTS price_mode text NOT NULL DEFAULT 'fixed',
  ADD COLUMN IF NOT EXISTS badge text;

ALTER TABLE public.treatments
  DROP CONSTRAINT IF EXISTS treatments_price_mode_check;
ALTER TABLE public.treatments
  ADD CONSTRAINT treatments_price_mode_check
  CHECK (price_mode IN ('fixed','from','poa','free'));

ALTER TABLE public.treatments
  DROP CONSTRAINT IF EXISTS treatments_badge_check;
ALTER TABLE public.treatments
  ADD CONSTRAINT treatments_badge_check
  CHECK (badge IS NULL OR badge IN ('recommended','popular','new','bestseller'));