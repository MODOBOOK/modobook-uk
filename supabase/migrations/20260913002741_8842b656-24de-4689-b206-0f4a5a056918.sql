CREATE TABLE IF NOT EXISTS public.email_rate_window (
  id integer PRIMARY KEY DEFAULT 1,
  window_start timestamptz NOT NULL DEFAULT date_trunc('minute', now()),
  sent_count integer NOT NULL DEFAULT 0,
  max_per_minute integer NOT NULL DEFAULT 60,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT email_rate_window_singleton CHECK (id = 1)
);

GRANT ALL ON public.email_rate_window TO service_role;

ALTER TABLE public.email_rate_window ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view email rate window" ON public.email_rate_window;
CREATE POLICY "Admins can view email rate window"
ON public.email_rate_window
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.email_rate_window (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.claim_email_slots(p_requested integer)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now timestamptz := now();
  v_bucket timestamptz := date_trunc('minute', v_now);
  v_row public.email_rate_window%ROWTYPE;
  v_available integer;
  v_granted integer;
BEGIN
  IF p_requested IS NULL OR p_requested <= 0 THEN
    RETURN 0;
  END IF;

  SELECT * INTO v_row FROM public.email_rate_window WHERE id = 1 FOR UPDATE;
  IF NOT FOUND THEN
    INSERT INTO public.email_rate_window (id, window_start, sent_count)
    VALUES (1, v_bucket, 0)
    RETURNING * INTO v_row;
  END IF;

  IF v_row.window_start < v_bucket THEN
    v_row.window_start := v_bucket;
    v_row.sent_count := 0;
  END IF;

  v_available := GREATEST(v_row.max_per_minute - v_row.sent_count, 0);
  v_granted := LEAST(p_requested, v_available);

  UPDATE public.email_rate_window
  SET window_start = v_row.window_start,
      sent_count = v_row.sent_count + v_granted,
      updated_at = v_now
  WHERE id = 1;

  RETURN v_granted;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_email_slots(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_email_slots(integer) TO service_role;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS update_email_rate_window_updated_at ON public.email_rate_window;
CREATE TRIGGER update_email_rate_window_updated_at
BEFORE UPDATE ON public.email_rate_window
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();