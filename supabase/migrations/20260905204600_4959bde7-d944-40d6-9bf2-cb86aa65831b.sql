CREATE TABLE public.compliance_check_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name text NOT NULL,
  kind text NOT NULL DEFAULT 'custom',
  description text,
  frequency text NOT NULL DEFAULT 'daily',
  fields jsonb NOT NULL DEFAULT '[]'::jsonb,
  next_due_on date,
  remind_email boolean NOT NULL DEFAULT true,
  remind_in_app boolean NOT NULL DEFAULT true,
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.compliance_check_templates TO authenticated;
GRANT ALL ON public.compliance_check_templates TO service_role;
ALTER TABLE public.compliance_check_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Clinic staff manage check templates" ON public.compliance_check_templates
  FOR ALL TO authenticated USING (public.is_clinic_staff(profile_id)) WITH CHECK (public.is_clinic_staff(profile_id));

CREATE TABLE public.compliance_check_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  template_id uuid REFERENCES public.compliance_check_templates(id) ON DELETE SET NULL,
  template_name text NOT NULL,
  due_on date,
  performed_on date NOT NULL DEFAULT CURRENT_DATE,
  performed_by_user_id uuid,
  performed_by_name text,
  values jsonb NOT NULL DEFAULT '{}'::jsonb,
  issue_flagged boolean NOT NULL DEFAULT false,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.compliance_check_records TO authenticated;
GRANT ALL ON public.compliance_check_records TO service_role;
ALTER TABLE public.compliance_check_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Clinic staff manage check records" ON public.compliance_check_records
  FOR ALL TO authenticated USING (public.is_clinic_staff(profile_id)) WITH CHECK (public.is_clinic_staff(profile_id));

CREATE TABLE public.compliance_audit_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  category text,
  questions jsonb NOT NULL DEFAULT '[]'::jsonb,
  frequency text NOT NULL DEFAULT 'quarterly',
  next_due_on date,
  remind_email boolean NOT NULL DEFAULT true,
  remind_in_app boolean NOT NULL DEFAULT true,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.compliance_audit_templates TO authenticated;
GRANT ALL ON public.compliance_audit_templates TO service_role;
ALTER TABLE public.compliance_audit_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Clinic staff manage audit templates" ON public.compliance_audit_templates
  FOR ALL TO authenticated USING (public.is_clinic_staff(profile_id)) WITH CHECK (public.is_clinic_staff(profile_id));

CREATE TABLE public.compliance_audits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  template_id uuid REFERENCES public.compliance_audit_templates(id) ON DELETE SET NULL,
  name text NOT NULL,
  conducted_on date NOT NULL DEFAULT CURRENT_DATE,
  conducted_by_user_id uuid,
  conducted_by_name text,
  questions jsonb NOT NULL DEFAULT '[]'::jsonb,
  answers jsonb NOT NULL DEFAULT '{}'::jsonb,
  score_percent numeric,
  status text NOT NULL DEFAULT 'in_progress',
  summary text,
  signed_off_by_user_id uuid,
  signed_off_by_name text,
  signed_off_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.compliance_audits TO authenticated;
GRANT ALL ON public.compliance_audits TO service_role;
ALTER TABLE public.compliance_audits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Clinic staff manage audits" ON public.compliance_audits
  FOR ALL TO authenticated USING (public.is_clinic_staff(profile_id)) WITH CHECK (public.is_clinic_staff(profile_id));

CREATE TABLE public.compliance_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  audit_id uuid REFERENCES public.compliance_audits(id) ON DELETE CASCADE,
  check_record_id uuid REFERENCES public.compliance_check_records(id) ON DELETE CASCADE,
  description text NOT NULL,
  owner_name text,
  due_on date,
  status text NOT NULL DEFAULT 'open',
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.compliance_actions TO authenticated;
GRANT ALL ON public.compliance_actions TO service_role;
ALTER TABLE public.compliance_actions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Clinic staff manage compliance actions" ON public.compliance_actions
  FOR ALL TO authenticated USING (public.is_clinic_staff(profile_id)) WITH CHECK (public.is_clinic_staff(profile_id));

CREATE INDEX idx_compliance_check_templates_profile ON public.compliance_check_templates(profile_id);
CREATE INDEX idx_compliance_check_records_profile ON public.compliance_check_records(profile_id, performed_on DESC);
CREATE INDEX idx_compliance_audit_templates_profile ON public.compliance_audit_templates(profile_id);
CREATE INDEX idx_compliance_audits_profile ON public.compliance_audits(profile_id, conducted_on DESC);
CREATE INDEX idx_compliance_actions_profile ON public.compliance_actions(profile_id, status);

CREATE TRIGGER trg_compliance_check_templates_updated BEFORE UPDATE ON public.compliance_check_templates FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_compliance_check_records_updated BEFORE UPDATE ON public.compliance_check_records FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_compliance_audit_templates_updated BEFORE UPDATE ON public.compliance_audit_templates FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_compliance_audits_updated BEFORE UPDATE ON public.compliance_audits FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_compliance_actions_updated BEFORE UPDATE ON public.compliance_actions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
