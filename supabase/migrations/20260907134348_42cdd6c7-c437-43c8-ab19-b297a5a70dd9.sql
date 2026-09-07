ALTER TABLE public.membership_plans ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;

WITH ranked AS (
  SELECT id, row_number() OVER (PARTITION BY profile_id ORDER BY created_at) - 1 AS rn
  FROM public.membership_plans
)
UPDATE public.membership_plans p
SET sort_order = ranked.rn
FROM ranked
WHERE ranked.id = p.id;