UPDATE public.treatments
SET active = true, category_id = '4cf37a44-54f7-405a-9210-7e8aa7bb9ba5'
WHERE id IN (
  '14170e2a-099b-48d0-a640-2a750cf508ec',
  'e22c0ba7-11df-43e3-ba9c-ed2aea3ec32d',
  'ddcfc813-b904-43a8-a462-3842e33c477f',
  '7ec6098b-dfcc-40e7-8ac9-54fcef022ccd'
);

DELETE FROM public.treatment_categories WHERE id = '1b24d897-00af-4abd-b711-65a3730e2891';