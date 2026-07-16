CREATE TABLE public.admin_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  target_profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  action text NOT NULL,
  reason text,
  diff jsonb,
  ip_hash text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.admin_audit_log TO authenticated;
GRANT ALL ON public.admin_audit_log TO service_role;

ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins read audit log"
  ON public.admin_audit_log
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admins insert audit log"
  ON public.admin_audit_log
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    AND actor_user_id = auth.uid()
  );

CREATE INDEX admin_audit_log_created_at_idx
  ON public.admin_audit_log (created_at DESC);

CREATE INDEX admin_audit_log_target_idx
  ON public.admin_audit_log (target_profile_id, created_at DESC);

CREATE INDEX admin_audit_log_actor_idx
  ON public.admin_audit_log (actor_user_id, created_at DESC);

CREATE INDEX admin_audit_log_action_idx
  ON public.admin_audit_log (action, created_at DESC);