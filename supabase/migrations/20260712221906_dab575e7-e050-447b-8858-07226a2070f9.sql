-- 1. Pin search_path on the pgmq email-queue helpers (linter WARN 0011)
ALTER FUNCTION public.enqueue_email(text, jsonb) SET search_path = public, pgmq;
ALTER FUNCTION public.read_email_batch(text, integer, integer) SET search_path = public, pgmq;
ALTER FUNCTION public.delete_email(text, bigint) SET search_path = public, pgmq;
ALTER FUNCTION public.move_to_dlq(text, text, bigint, jsonb) SET search_path = public, pgmq;

-- 2. push_dispatch_config: RLS is on but had no policy (linter INFO 0008).
-- The table is only ever read by service-role code (which bypasses RLS).
-- Add an explicit deny-all policy so the linter sees the intent clearly.
DROP POLICY IF EXISTS "No client access to push_dispatch_config" ON public.push_dispatch_config;
CREATE POLICY "No client access to push_dispatch_config"
  ON public.push_dispatch_config
  FOR ALL
  TO authenticated, anon
  USING (false)
  WITH CHECK (false);