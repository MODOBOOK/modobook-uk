create or replace function public.record_appointment_payment(
  p_appointment_id uuid,
  p_payment_intent text,
  p_amount_cents integer
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_applied boolean := false;
  v_intent text := nullif(p_payment_intent, '');
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
          or a.stripe_payment_intent_id is distinct from v_intent);
  get diagnostics v_applied = row_count;
  return v_applied;
end;
$$;

revoke all on function public.record_appointment_payment(uuid, text, integer) from public, anon, authenticated;
grant execute on function public.record_appointment_payment(uuid, text, integer) to service_role;