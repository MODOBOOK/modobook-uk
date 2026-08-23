
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS whatsapp_notify_confirmation boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS whatsapp_notify_reminder boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS whatsapp_notify_cancellation boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS whatsapp_notify_rebook boolean NOT NULL DEFAULT true;

ALTER TABLE public.clinic_clients
  ADD COLUMN IF NOT EXISTS whatsapp_opt_out boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.whatsapp_send_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  appointment_id uuid,
  kind text NOT NULL,
  to_phone text NOT NULL,
  message_key text NOT NULL UNIQUE,
  body text,
  status text NOT NULL DEFAULT 'queued',
  provider_sid text,
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS whatsapp_send_log_profile_idx ON public.whatsapp_send_log (profile_id, created_at DESC);

GRANT SELECT ON public.whatsapp_send_log TO authenticated;
GRANT ALL ON public.whatsapp_send_log TO service_role;

ALTER TABLE public.whatsapp_send_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Practitioners view own whatsapp log" ON public.whatsapp_send_log;
CREATE POLICY "Practitioners view own whatsapp log"
ON public.whatsapp_send_log FOR SELECT TO authenticated
USING (profile_id = public._profile_id_for_user(auth.uid()));
