import { createFileRoute } from '@tanstack/react-router'

/**
 * Cron endpoint: sweep every practitioner whose account currently has no
 * access and re-check Stripe for a live subscription. Missed webhooks used to
 * leave paying practitioners locked out until they happened to open the
 * dashboard; this heals them automatically for everyone.
 *
 * Auth: verifies the Supabase anon apikey header (same pattern as the other
 * public cron endpoints in this project).
 */
export const Route = createFileRoute('/api/public/hooks/billing-reconcile')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apikey = request.headers.get('apikey')
        const expected = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY
        if (!apikey || !expected || apikey !== expected) {
          return new Response('Unauthorized', { status: 401 })
        }

        const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
        const { reconcileSubscriptionFromStripe } = await import('@/lib/billing-reconcile.server')

        // Candidates: practitioners whose subscription row is missing/expired.
        const { data: profiles, error } = await supabaseAdmin
          .from('profiles')
          .select('id, email')
          .limit(2000)
        if (error) return new Response(error.message, { status: 500 })

        let checked = 0
        let healed = 0
        for (const p of profiles ?? []) {
          const { data: statusRow } = await supabaseAdmin.rpc('practitioner_billing_status', {
            _profile_id: p.id,
          })
          const row: any = Array.isArray(statusRow) ? statusRow[0] : statusRow
          if (row?.has_access) continue
          checked++
          const ok = await reconcileSubscriptionFromStripe(supabaseAdmin, p.id, p.email)
          if (ok) healed++
        }

        return Response.json({ ok: true, checked, healed })
      },
    },
  },
})
