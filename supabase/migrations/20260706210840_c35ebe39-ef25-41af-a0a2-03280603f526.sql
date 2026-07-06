
GRANT SELECT, INSERT, UPDATE, DELETE ON public.treatment_plans TO authenticated;
GRANT ALL ON public.treatment_plans TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.treatment_plan_sessions TO authenticated;
GRANT ALL ON public.treatment_plan_sessions TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.treatment_plan_templates TO authenticated;
GRANT ALL ON public.treatment_plan_templates TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.treatment_plan_template_items TO authenticated;
GRANT ALL ON public.treatment_plan_template_items TO service_role;
