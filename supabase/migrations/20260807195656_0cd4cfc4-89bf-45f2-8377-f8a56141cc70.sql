UPDATE public.appointments
SET amount_paid_cents = ROUND(COALESCE(total_amount, 0) * 100)::integer
WHERE amount_paid_cents > ROUND(COALESCE(total_amount, 0) * 100);