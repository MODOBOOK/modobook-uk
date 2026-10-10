UPDATE public.consent_templates
SET body_markdown = 'I, the patient named on this form, confirm that the treatment has been fully explained to me, including the risks, benefits and alternatives. I have had the opportunity to ask questions and I consent to proceed.',
    updated_at = now()
WHERE name = 'Consultation consent' AND is_system = false
  AND body_markdown ~ '^I, .*, confirm that the treatment has been fully explained';