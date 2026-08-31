ALTER TABLE public.treatments ALTER COLUMN deposit_amount DROP DEFAULT;
UPDATE public.treatments SET deposit_amount = NULL WHERE deposit_amount IS NOT NULL AND deposit_amount <= 0;