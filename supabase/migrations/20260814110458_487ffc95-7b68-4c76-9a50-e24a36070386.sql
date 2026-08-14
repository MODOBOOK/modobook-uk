ALTER TABLE public.gift_cards ADD COLUMN IF NOT EXISTS price numeric;
COMMENT ON COLUMN public.gift_cards.price IS 'What the buyer pays. When null, the buyer pays the card face value (amount).';
ALTER TABLE public.gift_card_purchases ADD COLUMN IF NOT EXISTS amount_paid numeric;
COMMENT ON COLUMN public.gift_card_purchases.amount_paid IS 'What the buyer actually paid, which can be less than initial_amount when the card is discounted.';