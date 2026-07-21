
CREATE TABLE public.prescriber_billing_practitioners (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  prescriber_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  clinic_name TEXT,
  email TEXT NOT NULL,
  phone TEXT,
  address_lines TEXT[] NOT NULL DEFAULT '{}',
  default_rate_cents INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX prescriber_billing_practitioners_owner_idx ON public.prescriber_billing_practitioners (prescriber_user_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.prescriber_billing_practitioners TO authenticated;
GRANT ALL ON public.prescriber_billing_practitioners TO service_role;
ALTER TABLE public.prescriber_billing_practitioners ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Prescriber owns directory" ON public.prescriber_billing_practitioners
  FOR ALL USING (auth.uid() = prescriber_user_id) WITH CHECK (auth.uid() = prescriber_user_id);

CREATE TABLE public.prescriber_invoices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  prescriber_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  practitioner_id UUID NOT NULL REFERENCES public.prescriber_billing_practitioners(id) ON DELETE RESTRICT,
  invoice_number TEXT NOT NULL,
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  subtotal_cents INTEGER NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'gbp',
  status TEXT NOT NULL DEFAULT 'draft',
  stripe_payment_link_id TEXT,
  stripe_url TEXT,
  notes TEXT,
  due_date DATE,
  sent_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (prescriber_user_id, invoice_number)
);
CREATE INDEX prescriber_invoices_owner_idx ON public.prescriber_invoices (prescriber_user_id, created_at DESC);
CREATE INDEX prescriber_invoices_practitioner_idx ON public.prescriber_invoices (practitioner_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.prescriber_invoices TO authenticated;
GRANT ALL ON public.prescriber_invoices TO service_role;
ALTER TABLE public.prescriber_invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Prescriber owns invoices" ON public.prescriber_invoices
  FOR ALL USING (auth.uid() = prescriber_user_id) WITH CHECK (auth.uid() = prescriber_user_id);

CREATE TRIGGER prescriber_billing_practitioners_updated
  BEFORE UPDATE ON public.prescriber_billing_practitioners
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER prescriber_invoices_updated
  BEFORE UPDATE ON public.prescriber_invoices
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
