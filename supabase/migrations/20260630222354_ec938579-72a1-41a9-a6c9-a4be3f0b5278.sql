
-- prescriber-ids storage RLS: path prefix = "{user_id}/..."
CREATE POLICY "Prescriber upload own ID"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'prescriber-ids'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Prescriber read own ID"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'prescriber-ids'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR public.has_role(auth.uid(),'admin')
    )
  );

CREATE POLICY "Prescriber replace own ID"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'prescriber-ids'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Prescriber delete own ID"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'prescriber-ids'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
