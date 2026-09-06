import { createFileRoute } from '@tanstack/react-router'

/**
 * Cron endpoint: daily nudge for clinic checks and audits that are due or
 * overdue. Sends one summary email per clinic plus an in-app notification,
 * respecting each template's remind_email / remind_in_app switches.
 *
 * Auth: verifies the Supabase anon apikey header (same as the other hooks).
 */
export const Route = createFileRoute('/api/public/hooks/compliance-reminders')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apikey = request.headers.get('apikey')
        const expected = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY
        if (!apikey || !expected || apikey !== expected) {
          return new Response('Unauthorized', { status: 401 })
        }

        const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
        const { tryEnqueueAppEmail, getPractitionerBranding } = await import('@/lib/email/send.server')
        const db = supabaseAdmin as any
        const origin = process.env.PUBLIC_APP_URL || process.env.APP_URL || 'https://modobook.uk'
        const today = new Date().toISOString().slice(0, 10)
        // Widest advance notice any clinic can set, so one query covers everyone.
        const horizon = new Date(Date.now() + 60 * 86400000).toISOString().slice(0, 10)
        const daysUntil = (iso: string) =>
          Math.round((new Date(iso + 'T00:00:00Z').getTime() - new Date(today + 'T00:00:00Z').getTime()) / 86400000)

        const [checksRes, auditsRes] = await Promise.all([
          db
            .from('compliance_check_templates')
            .select(
              'id, profile_id, name, next_due_on, remind_email, remind_in_app, remind_days_before, remind_when_overdue, active',
            )
            .eq('active', true)
            .not('next_due_on', 'is', null)
            .lte('next_due_on', horizon)
            .limit(2000),
          db
            .from('compliance_audit_templates')
            .select(
              'id, profile_id, name, next_due_on, remind_email, remind_in_app, remind_days_before, remind_when_overdue, active',
            )
            .eq('active', true)
            .not('next_due_on', 'is', null)
            .lte('next_due_on', horizon)
            .limit(2000),
        ])

        type Item = { name: string; dueOn: string; overdue: boolean; email: boolean; inApp: boolean }
        const byClinic = new Map<string, Item[]>()
        for (const r of [...(checksRes.data ?? []), ...(auditsRes.data ?? [])]) {
          const gap = daysUntil(r.next_due_on)
          const lead = Math.max(0, Number(r.remind_days_before ?? 0))
          // Not yet inside the advance-notice window for this item.
          if (gap > lead) continue
          // Overdue, but this item is set to remind on the due date only.
          if (gap < 0 && r.remind_when_overdue === false) continue
          const list = byClinic.get(r.profile_id) ?? []
          list.push({
            name: r.name,
            dueOn: r.next_due_on,
            overdue: r.next_due_on < today,
            email: r.remind_email !== false,
            inApp: r.remind_in_app !== false,
          })
          byClinic.set(r.profile_id, list)
        }

        let emails = 0
        let notifications = 0

        for (const [profileId, items] of byClinic) {
          const { data: profile } = await db
            .from('profiles')
            .select('id, email, clinic_name')
            .eq('id', profileId)
            .maybeSingle()
          if (!profile) continue

          const emailItems = items.filter((i) => i.email)
          if (emailItems.length && profile.email) {
            const branding = await getPractitionerBranding(profileId)
            const res = await tryEnqueueAppEmail({
              templateName: 'compliance-reminder',
              recipientEmail: profile.email,
              messageId: `compliance-${profileId}-${today}`,
              templateData: {
                profileId,
                clinicName: profile.clinic_name || branding.clinicName,
                logoUrl: branding.logoUrl,
                brandColor: branding.brandColor,
                items: emailItems.map((i) => ({ name: i.name, dueOn: i.dueOn, overdue: i.overdue })),
                dashboardUrl: `${origin}/dashboard/compliance`,
              },
            })
            if (res.ok) emails += 1
          }

          const inAppItems = items.filter((i) => i.inApp)
          if (inAppItems.length) {
            const overdue = inAppItems.filter((i) => i.overdue).length
            await db.rpc('create_notification', {
              p_profile_id: profileId,
              p_type: 'compliance_due',
              p_title: overdue ? `${overdue} check${overdue === 1 ? '' : 's'} overdue` : 'Checks due today',
              p_body: inAppItems
                .slice(0, 4)
                .map((i) => i.name)
                .join(', '),
              p_emoji: '🧾',
              p_link: '/dashboard/compliance',
              p_entity_id: null,
              p_entity_type: 'compliance',
            })
            notifications += 1
          }
        }

        return Response.json({ ok: true, clinics: byClinic.size, emails, notifications })
      },
    },
  },
})
