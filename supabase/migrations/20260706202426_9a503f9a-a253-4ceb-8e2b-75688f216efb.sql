
-- Treatment plan templates (reusable)
CREATE TABLE public.treatment_plan_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  default_interval_weeks INT NOT NULL DEFAULT 4,
  booking_mode TEXT NOT NULL DEFAULT 'rolling' CHECK (booking_mode IN ('upfront','rolling')),
  payment_mode TEXT NOT NULL DEFAULT 'per_session' CHECK (payment_mode IN ('per_session','course_upfront','deposit_then_per_session')),
  course_price_cents INT,
  deposit_cents INT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.treatment_plan_templates TO authenticated;
GRANT ALL ON public.treatment_plan_templates TO service_role;
ALTER TABLE public.treatment_plan_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "practitioner owns templates" ON public.treatment_plan_templates
  FOR ALL USING (profile_id = auth.uid()) WITH CHECK (profile_id = auth.uid());

CREATE TABLE public.treatment_plan_template_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES public.treatment_plan_templates(id) ON DELETE CASCADE,
  treatment_id UUID REFERENCES public.treatments(id) ON DELETE SET NULL,
  session_number INT NOT NULL,
  interval_weeks_from_previous INT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.treatment_plan_template_items TO authenticated;
GRANT ALL ON public.treatment_plan_template_items TO service_role;
ALTER TABLE public.treatment_plan_template_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "practitioner owns template items" ON public.treatment_plan_template_items
  FOR ALL USING (EXISTS (SELECT 1 FROM public.treatment_plan_templates t WHERE t.id = template_id AND t.profile_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.treatment_plan_templates t WHERE t.id = template_id AND t.profile_id = auth.uid()));

-- Treatment plans (assigned to a patient)
CREATE TABLE public.treatment_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.clinic_clients(id) ON DELETE CASCADE,
  consultation_id UUID REFERENCES public.consultations(id) ON DELETE SET NULL,
  template_id UUID REFERENCES public.treatment_plan_templates(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT,
  booking_mode TEXT NOT NULL DEFAULT 'rolling' CHECK (booking_mode IN ('upfront','rolling')),
  payment_mode TEXT NOT NULL DEFAULT 'per_session' CHECK (payment_mode IN ('per_session','course_upfront','deposit_then_per_session')),
  course_price_cents INT,
  deposit_cents INT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','sent','accepted','declined','in_progress','completed','cancelled')),
  course_paid BOOLEAN NOT NULL DEFAULT false,
  deposit_paid BOOLEAN NOT NULL DEFAULT false,
  sent_at TIMESTAMPTZ,
  accepted_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.treatment_plans TO authenticated;
GRANT ALL ON public.treatment_plans TO service_role;
ALTER TABLE public.treatment_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "practitioner owns plans" ON public.treatment_plans
  FOR ALL USING (profile_id = auth.uid()) WITH CHECK (profile_id = auth.uid());
-- Patient reads their own plans via clinic_clients link
CREATE POLICY "patient reads own plans" ON public.treatment_plans
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.clinic_clients cc
      JOIN auth.users u ON u.id = auth.uid()
      WHERE cc.id = client_id
        AND (LOWER(cc.email) = LOWER(u.email) OR cc.phone = (u.raw_user_meta_data->>'phone'))
    )
  );

CREATE TABLE public.treatment_plan_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES public.treatment_plans(id) ON DELETE CASCADE,
  treatment_id UUID REFERENCES public.treatments(id) ON DELETE SET NULL,
  session_number INT NOT NULL,
  interval_weeks_from_previous INT,
  suggested_date DATE,
  appointment_id UUID REFERENCES public.appointments(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','booked','completed','skipped')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.treatment_plan_sessions TO authenticated;
GRANT ALL ON public.treatment_plan_sessions TO service_role;
ALTER TABLE public.treatment_plan_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "practitioner owns plan sessions" ON public.treatment_plan_sessions
  FOR ALL USING (EXISTS (SELECT 1 FROM public.treatment_plans p WHERE p.id = plan_id AND p.profile_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.treatment_plans p WHERE p.id = plan_id AND p.profile_id = auth.uid()));
CREATE POLICY "patient reads own plan sessions" ON public.treatment_plan_sessions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.treatment_plans p
      JOIN public.clinic_clients cc ON cc.id = p.client_id
      JOIN auth.users u ON u.id = auth.uid()
      WHERE p.id = plan_id
        AND (LOWER(cc.email) = LOWER(u.email) OR cc.phone = (u.raw_user_meta_data->>'phone'))
    )
  );

-- updated_at triggers
CREATE TRIGGER trg_tpt_updated BEFORE UPDATE ON public.treatment_plan_templates FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_tp_updated BEFORE UPDATE ON public.treatment_plans FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_tps_updated BEFORE UPDATE ON public.treatment_plan_sessions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_tp_client ON public.treatment_plans(client_id);
CREATE INDEX idx_tp_profile ON public.treatment_plans(profile_id);
CREATE INDEX idx_tps_plan ON public.treatment_plan_sessions(plan_id);
CREATE INDEX idx_tps_appt ON public.treatment_plan_sessions(appointment_id);
