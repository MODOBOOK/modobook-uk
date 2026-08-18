CREATE POLICY "Practitioners manage own leaflet files"
ON storage.objects FOR ALL TO authenticated
USING (
  bucket_id = 'treatment-leaflets'
  AND (storage.foldername(name))[1] = (
    SELECT p.id::text FROM public.profiles p WHERE p.user_id = auth.uid()
  )
)
WITH CHECK (
  bucket_id = 'treatment-leaflets'
  AND (storage.foldername(name))[1] = (
    SELECT p.id::text FROM public.profiles p WHERE p.user_id = auth.uid()
  )
);