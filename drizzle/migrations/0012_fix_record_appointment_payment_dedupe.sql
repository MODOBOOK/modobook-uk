DROP FUNCTION IF EXISTS public.record_appointment_payment(uuid, text, integer);

CREATE OR REPLACE FUNCTION public.record_appointment_payment(p_appointment_id uuid, p_payment_intent text, p_amount_cents integer, p_payment_method text DEFAULT NULL::text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_intent text := nullif(p_payment_intent, '');
  v_profile uuid;
  v_amount int := greatest(coalesce(p_amount_cents, 0), 0);
begin
  -- Serialise concurrent webhook/confirm calls for the same booking.
  select a.profile_id into v_profile from public.appointments a where a.id = p_appointment_id for update;
  if v_profile is null then return false; end if;

  -- Dedupe on the payment history, NOT on appointments.stripe_payment_intent_id:
  -- the booking flow stores the intent on the appointment before payment, so
  -- that column cannot tell us whether the money was already recorded.
  if v_intent is not null and exists (
    select 1 from public.payments p
     where p.appointment_id = p_appointment_id and p.stripe_payment_intent_id = v_intent
  ) then
    return false;
  end if;

  update public.appointments a
     set amount_paid_cents = case
           when coalesce(a.total_amount, 0) > 0
             then least(round(a.total_amount * 100)::int, coalesce(a.amount_paid_cents, 0) + v_amount)
           else coalesce(a.amount_paid_cents, 0) + v_amount
         end,
         stripe_payment_intent_id = coalesce(v_intent, a.stripe_payment_intent_id)
   where a.id = p_appointment_id;

  if v_amount > 0 then
    insert into public.payments (profile_id, appointment_id, amount, status, stripe_payment_intent_id, payment_method)
    values (v_profile, p_appointment_id, v_amount / 100.0, 'succeeded', v_intent, nullif(p_payment_method, ''));
  end if;

  return true;
end;
$function$;

REVOKE ALL ON FUNCTION public.record_appointment_payment(uuid, text, integer, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_appointment_payment(uuid, text, integer, text) TO service_role;