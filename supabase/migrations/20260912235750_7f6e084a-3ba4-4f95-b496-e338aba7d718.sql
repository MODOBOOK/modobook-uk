CREATE OR REPLACE FUNCTION public.sync_appointment_payment_status()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
declare
  v_total_cents int := round(coalesce(NEW.total_amount, 0) * 100)::int;
  v_paid_cents int := coalesce(NEW.amount_paid_cents, 0);
begin
  if v_total_cents > 0 and (NEW.payment_status is null or NEW.payment_status in ('pending'::payment_status, 'paid'::payment_status)) then
    if v_paid_cents >= v_total_cents then
      NEW.payment_status := 'paid'::payment_status;
    else
      NEW.payment_status := 'pending'::payment_status;
    end if;
  end if;
  return NEW;
end;
$$;

DROP TRIGGER IF EXISTS trg_sync_appointment_payment_status ON public.appointments;
CREATE TRIGGER trg_sync_appointment_payment_status
BEFORE INSERT OR UPDATE OF total_amount, amount_paid_cents, payment_status
ON public.appointments
FOR EACH ROW EXECUTE FUNCTION public.sync_appointment_payment_status();

CREATE OR REPLACE FUNCTION public.record_appointment_payment(p_appointment_id uuid, p_payment_intent text, p_amount_cents integer)
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
      insert into public.payments (profile_id, appointment_id, amount, status, stripe_payment_intent_id)
      values (v_profile, p_appointment_id, greatest(p_amount_cents, 0) / 100.0, 'succeeded', v_intent);
    end if;
  end if;

  return v_applied;
end;
$function$;

INSERT INTO public.payments (profile_id, appointment_id, amount, status, stripe_payment_intent_id, created_at)
SELECT a.profile_id, a.id, a.amount_paid_cents / 100.0, 'succeeded',
       coalesce(a.stripe_payment_intent_id, 'recorded:historic'),
       coalesce(a.deposit_paid_at, a.checkout_completed_at, a.created_at)
FROM public.appointments a
WHERE coalesce(a.amount_paid_cents, 0) > 0
  AND NOT EXISTS (SELECT 1 FROM public.payments p WHERE p.appointment_id = a.id);

UPDATE public.appointments a
   SET payment_status = (case
         when coalesce(a.amount_paid_cents, 0) >= round(coalesce(a.total_amount, 0) * 100)::int then 'paid'
         else 'pending'
       end)::payment_status
 WHERE coalesce(a.total_amount, 0) > 0
   AND a.payment_status::text is distinct from (case
         when coalesce(a.amount_paid_cents, 0) >= round(coalesce(a.total_amount, 0) * 100)::int then 'paid'
         else 'pending'
       end);