-- 1. Table
CREATE TABLE IF NOT EXISTS public.phi_access_log (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id    uuid NOT NULL,
  actor_user_id uuid,
  actor_role    text,
  action        text NOT NULL,           -- 'insert' | 'update' | 'delete'
  table_name    text NOT NULL,
  row_id        uuid,
  client_id     uuid,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS phi_access_log_profile_created_idx
  ON public.phi_access_log (profile_id, created_at DESC);
CREATE INDEX IF NOT EXISTS phi_access_log_client_idx
  ON public.phi_access_log (client_id, created_at DESC);

-- 2. Grants
GRANT SELECT ON public.phi_access_log TO authenticated;
GRANT ALL    ON public.phi_access_log TO service_role;

-- 3. RLS
ALTER TABLE public.phi_access_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clinic owners can view their PHI access log"
  ON public.phi_access_log FOR SELECT TO authenticated
  USING (public.is_profile_owner(profile_id));

-- No INSERT/UPDATE/DELETE policies: writes happen inside SECURITY DEFINER triggers.

-- 4. Recorder function
CREATE OR REPLACE FUNCTION public.record_phi_access()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile   uuid;
  v_client    uuid;
  v_row       uuid;
  v_actor     uuid := auth.uid();
BEGIN
  -- Skip when there is no authenticated actor (background jobs, triggers-of-triggers).
  IF v_actor IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- Resolve profile_id, client_id, row_id from either NEW or OLD row generically.
  BEGIN v_profile := (to_jsonb(COALESCE(NEW, OLD))->>'profile_id')::uuid; EXCEPTION WHEN others THEN v_profile := NULL; END;
  BEGIN v_client  := (to_jsonb(COALESCE(NEW, OLD))->>'client_id')::uuid;  EXCEPTION WHEN others THEN v_client  := NULL; END;
  IF v_client IS NULL THEN
    BEGIN v_client := (to_jsonb(COALESCE(NEW, OLD))->>'patient_id')::uuid; EXCEPTION WHEN others THEN v_client := NULL; END;
  END IF;
  BEGIN v_row := (to_jsonb(COALESCE(NEW, OLD))->>'id')::uuid; EXCEPTION WHEN others THEN v_row := NULL; END;

  -- Only log when the actor is the clinic owner (practitioner-side activity).
  -- Patient self-service writes are excluded to keep the log focused on staff access.
  IF v_profile IS NULL OR NOT public.is_profile_owner(v_profile) THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  INSERT INTO public.phi_access_log (
    profile_id, actor_user_id, actor_role, action, table_name, row_id, client_id
  ) VALUES (
    v_profile,
    v_actor,
    'practitioner',
    lower(TG_OP),
    TG_TABLE_NAME,
    v_row,
    v_client
  );

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- 5. Attach triggers to clinical tables
DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'clinic_clients',
    'consultations',
    'appointment_medical_forms',
    'client_prescriptions',
    'client_files',
    'client_notes'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_phi_access_log ON public.%I', t);
    EXECUTE format(
      'CREATE TRIGGER trg_phi_access_log
         AFTER INSERT OR UPDATE OR DELETE ON public.%I
         FOR EACH ROW EXECUTE FUNCTION public.record_phi_access()',
      t
    );
  END LOOP;
END $$;