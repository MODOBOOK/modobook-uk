ALTER TABLE public.prescriber_referrals DROP CONSTRAINT IF EXISTS prescriber_referrals_routing_check;
ALTER TABLE public.prescriber_referrals ADD CONSTRAINT prescriber_referrals_routing_check
  CHECK (routing IN ('same_address','clinic_visit','in_person_consult','walk_in'));