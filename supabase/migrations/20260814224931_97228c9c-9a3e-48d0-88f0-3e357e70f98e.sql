CREATE TABLE public.patient_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  client_id uuid REFERENCES public.clinic_clients(id) ON DELETE SET NULL,
  invoice_number text NOT NULL,
  recipient_name text,
  recipient_email text,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  subtotal_cents integer NOT NULL DEFAULT 0,
  fee_cents integer NOT NULL DEFAULT 0,
  include_fees boolean NOT NULL DEFAULT true,
  currency text NOT NULL DEFAULT 'gbp',
  status text NOT NULL DEFAULT 'draft',
  notes text,
  due_date date,
  payment_link_id uuid,
  payment_link text,
  pdf_url text,
  sent_at timestamptz,
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX patient_invoices_client_idx ON public.patient_invoices (client_id, created_at DESC);
CREATE INDEX patient_invoices_profile_idx ON public.patient_invoices (profile_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.patient_invoices TO authenticated;
GRANT ALL ON public.patient_invoices TO service_role;

ALTER TABLE public.patient_invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clinic owners manage their patient invoices"
ON public.patient_invoices FOR ALL TO authenticated
USING (profile_id = public._profile_id_for_user(auth.uid()))
WITH CHECK (profile_id = public._profile_id_for_user(auth.uid()));

CREATE TRIGGER update_patient_invoices_updated_at
BEFORE UPDATE ON public.patient_invoices
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();