// Cron endpoint: once per day, sends each practitioner a notification
// summarising how many appointments they have tomorrow. Push delivery
// happens automatically via the AFTER INSERT trigger on notifications.
// Idempotent per (profile_id, tomorrow's date) via a notification link tag.
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/api/public/hooks/daily-schedule-digest')({
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
          const { supabaseAdmin } = await import('@/integrations/supabase/client.server')

          // "Tomorrow" in UK local time. The cron is scheduled to run in the
          // evening UK-time, so the next calendar day matches the practitioner's
          // expectation regardless of BST/GMT.
          const now = new Date()
          const ukParts = new Intl.DateTimeFormat('en-CA', {
            timeZone: 'Europe/London',
            year: 'numeric', month: '2-digit', day: '2-digit',
          }).formatToParts(now)
          const y = Number(ukParts.find(p => p.type === 'year')!.value)
          const m = Number(ukParts.find(p => p.type === 'month')!.value)
          const d = Number(ukParts.find(p => p.type === 'day')!.value)
          const tomorrow = new Date(Date.UTC(y, m - 1, d + 1))
          const tomorrowDate = tomorrow.toISOString().slice(0, 10)
          const tag = `#digest-${tomorrowDate}`

          // Fetch all appointments for tomorrow that count as booked
          const { data: appts, error: apptErr } = await supabaseAdmin
            .from('appointments')
            .select('profile_id, patient_name, start_time, treatments(name)')
            .eq('scheduled_date', tomorrowDate)
            .in('status', ['confirmed', 'pending'])
            .order('start_time', { ascending: true })

          if (apptErr) throw apptErr

          if (!appts || appts.length === 0) {
            return Response.json({ ok: true, digests: 0, note: 'no appointments tomorrow' })
          }

          // Group by practitioner profile
          const byProfile = new Map<string, Array<any>>()
          for (const a of appts as any[]) {
            if (!a.profile_id) continue
            const list = byProfile.get(a.profile_id) ?? []
            list.push(a)
            byProfile.set(a.profile_id, list)
          }

          const humanDate = new Date(tomorrowDate + 'T12:00:00Z').toLocaleDateString('en-GB', {
            weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/London',
          })

          let created = 0
          for (const [profileId, list] of byProfile.entries()) {
            // Skip if we've already sent today's digest for this profile
            const { data: existing } = await supabaseAdmin
              .from('notifications')
              .select('id')
              .eq('profile_id', profileId)
              .eq('type', 'daily_digest')
              .like('link', `%${tag}`)
              .limit(1)
              .maybeSingle()
            if (existing) continue

            const count = list.length
            const first = list[0]
            const firstTime = (first?.start_time || '').slice(0, 5)
            const title = count === 1
              ? `1 appointment tomorrow`
              : `${count} appointments tomorrow`
            const body = count === 1 && first
              ? `${humanDate} — ${first.patient_name || 'A client'} at ${firstTime}`
              : `${humanDate} — first one at ${firstTime}`

            const { error: insErr } = await supabaseAdmin.from('notifications').insert({
              profile_id: profileId,
              type: 'daily_digest',
              title,
              body,
              emoji: '📅',
              link: `/dashboard/calendar${tag}`,
              entity_type: 'appointment_digest',
            })
            if (insErr) {
              console.error('[daily-digest] insert failed', profileId, insErr)
              continue
            }
            created++
          }

          return Response.json({ ok: true, digests: created, date: tomorrowDate })
        } catch (err) {
          console.error('[daily-digest] error', err)
          return new Response(JSON.stringify({ error: (err as Error).message }), {
            status: 500, headers: { 'Content-Type': 'application/json' },
          })
        }
      },
    },
  },
})
