// Cron route — every 5 min pg_cron POSTs here to fire scheduled campaigns.
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/api/public/hooks/marketing-dispatch')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apiKey = request.headers.get('apikey') || request.headers.get('Apikey')
        const expected = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY
        if (!expected || apiKey !== expected) {
          return new Response('Unauthorized', { status: 401 })
        }
        const { processScheduledCampaigns } = await import('@/lib/marketing.functions')
        const result = await processScheduledCampaigns()
        return Response.json(result)
      },
      GET: async () => Response.json({ ok: true, endpoint: 'marketing-dispatch' }),
    },
  },
})
