ALTER TABLE public.packages ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;
WITH ranked AS (
  SELECT id, row_number() OVER (PARTITION BY profile_id ORDER BY created_at) - 1 AS rn
  FROM public.packages
)
UPDATE public.packages p SET sort_order = r.rn FROM ranked r WHERE r.id = p.id;