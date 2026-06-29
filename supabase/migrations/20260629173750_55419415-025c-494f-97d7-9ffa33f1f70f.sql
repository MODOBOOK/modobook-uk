
CREATE TABLE public.aftercare_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name text NOT NULL,
  body_html text NOT NULL DEFAULT '',
  delay_hours integer NOT NULL DEFAULT 2,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.aftercare_templates TO authenticated;
GRANT ALL ON public.aftercare_templates TO service_role;
ALTER TABLE public.aftercare_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owners manage aftercare templates" ON public.aftercare_templates
  FOR ALL USING (public.is_profile_owner(profile_id)) WITH CHECK (public.is_profile_owner(profile_id));
CREATE TRIGGER aftercare_templates_updated BEFORE UPDATE ON public.aftercare_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.treatment_aftercare_templates (
  treatment_id uuid NOT NULL REFERENCES public.treatments(id) ON DELETE CASCADE,
  template_id uuid NOT NULL REFERENCES public.aftercare_templates(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (treatment_id, template_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.treatment_aftercare_templates TO authenticated;
GRANT ALL ON public.treatment_aftercare_templates TO service_role;
ALTER TABLE public.treatment_aftercare_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owners manage treatment aftercare links" ON public.treatment_aftercare_templates
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.treatments t WHERE t.id = treatment_id AND public.is_profile_owner(t.profile_id))
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.treatments t WHERE t.id = treatment_id AND public.is_profile_owner(t.profile_id))
  );

CREATE OR REPLACE FUNCTION public.schedule_appointment_aftercare()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_auto boolean;
  v_delay int;
  v_html text;
  v_send_at timestamptz;
  v_tpl record;
BEGIN
  -- Legacy per-treatment aftercare html (still supported)
  SELECT auto_send_aftercare, aftercare_delay_hours, aftercare_html
    INTO v_auto, v_delay, v_html
    FROM public.treatments WHERE id = NEW.treatment_id;
  IF COALESCE(v_auto, false) AND COALESCE(v_html,'') <> '' THEN
    v_send_at := (NEW.scheduled_date + NEW.end_time)::timestamptz + (COALESCE(v_delay,2) || ' hours')::interval;
    INSERT INTO public.appointment_aftercare (
      appointment_id, profile_id, send_at, body_html, recipient_email, recipient_phone
    ) VALUES (
      NEW.id, NEW.profile_id, v_send_at, v_html, NEW.patient_email, NEW.patient_phone
    );
  END IF;

  -- New: reusable templates linked to the treatment
  FOR v_tpl IN
    SELECT at.body_html, at.delay_hours
    FROM public.treatment_aftercare_templates tat
    JOIN public.aftercare_templates at ON at.id = tat.template_id
    WHERE tat.treatment_id = NEW.treatment_id
  LOOP
    v_send_at := (NEW.scheduled_date + NEW.end_time)::timestamptz + (COALESCE(v_tpl.delay_hours,2) || ' hours')::interval;
    INSERT INTO public.appointment_aftercare (
      appointment_id, profile_id, send_at, body_html, recipient_email, recipient_phone
    ) VALUES (
      NEW.id, NEW.profile_id, v_send_at, v_tpl.body_html, NEW.patient_email, NEW.patient_phone
    );
  END LOOP;

  RETURN NEW;
END;
$function$;
