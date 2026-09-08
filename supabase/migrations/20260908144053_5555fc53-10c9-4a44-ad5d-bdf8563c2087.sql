ALTER TABLE public.profiles ALTER COLUMN allow_pay_in_clinic SET DEFAULT false;

UPDATE public.profiles
SET allow_pay_in_clinic = false
WHERE allow_pay_in_clinic = true
  AND COALESCE(cash_only_balance, false) = false;