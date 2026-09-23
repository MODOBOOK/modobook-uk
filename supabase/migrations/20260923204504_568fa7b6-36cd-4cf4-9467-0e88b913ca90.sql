ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS payment_method text;

CREATE OR REPLACE FUNCTION public.record_appointment_payment(p_appointment_id uuid, p_payment_intent text, p_amount_cents integer, p_payment_method text default null)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  v_applied boolean := false;
  v_intent text := nullif(p_payment_intent, '');
  v_profile uuid;
begin
  update public.appointments a
     set amount_paid_cents = case
           when coalesce(a.total_amount, 0) > 0
             then least(round(a.total_amount * 100)::int, coalesce(a.amount_paid_cents, 0) + greatest(p_amount_cents, 0))
           else coalesce(a.amount_paid_cents, 0) + greatest(p_amount_cents, 0)
         end,
         stripe_payment_intent_id = coalesce(v_intent, a.stripe_payment_intent_id)
   where a.id = p_appointment_id
     and (v_intent is null
          or a.stripe_payment_intent_id is distinct from v_intent)
  returning a.profile_id into v_profile;

  get diagnostics v_applied = row_count;

  if v_applied and v_profile is not null and greatest(p_amount_cents, 0) > 0 then
    if v_intent is null or not exists (
      select 1 from public.payments p
       where p.appointment_id = p_appointment_id
         and p.stripe_payment_intent_id = v_intent
    ) then
      insert into public.payments (profile_id, appointment_id, amount, status, stripe_payment_intent_id, payment_method)
      values (v_profile, p_appointment_id, greatest(p_amount_cents, 0) / 100.0, 'succeeded', v_intent, nullif(p_payment_method, ''));
    end if;
  end if;

  return v_applied;
end;
$function$;

-- Backfill: copy the method already stored on appointments onto payment rows.
UPDATE public.payments p
   SET payment_method = a.payment_method
  FROM public.appointments a
 WHERE p.appointment_id = a.id
   AND p.payment_method IS NULL
   AND a.payment_method IS NOT NULL;