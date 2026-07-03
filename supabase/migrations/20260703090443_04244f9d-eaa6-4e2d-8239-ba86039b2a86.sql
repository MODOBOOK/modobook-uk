
-- Config table holding the push dispatch URL + shared secret (single row).
CREATE TABLE public.push_dispatch_config (
  id boolean PRIMARY KEY DEFAULT true,
  url text NOT NULL,
  secret text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT single_row CHECK (id = true)
);

GRANT ALL ON public.push_dispatch_config TO service_role;
ALTER TABLE public.push_dispatch_config ENABLE ROW LEVEL SECURITY;
-- No policies: only service_role (bypasses RLS) and SECURITY DEFINER functions can read/write.

-- Rewrite the trigger fn to read config from the table.
CREATE OR REPLACE FUNCTION public.notify_dispatch_push()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, net
AS $$
DECLARE
  v_cfg RECORD;
BEGIN
  SELECT url, secret INTO v_cfg FROM public.push_dispatch_config WHERE id = true;
  IF NOT FOUND OR v_cfg.url IS NULL OR v_cfg.url = '' THEN
    RETURN NEW;
  END IF;
  PERFORM net.http_post(
    url := v_cfg.url,
    body := jsonb_build_object('notification_id', NEW.id::text),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-push-secret', v_cfg.secret
    )
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$;
