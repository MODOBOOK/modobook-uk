GRANT SELECT ON public.gift_cards TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.gift_cards TO authenticated;
GRANT ALL ON public.gift_cards TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.gift_card_purchases TO authenticated;
GRANT ALL ON public.gift_card_purchases TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.gift_card_redemptions TO authenticated;
GRANT ALL ON public.gift_card_redemptions TO service_role;