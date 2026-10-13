// Cron route — hourly pg_cron POSTs here to fire enabled marketing automations
// (birthday, treatment-interval, win-back, monthly newsletter, custom recurring).
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/api/public/hooks/marketing-automations')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!(await (await import('@/lib/cron-auth.server')).isAuthorizedCron(request))) {
          return new Response('Unauthorized', { status: 401 })
        }
        const { processAutomations } = await import('@/lib/marketing.functions')
        const result = await processAutomations()
        return Response.json(result)
      },
      GET: async () => Response.json({ ok: true, endpoint: 'marketing-automations' }),
    },
  },
})
