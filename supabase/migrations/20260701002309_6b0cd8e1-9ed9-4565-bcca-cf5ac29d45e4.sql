UPDATE public.pretreatment_templates
SET name = regexp_replace(name, '\s*\(Botox\s*/\s*Filler\)\s*', '', 'gi')
WHERE name ILIKE '%botox%';

UPDATE public.pretreatment_templates
SET name = regexp_replace(name, 'Botox', 'Injectables', 'gi'),
    summary = regexp_replace(coalesce(summary,''), 'Botox', 'injectables', 'gi'),
    body_html = regexp_replace(coalesce(body_html,''), 'Botox', 'injectables', 'gi')
WHERE name ILIKE '%botox%' OR summary ILIKE '%botox%' OR body_html ILIKE '%botox%';