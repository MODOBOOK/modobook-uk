-- Lock down storage objects in prescriber-ids
DROP POLICY IF EXISTS "prescriber_ids_owner_select" ON storage.objects;
CREATE POLICY "prescriber_ids_owner_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'prescriber-ids'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR public.has_role(auth.uid(), 'admin')
    )
  );

DROP POLICY IF EXISTS "prescriber_ids_owner_insert" ON storage.objects;
CREATE POLICY "prescriber_ids_owner_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'prescriber-ids'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "prescriber_ids_owner_update" ON storage.objects;
CREATE POLICY "prescriber_ids_owner_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'prescriber-ids'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "prescriber_ids_owner_delete" ON storage.objects;
CREATE POLICY "prescriber_ids_owner_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'prescriber-ids'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR public.has_role(auth.uid(), 'admin')
    )
  );

-- Restrict hub helpers from anonymous callers (linter hygiene)
REVOKE EXECUTE ON FUNCTION public.ensure_hub_code(TEXT, TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.resolve_hub_code(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ensure_hub_code(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_hub_code(TEXT) TO authenticated;