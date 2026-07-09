DROP POLICY IF EXISTS "Authenticated can read hub codes" ON public.hub_codes;
DROP POLICY IF EXISTS "hub_codes_read_auth" ON public.hub_codes;

CREATE POLICY "Users can read their own hub code"
ON public.hub_codes
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.get_linked_hub_codes(p_user_ids uuid[])
RETURNS TABLE(user_id uuid, code text, owner_kind public.hub_owner_kind, display_name text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT hc.user_id, hc.code, hc.owner_kind, hc.display_name
  FROM public.hub_codes hc
  WHERE hc.user_id = ANY(p_user_ids)
    AND EXISTS (
      SELECT 1
      FROM public.hub_links hl
      WHERE hl.status IN ('pending', 'accepted')
        AND (
          (hl.requester_user_id = auth.uid() AND hl.recipient_user_id = hc.user_id)
          OR (hl.recipient_user_id = auth.uid() AND hl.requester_user_id = hc.user_id)
        )
    );
$$;

REVOKE ALL ON FUNCTION public.get_linked_hub_codes(uuid[]) FROM public;
GRANT EXECUTE ON FUNCTION public.get_linked_hub_codes(uuid[]) TO authenticated;