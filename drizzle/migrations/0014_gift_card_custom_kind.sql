ALTER TABLE public.gift_cards DROP CONSTRAINT IF EXISTS gift_cards_kind_check;
ALTER TABLE public.gift_cards ADD CONSTRAINT gift_cards_kind_check CHECK (kind IN ('value','treatment','package','custom'));
ALTER TABLE public.gift_card_purchases DROP CONSTRAINT IF EXISTS gift_card_purchases_kind_check;
ALTER TABLE public.gift_card_purchases ADD CONSTRAINT gift_card_purchases_kind_check CHECK (kind IN ('value','treatment','package','custom'));