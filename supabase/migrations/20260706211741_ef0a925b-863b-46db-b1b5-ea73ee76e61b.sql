
DROP POLICY IF EXISTS "practitioner owns plans" ON public.treatment_plans;
CREATE POLICY "practitioner owns plans" ON public.treatment_plans
  FOR ALL TO authenticated
  USING (public.is_profile_owner(profile_id))
  WITH CHECK (public.is_profile_owner(profile_id));

DROP POLICY IF EXISTS "practitioner owns plan sessions" ON public.treatment_plan_sessions;
CREATE POLICY "practitioner owns plan sessions" ON public.treatment_plan_sessions
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.treatment_plans p WHERE p.id = treatment_plan_sessions.plan_id AND public.is_profile_owner(p.profile_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.treatment_plans p WHERE p.id = treatment_plan_sessions.plan_id AND public.is_profile_owner(p.profile_id)));

DROP POLICY IF EXISTS "practitioner owns templates" ON public.treatment_plan_templates;
CREATE POLICY "practitioner owns templates" ON public.treatment_plan_templates
  FOR ALL TO authenticated
  USING (public.is_profile_owner(profile_id))
  WITH CHECK (public.is_profile_owner(profile_id));

DROP POLICY IF EXISTS "practitioner owns template items" ON public.treatment_plan_template_items;
CREATE POLICY "practitioner owns template items" ON public.treatment_plan_template_items
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.treatment_plan_templates t WHERE t.id = treatment_plan_template_items.template_id AND public.is_profile_owner(t.profile_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.treatment_plan_templates t WHERE t.id = treatment_plan_template_items.template_id AND public.is_profile_owner(t.profile_id)));
