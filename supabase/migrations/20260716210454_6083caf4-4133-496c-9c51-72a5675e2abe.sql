
-- Marketing tables reference profiles(id) via practitioner_id, but their RLS
-- policies incorrectly compared practitioner_id to auth.uid(). Since profile.id
-- is distinct from auth.uid(), inserts failed the FK and reads returned nothing.
-- Rewrite policies to use profile ownership + clinic-staff access.

DROP POLICY IF EXISTS "practitioner manages own campaigns" ON public.marketing_campaigns;
CREATE POLICY "practitioner manages own campaigns"
  ON public.marketing_campaigns FOR ALL TO authenticated
  USING (public.is_profile_owner(practitioner_id) OR public.is_clinic_staff(practitioner_id))
  WITH CHECK (public.is_profile_owner(practitioner_id) OR public.is_clinic_staff(practitioner_id));

DROP POLICY IF EXISTS "practitioner manages own segments" ON public.marketing_segments;
CREATE POLICY "practitioner manages own segments"
  ON public.marketing_segments FOR ALL TO authenticated
  USING (public.is_profile_owner(practitioner_id) OR public.is_clinic_staff(practitioner_id))
  WITH CHECK (public.is_profile_owner(practitioner_id) OR public.is_clinic_staff(practitioner_id));

DROP POLICY IF EXISTS "practitioner manages own templates" ON public.marketing_templates;
CREATE POLICY "practitioner manages own templates"
  ON public.marketing_templates FOR ALL TO authenticated
  USING (public.is_profile_owner(practitioner_id) OR public.is_clinic_staff(practitioner_id))
  WITH CHECK (public.is_profile_owner(practitioner_id) OR public.is_clinic_staff(practitioner_id));

DROP POLICY IF EXISTS "practitioner reads own campaign recipients" ON public.marketing_campaign_recipients;
CREATE POLICY "practitioner manages own campaign recipients"
  ON public.marketing_campaign_recipients FOR ALL TO authenticated
  USING (public.is_profile_owner(practitioner_id) OR public.is_clinic_staff(practitioner_id))
  WITH CHECK (public.is_profile_owner(practitioner_id) OR public.is_clinic_staff(practitioner_id));
