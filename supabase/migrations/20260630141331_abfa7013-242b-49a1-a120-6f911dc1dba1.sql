
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS invoice_bank_name text,
  ADD COLUMN IF NOT EXISTS invoice_account_name text,
  ADD COLUMN IF NOT EXISTS invoice_sort_code text,
  ADD COLUMN IF NOT EXISTS invoice_account_number text,
  ADD COLUMN IF NOT EXISTS invoice_iban text,
  ADD COLUMN IF NOT EXISTS invoice_swift text,
  ADD COLUMN IF NOT EXISTS invoice_payment_reference text,
  ADD COLUMN IF NOT EXISTS invoice_footer_notes text,
  ADD COLUMN IF NOT EXISTS invoice_vat_number text,
  ADD COLUMN IF NOT EXISTS invoice_company_number text,
  ADD COLUMN IF NOT EXISTS invoice_show_bank_details boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS invoice_show_logo boolean NOT NULL DEFAULT true;
