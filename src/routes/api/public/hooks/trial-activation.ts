import { createFileRoute } from '@tanstack/react-router'

/**
 * Daily: subscription activation reminders for accounts created on/after the
 * terms change (17 Oct 2026). Emails clinics 3 days before trial end, on the
 * day it ends, and 5 days after; on day 7 emails the MODO admin a closure list.
 * Never closes accounts itself.
 */
const TERMS_FROM = '2026-10-17'
const ADMIN_EMAIL = 'bynurseryan@outlook.com'
const LIVE = ['active', 'trialing', 'past_due']

export const Route = createFileRoute('/api/public/hooks/trial-activation')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!(await (await import('@/lib/cron-auth.server')).isAuthorizedCron(request))) {
          return new Response('Unauthorized', { status: 401 })
        }
        const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
        const { tryEnqueueAppEmail } = await import('@/lib/email/send.server')
        const db = supabaseAdmin as any
        const origin = process.env.PUBLIC_APP_URL || 'https://modobook.uk'

        const ukDate = (d: Date) => d.toLocaleDateString('en-CA', { timeZone: 'Europe/London' })
        const label = (iso: string) =>
          new Date(iso + 'T12:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })
        const addDays = (iso: string, n: number) =>
          new Date(new Date(iso + 'T12:00:00Z').getTime() + n * 86400000).toISOString().slice(0, 10)
        const today = ukDate(new Date())

        const { data: subs } = await db
          .from('practitioner_subscriptions')
          .select('profile_id, status, comped, trial_end, stripe_subscription_id')
          .not('trial_end', 'is', null)
          .limit(5000)

        let sent = 0
        const toClose: { name: string; email: string; trialEnd: string }[] = []

        for (const s of subs ?? []) {
          if (s.comped) continue
          if (s.stripe_subscription_id && LIVE.includes(String(s.status))) continue
          const end = ukDate(new Date(s.trial_end))
          const offset = Math.round(
            (new Date(today + 'T12:00:00Z').getTime() - new Date(end + 'T12:00:00Z').getTime()) / 86400000,
          )
          const stage = offset === -3 ? 'before' : offset === 0 ? 'ended' : offset === 5 ? 'final' : offset === 7 ? 'list' : null
          if (!stage) continue

          const { data: p } = await db
            .from('profiles')
            .select('id, email, clinic_name, created_at, is_demo')
            .eq('id', s.profile_id)
            .maybeSingle()
          if (!p?.email || p.is_demo) continue
          if (ukDate(new Date(p.created_at)) < TERMS_FROM) continue

          if (stage === 'list') {
            toClose.push({ name: p.clinic_name || p.email, email: p.email, trialEnd: label(end) })
            continue
          }
          const res = await tryEnqueueAppEmail({
            templateName: 'trial-activation',
            recipientEmail: p.email,
            messageId: `trial-${stage}-${p.id}-${end}`,
            templateData: {
              stage,
              clinicName: p.clinic_name || 'there',
              trialEndLabel: label(end),
              closeOnLabel: label(addDays(end, 7)),
              billingUrl: `${origin}/dashboard/billing`,
            },
          })
          if (res.ok) sent += 1
        }

        if (toClose.length) {
          await tryEnqueueAppEmail({
            templateName: 'trial-closure-list',
            recipientEmail: ADMIN_EMAIL,
            messageId: `trial-closure-list-${today}`,
            templateData: { clinics: toClose },
          })
        }
        return Response.json({ ok: true, sent, closureList: toClose.length })
      },
    },
  },
})
