
ALTER TABLE public.gift_cards
  ADD COLUMN IF NOT EXISTS treatment_ids uuid[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS package_ids uuid[] NOT NULL DEFAULT '{}';

ALTER TABLE public.gift_card_purchases
  ADD COLUMN IF NOT EXISTS treatment_ids uuid[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS package_ids uuid[] NOT NULL DEFAULT '{}';

-- Backfill arrays from legacy single-id columns so existing cards keep working
UPDATE public.gift_cards
   SET treatment_ids = ARRAY[treatment_id]
 WHERE treatment_id IS NOT NULL AND (treatment_ids = '{}' OR treatment_ids IS NULL);

UPDATE public.gift_cards
   SET package_ids = ARRAY[package_id]
 WHERE package_id IS NOT NULL AND (package_ids = '{}' OR package_ids IS NULL);

UPDATE public.gift_card_purchases
   SET treatment_ids = ARRAY[treatment_id]
 WHERE treatment_id IS NOT NULL AND (treatment_ids = '{}' OR treatment_ids IS NULL);

UPDATE public.gift_card_purchases
   SET package_ids = ARRAY[package_id]
 WHERE package_id IS NOT NULL AND (package_ids = '{}' OR package_ids IS NULL);
