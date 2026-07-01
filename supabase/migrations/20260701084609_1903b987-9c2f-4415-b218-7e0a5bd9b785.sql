UPDATE public.platform_terms
SET body_markdown = replace(
  replace(
    body_markdown,
    'These Terms are governed by the laws of **England and Wales**. The courts of England and Wales have exclusive jurisdiction over any dispute, except that MODO may bring proceedings against you in the courts of the country where you are established or where the breach occurred.',
    'These Terms are governed by the laws of **Scotland**. The courts of Scotland have exclusive jurisdiction over any dispute, except that MODO may bring proceedings against you in the courts of the country where you are established or where the breach occurred.'
  ),
  'MODO BOOK',
  'MODO'
)
WHERE is_active = true;
