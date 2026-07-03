
-- push_subscriptions table
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_subscriptions TO authenticated;
GRANT ALL ON public.push_subscriptions TO service_role;

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own push subs" ON public.push_subscriptions;
CREATE POLICY "Users manage own push subs" ON public.push_subscriptions
  FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_push_subs_user ON public.push_subscriptions(user_id);

-- Dispatch trigger
CREATE OR REPLACE FUNCTION public.dispatch_notification_push()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cfg RECORD;
BEGIN
  SELECT url, secret INTO cfg FROM public.push_dispatch_config WHERE id = true;
  IF cfg.url IS NULL OR cfg.secret IS NULL OR cfg.secret = 'REPLACE_ME' THEN
    RETURN NEW;
  END IF;
  PERFORM net.http_post(
    url := cfg.url,
    headers := jsonb_build_object('Content-Type','application/json','x-push-secret', cfg.secret),
    body := jsonb_build_object('notification_id', NEW.id)
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notifications_dispatch_push ON public.notifications;
CREATE TRIGGER trg_notifications_dispatch_push
  AFTER INSERT ON public.notifications
  FOR EACH ROW EXECUTE FUNCTION public.dispatch_notification_push();
