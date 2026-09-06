ALTER TABLE public.compliance_check_templates
  ADD COLUMN IF NOT EXISTS custom_interval_days integer,
  ADD COLUMN IF NOT EXISTS remind_days_before integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS remind_when_overdue boolean NOT NULL DEFAULT true;

ALTER TABLE public.compliance_audit_templates
  ADD COLUMN IF NOT EXISTS custom_interval_days integer,
  ADD COLUMN IF NOT EXISTS remind_days_before integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS remind_when_overdue boolean NOT NULL DEFAULT true;