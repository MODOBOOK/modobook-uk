ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS membership_hero_title text,
ADD COLUMN IF NOT EXISTS membership_hero_subtitle text;