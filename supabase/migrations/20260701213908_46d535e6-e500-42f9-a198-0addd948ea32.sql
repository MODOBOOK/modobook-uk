
UPDATE public.medical_form_templates
SET schema = jsonb_set(
  schema,
  '{steps}',
  (
    SELECT jsonb_agg(
      CASE
        WHEN step->>'id' = 's_pregnancy_lifestyle' THEN
          jsonb_set(
            step,
            '{elements}',
            (
              SELECT jsonb_agg(
                CASE
                  WHEN el->>'id' = 'pregnant'
                    THEN jsonb_set(el, '{options}', '["Yes","No"]'::jsonb)
                  ELSE el
                END
              )
              FROM jsonb_array_elements(step->'elements') el
              WHERE el->>'id' <> 'trying_conceive'
            )
          )
        ELSE step
      END
    )
    FROM jsonb_array_elements(schema->'steps') step
  )
)
WHERE id = 'dfd1a94d-cff1-4428-b466-739e0b0e684e';
