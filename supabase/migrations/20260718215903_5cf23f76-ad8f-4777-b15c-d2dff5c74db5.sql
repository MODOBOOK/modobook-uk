
CREATE TABLE public.platform_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  stripe_invoice_id TEXT NOT NULL UNIQUE,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  number TEXT,
  status TEXT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'gbp',
  amount_due_cents INTEGER NOT NULL DEFAULT 0,
  amount_paid_cents INTEGER NOT NULL DEFAULT 0,
  amount_remaining_cents INTEGER NOT NULL DEFAULT 0,
  attempt_count INTEGER NOT NULL DEFAULT 0,
  hosted_invoice_url TEXT,
  invoice_pdf TEXT,
  period_start TIMESTAMPTZ,
  period_end TIMESTAMPTZ,
  due_date TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  last_payment_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX platform_invoices_profile_idx ON public.platform_invoices(profile_id, created_at DESC);
CREATE INDEX platform_invoices_status_idx ON public.platform_invoices(status);

GRANT SELECT ON public.platform_invoices TO authenticated;
GRANT ALL ON public.platform_invoices TO service_role;

ALTER TABLE public.platform_invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner reads own invoices" ON public.platform_invoices
  FOR SELECT TO authenticated
  USING (public.is_profile_owner(profile_id));

CREATE POLICY "Admins read all invoices" ON public.platform_invoices
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_platform_invoices_updated_at
  BEFORE UPDATE ON public.platform_invoices
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
