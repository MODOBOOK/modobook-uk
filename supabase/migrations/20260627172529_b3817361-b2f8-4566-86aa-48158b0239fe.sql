
-- Menu-level discounts on treatments (always visible)
ALTER TABLE public.treatments
  ADD COLUMN IF NOT EXISTS discount_percent integer,
  ADD COLUMN IF NOT EXISTS discount_starts_at timestamptz,
  ADD COLUMN IF NOT EXISTS discount_ends_at timestamptz,
  ADD COLUMN IF NOT EXISTS discount_days_of_week integer[];

-- Discount codes (entered at checkout)
CREATE TABLE IF NOT EXISTS public.discount_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  code text NOT NULL,
  label text,
  kind text NOT NULL DEFAULT 'percent',
  amount numeric(10,2) NOT NULL,
  treatment_ids uuid[] NOT NULL DEFAULT '{}',
  starts_at timestamptz,
  ends_at timestamptz,
  days_of_week integer[],
  max_uses integer,
  uses_count integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS discount_codes_profile_code_uidx
  ON public.discount_codes (profile_id, lower(code));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.discount_codes TO authenticated;
GRANT ALL ON public.discount_codes TO service_role;
ALTER TABLE public.discount_codes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owners manage discount codes" ON public.discount_codes;
CREATE POLICY "Owners manage discount codes" ON public.discount_codes
  FOR ALL TO authenticated
  USING (public.is_profile_owner(profile_id))
  WITH CHECK (public.is_profile_owner(profile_id));

CREATE TRIGGER trg_discount_codes_updated_at
  BEFORE UPDATE ON public.discount_codes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Public RPC: validate a discount code for a slug + selected treatment ids
CREATE OR REPLACE FUNCTION public.validate_discount_code(
  p_slug text, p_code text, p_treatment_ids uuid[]
)
RETURNS TABLE(
  id uuid, code text, label text, kind text, amount numeric,
  applies_to_treatment_ids uuid[]
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_pid uuid; v_now timestamptz := now(); v_dow integer := EXTRACT(DOW FROM now())::int;
BEGIN
  SELECT p.id INTO v_pid FROM public.profiles p WHERE p.slug = p_slug AND p.active = true;
  IF v_pid IS NULL THEN RETURN; END IF;
  RETURN QUERY
    SELECT dc.id, dc.code, dc.label, dc.kind, dc.amount,
      CASE WHEN coalesce(array_length(dc.treatment_ids,1),0) = 0
        THEN p_treatment_ids
        ELSE ARRAY(SELECT unnest(p_treatment_ids) INTERSECT SELECT unnest(dc.treatment_ids))
      END
    FROM public.discount_codes dc
    WHERE dc.profile_id = v_pid
      AND dc.active = true
      AND lower(dc.code) = lower(p_code)
      AND (dc.starts_at IS NULL OR dc.starts_at <= v_now)
      AND (dc.ends_at IS NULL OR dc.ends_at >= v_now)
      AND (dc.max_uses IS NULL OR dc.uses_count < dc.max_uses)
      AND (dc.days_of_week IS NULL OR coalesce(array_length(dc.days_of_week,1),0) = 0 OR v_dow = ANY(dc.days_of_week));
END;
$$;
REVOKE EXECUTE ON FUNCTION public.validate_discount_code(text, text, uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.validate_discount_code(text, text, uuid[]) TO anon, authenticated;

-- Model slots
CREATE TABLE IF NOT EXISTS public.model_slots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  treatment_id uuid NOT NULL REFERENCES public.treatments(id) ON DELETE CASCADE,
  location_id uuid REFERENCES public.locations(id) ON DELETE SET NULL,
  slot_date date NOT NULL,
  start_time time NOT NULL,
  end_time time NOT NULL,
  price_mode text NOT NULL DEFAULT 'fixed',
  price_value numeric(10,2) NOT NULL,
  notes text,
  booked_appointment_id uuid REFERENCES public.appointments(id) ON DELETE SET NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS model_slots_profile_date_idx
  ON public.model_slots (profile_id, slot_date);

GRANT SELECT ON public.model_slots TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.model_slots TO authenticated;
GRANT ALL ON public.model_slots TO service_role;
ALTER TABLE public.model_slots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owners manage model slots" ON public.model_slots;
CREATE POLICY "Owners manage model slots" ON public.model_slots
  FOR ALL TO authenticated
  USING (public.is_profile_owner(profile_id))
  WITH CHECK (public.is_profile_owner(profile_id));

DROP POLICY IF EXISTS "Public read active future model slots" ON public.model_slots;
CREATE POLICY "Public read active future model slots" ON public.model_slots
  FOR SELECT TO anon, authenticated
  USING (
    active = true
    AND booked_appointment_id IS NULL
    AND slot_date >= current_date
    AND public.is_active_profile(profile_id)
  );

CREATE TRIGGER trg_model_slots_updated_at
  BEFORE UPDATE ON public.model_slots
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Appointments: track discount + model slot link
ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS discount_code_id uuid REFERENCES public.discount_codes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS discount_amount numeric(10,2),
  ADD COLUMN IF NOT EXISTS model_slot_id uuid REFERENCES public.model_slots(id) ON DELETE SET NULL;
