import { createFileRoute } from '@tanstack/react-router'

/**
 * Cron endpoint: send review-request emails for appointments whose end time
 * has passed and haven't already had a review email sent.
 *
 * Auth: verifies the Supabase anon apikey header (same pattern as other public
 * cron endpoints in this project).
 */
export const Route = createFileRoute('/api/public/hooks/review-emails')({
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

        const now = new Date()
        // Look back 24h so we don't email months-old appointments if the cron was down
        const lookbackIso = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
        const todayIso = now.toISOString().slice(0, 10)
        const nowTime = now.toISOString().slice(11, 16)

        // Fetch candidate appointments: status confirmed, has patient_email,
        // scheduled_date within the last 24h, and end_time has passed.
        const { data: rows, error } = await supabaseAdmin
          .from('appointments')
          .select('id, patient_name, patient_email, scheduled_date, start_time, end_time, profile_id, treatments(name), practitioners(name), profiles(clinic_name, slug)')
          .eq('status', 'confirmed')
          .not('patient_email', 'is', null)
          .gte('scheduled_date', lookbackIso)
          .lte('scheduled_date', todayIso)
          .limit(200)

        if (error) {
          console.error('[review-emails] query failed', error)
          return Response.json({ ok: false, error: error.message }, { status: 500 })
        }

        const origin = process.env.PUBLIC_APP_URL || process.env.APP_URL || 'https://modobook.uk'
        let queued = 0
        let skipped = 0
        const brandingCache = new Map<string, Awaited<ReturnType<typeof getPractitionerBranding>>>()

        for (const row of rows ?? []) {
          const r = row as {
            id: string
            patient_name: string | null
            patient_email: string | null
            scheduled_date: string
            end_time: string
            profile_id: string
            treatments?: { name?: string } | null
            practitioners?: { name?: string } | null
            profiles?: { clinic_name?: string; slug?: string } | null
          }
          if (!r.patient_email) continue

          // Skip if appointment end is still in the future
          if (r.scheduled_date === todayIso && r.end_time > nowTime) { skipped++; continue }

          let branding = brandingCache.get(r.profile_id)
          if (!branding) {
            branding = await getPractitionerBranding(r.profile_id)
            brandingCache.set(r.profile_id, branding)
          }

          const messageId = `review-${r.id}`
          const result = await tryEnqueueAppEmail({
            templateName: 'review-request',
            recipientEmail: r.patient_email,
            messageId,
            templateData: {
              patientName: (r.patient_name ?? '').split(' ')[0] || 'there',
              clinicName: r.profiles?.clinic_name ?? branding.clinicName,
              treatmentName: r.treatments?.name,
              practitionerName: r.practitioners?.name,
              reviewUrl: r.profiles?.slug ? `${origin}/m/${r.profiles.slug}/reviews` : origin,
              logoUrl: branding.logoUrl,
              brandColor: branding.brandColor,
            },
          })
          if (result.skipped) skipped++
          else if (result.ok) queued++
        }

        return Response.json({ ok: true, queued, skipped, scanned: rows?.length ?? 0 })
      },
    },
  },
})
