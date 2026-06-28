ALTER TABLE public.clinic_theme
  ADD COLUMN IF NOT EXISTS welcome_card_size text NOT NULL DEFAULT 'medium',
  ADD COLUMN IF NOT EXISTS welcome_card_position text NOT NULL DEFAULT 'overlap',
  ADD COLUMN IF NOT EXISTS welcome_card_background_type text NOT NULL DEFAULT 'solid',
  ADD COLUMN IF NOT EXISTS welcome_card_gradient_from text DEFAULT '#ffffff',
  ADD COLUMN IF NOT EXISTS welcome_card_gradient_to text DEFAULT '#f3f4f6',
  ADD COLUMN IF NOT EXISTS welcome_card_show_sms boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS welcome_card_show_whatsapp boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS welcome_card_show_instagram boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS welcome_card_show_facebook boolean NOT NULL DEFAULT true;

GRANT SELECT, UPDATE, INSERT, DELETE ON public.clinic_theme TO authenticated;
GRANT ALL ON public.clinic_theme TO service_role;