import { createFileRoute } from '@tanstack/react-router'
import { processScheduledCampaigns } from '@/lib/marketing.functions'

// Called by pg_cron every minute. Auth: caller must present the Supabase
// anon key in the `apikey` header (matches the pg_cron config).
export const Route = createFileRoute('/api/public/hooks/marketing-dispatch')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const expected = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY
        const provided = request.headers.get('apikey') || request.headers.get('x-api-key')
        if (!expected || !provided || provided !== expected) {
          return new Response(JSON.stringify({ error: 'Unauthorized' }), {
            status: 401, headers: { 'Content-Type': 'application/json' },
          })
        }
        try {
          const result = await processScheduledCampaigns()
          return Response.json({ ok: true, ...result })
        } catch (e) {
          return new Response(JSON.stringify({ ok: false, error: e instanceof Error ? e.message : String(e) }), {
            status: 500, headers: { 'Content-Type': 'application/json' },
          })
        }
      },
    },
  },
})
