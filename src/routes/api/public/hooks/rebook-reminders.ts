import { createFileRoute } from '@tanstack/react-router'

/**
 * Cron endpoint: send rebook + top-up reminder emails for appointments whose
 * "days after" interval matches today. Interval resolution order per kind:
 *   1. treatment.{rebook,topup}_reminder_days
 *   2. treatment_categories.{rebook,topup}_reminder_days (walking up parents)
 * If no interval is set for the kind, nothing is sent.
 *
 * Deduped via public.appointment_rebook_reminders_sent (appointment_id, kind).
 *
 * Auth: verifies the Supabase anon apikey header (same pattern as other public
 * cron endpoints in this project).
 */
export const Route = createFileRoute('/api/public/hooks/rebook-reminders')({
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

        const origin = process.env.PUBLIC_APP_URL || process.env.APP_URL || 'https://modobook.uk'

        // Look back 60 days so an appointment whose interval matches ~today
        // isn't missed if the cron was briefly down. Sent-log prevents dupes.
        const now = new Date()
        const lookback = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000)
        const todayIso = now.toISOString().slice(0, 10)
        const lookbackIso = lookback.toISOString().slice(0, 10)

        const { data: rows, error } = await supabaseAdmin
          .from('appointments')
          .select(`
            id, patient_name, patient_email, patient_phone, scheduled_date, profile_id,
            treatments(name, rebook_reminder_days, topup_reminder_days, category_id),
            practitioners(name),
            locations(name, city),
            profiles(clinic_name, slug)
          `)
          .eq('status', 'confirmed')
          .gte('scheduled_date', lookbackIso)
          .lte('scheduled_date', todayIso)
          .limit(1000)

        if (error) {
          console.error('[rebook-reminders] query failed', error)
          return Response.json({ ok: false, error: error.message }, { status: 500 })
        }

        // Cache category chains per profile so we can walk up parents once.
        const catCache = new Map<string, Map<string, { parent_id: string | null; rebook_reminder_days: number | null; topup_reminder_days: number | null }>>()
        async function getCategoryMap(profileId: string) {
          const existing = catCache.get(profileId)
          if (existing) return existing
          const { data: cats } = await supabaseAdmin
            .from('treatment_categories')
            .select('id, parent_id, rebook_reminder_days, topup_reminder_days')
            .eq('profile_id', profileId)
          const map = new Map<string, { parent_id: string | null; rebook_reminder_days: number | null; topup_reminder_days: number | null }>()
          for (const c of (cats ?? []) as any[]) {
            map.set(c.id, {
              parent_id: c.parent_id ?? null,
              rebook_reminder_days: c.rebook_reminder_days ?? null,
              topup_reminder_days: c.topup_reminder_days ?? null,
            })
          }
          catCache.set(profileId, map)
          return map
        }

        function resolveInterval(
          map: Map<string, { parent_id: string | null; rebook_reminder_days: number | null; topup_reminder_days: number | null }>,
          categoryId: string | null,
          kind: 'rebook' | 'topup',
        ): number | null {
          let cur = categoryId
          const seen = new Set<string>()
          while (cur && !seen.has(cur)) {
            seen.add(cur)
            const node = map.get(cur)
            if (!node) break
            const v = kind === 'rebook' ? node.rebook_reminder_days : node.topup_reminder_days
            if (v != null && v > 0) return v
            cur = node.parent_id
          }
          return null
        }

        // Look up already-sent (appointment_id, kind) pairs in one query.
        const apptIds = (rows ?? []).map((r: any) => r.id)
        const sentKeys = new Set<string>()
        if (apptIds.length > 0) {
          const { data: sent } = await supabaseAdmin
            .from('appointment_rebook_reminders_sent')
            .select('appointment_id, kind')
            .in('appointment_id', apptIds)
          for (const s of (sent ?? []) as any[]) sentKeys.add(`${s.appointment_id}:${s.kind}`)
        }

        const brandingCache = new Map<string, Awaited<ReturnType<typeof getPractitionerBranding>>>()
        let queued = 0
        let skipped = 0

        for (const row of rows ?? []) {
          const r = row as {
            id: string
            patient_name: string | null
            patient_email: string | null
            patient_phone: string | null
            scheduled_date: string
            profile_id: string
            treatments?: { name?: string; rebook_reminder_days?: number | null; topup_reminder_days?: number | null; category_id?: string | null } | null
            practitioners?: { name?: string } | null
            profiles?: { clinic_name?: string; slug?: string } | null
          }
          const catMap = await getCategoryMap(r.profile_id)
          const scheduledMs = new Date(`${r.scheduled_date}T00:00:00Z`).getTime()
          const daysSince = Math.floor((Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) - scheduledMs) / (24 * 60 * 60 * 1000))

          for (const kind of ['topup', 'rebook'] as const) {
            const perTx = kind === 'rebook' ? r.treatments?.rebook_reminder_days : r.treatments?.topup_reminder_days
            const interval = (perTx != null && perTx > 0)
              ? perTx
              : resolveInterval(catMap, r.treatments?.category_id ?? null, kind)
            if (!interval || interval <= 0) continue
            if (daysSince !== interval) continue
            if (sentKeys.has(`${r.id}:${kind}`)) { skipped++; continue }

            let branding = brandingCache.get(r.profile_id)
            if (!branding) {
              branding = await getPractitionerBranding(r.profile_id)
              brandingCache.set(r.profile_id, branding)
            }

            const bookingUrl = r.profiles?.slug ? `${origin}/m/${r.profiles.slug}` : origin
            const templateName = kind === 'rebook' ? 'rebook-reminder' : 'topup-reminder'
            const messageId = `${kind}-${r.id}`

            // WhatsApp version (per-clinic toggle; no-ops when off / no phone)
            try {
              const { sendWhatsApp, smsMessage } = await import('@/lib/whatsapp/send.server')
              const waKind = kind === 'rebook' ? 'rebook-reminder' : 'topup-reminder'
              await sendWhatsApp({
                profileId: r.profile_id,
                appointmentId: r.id,
                kind: waKind,
                toPhone: r.patient_phone,
                messageKey: `wa-${kind}-${r.id}`,
                ...smsMessage(waKind, {
                  patientName: r.patient_name,
                  clinicName: r.profiles?.clinic_name ?? branding.clinicName,
                  treatmentName: r.treatments?.name,
                  locationName:
                    (r as { locations?: { name?: string | null; city?: string | null } | null })
                      .locations?.name ??
                    (r as { locations?: { city?: string | null } | null }).locations?.city ??
                    null,
                  bookingUrl,
                }),
              })
            } catch (e) {
              console.error('[whatsapp] rebook reminder failed', e)
            }

            if (!r.patient_email) {
              await supabaseAdmin
                .from('appointment_rebook_reminders_sent')
                .insert({ appointment_id: r.id, kind } as never)
                .then(() => {}, () => {})
              continue
            }

            const result = await tryEnqueueAppEmail({
              templateName,
              recipientEmail: r.patient_email,
              messageId,
              templateData: {
                patientName: (r.patient_name ?? '').split(' ')[0] || 'there',
                clinicName: r.profiles?.clinic_name ?? branding.clinicName,
                treatmentName: r.treatments?.name,
                practitionerName: r.practitioners?.name,
                bookingUrl,
                logoUrl: branding.logoUrl,
                brandColor: branding.brandColor,
                profileId: r.profile_id,
              },
            })
            if (result.ok) {
              queued++
              await supabaseAdmin
                .from('appointment_rebook_reminders_sent')
                .insert({ appointment_id: r.id, kind } as never)
            } else {
              skipped++
            }
          }
        }

        // Clinic-wide reminders are based on each patient's most recent visit,
        // regardless of treatment. They are deliberately separate from the
        // treatment/category reminder rules above so clinics can use either or both.
        const { data: generalProfiles, error: generalProfilesError } = await supabaseAdmin
          .from('profiles')
          .select('id, clinic_name, slug, general_rebook_reminder_days, general_rebook_followup_days')
          .eq('general_rebook_reminders_enabled', true)

        if (generalProfilesError) {
          console.error('[general-rebook-reminders] profile query failed', generalProfilesError)
          return Response.json({ ok: false, error: generalProfilesError.message }, { status: 500 })
        }

        let generalQueued = 0
        let generalSkipped = 0

        for (const profile of generalProfiles ?? []) {
          const firstDays = Math.max(1, profile.general_rebook_reminder_days ?? 90)
          const followupDays = profile.general_rebook_followup_days
          const [{ data: visits, error: visitsError }, { data: upcoming, error: upcomingError }] = await Promise.all([
            supabaseAdmin
              .from('appointments')
              .select('id, patient_name, patient_email, scheduled_date')
              .eq('profile_id', profile.id)
              .in('status', ['confirmed', 'completed'])
              .lte('scheduled_date', todayIso)
              .not('patient_email', 'is', null)
              .order('scheduled_date', { ascending: false })
              .limit(5000),
            supabaseAdmin
              .from('appointments')
              .select('patient_email')
              .eq('profile_id', profile.id)
              .in('status', ['pending', 'confirmed'])
              .gt('scheduled_date', todayIso)
              .not('patient_email', 'is', null)
              .limit(5000),
          ])

          if (visitsError || upcomingError) {
            console.error('[general-rebook-reminders] appointment query failed', visitsError ?? upcomingError)
            generalSkipped++
            continue
          }

          const upcomingEmails = new Set(
            (upcoming ?? []).map((item) => item.patient_email?.trim().toLowerCase()).filter(Boolean),
          )
          const latestByEmail = new Map<string, { id: string; patient_name: string | null; patient_email: string; scheduled_date: string }>()
          for (const visit of visits ?? []) {
            const email = visit.patient_email?.trim().toLowerCase()
            if (!email || latestByEmail.has(email)) continue
            latestByEmail.set(email, { ...visit, patient_email: email })
          }

          const visitIds = Array.from(latestByEmail.values()).map((visit) => visit.id)
          const sentByVisit = new Map<string, string>()
          if (visitIds.length > 0) {
            const { data: generalSent } = await supabaseAdmin
              .from('general_rebook_reminders_sent')
              .select('appointment_id, patient_email, stage, sent_at')
              .eq('profile_id', profile.id)
              .in('appointment_id', visitIds)
            for (const sent of generalSent ?? []) {
              sentByVisit.set(`${sent.appointment_id}:${sent.patient_email.toLowerCase()}:${sent.stage}`, sent.sent_at)
            }
          }

          let branding = brandingCache.get(profile.id)
          if (!branding) {
            branding = await getPractitionerBranding(profile.id)
            brandingCache.set(profile.id, branding)
          }
          const bookingUrl = profile.slug ? `${origin}/m/${profile.slug}` : origin

          for (const [email, visit] of latestByEmail) {
            if (upcomingEmails.has(email)) { generalSkipped++; continue }
            const visitMs = new Date(`${visit.scheduled_date}T00:00:00Z`).getTime()
            const daysSinceVisit = Math.floor((Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) - visitMs) / (24 * 60 * 60 * 1000))
            const firstKey = `${visit.id}:${email}:1`
            const secondKey = `${visit.id}:${email}:2`
            const firstSentAt = sentByVisit.get(firstKey)
            const followupDue = firstSentAt && followupDays != null && followupDays > 0
              ? new Date(firstSentAt).getTime() + followupDays * 24 * 60 * 60 * 1000
              : null
            const stage = !firstSentAt && daysSinceVisit >= firstDays
              ? 1
              : firstSentAt && !sentByVisit.has(secondKey) && followupDue != null && now.getTime() >= followupDue
                ? 2
                : null
            if (!stage) continue
            const sentKey = `${visit.id}:${email}:${stage}`
            if (sentByVisit.has(sentKey)) { generalSkipped++; continue }

            const result = await tryEnqueueAppEmail({
              templateName: 'rebook-reminder',
              recipientEmail: email,
              messageId: `general-rebook-${stage}-${visit.id}`,
              templateData: {
                profileId: profile.id,
                patientName: (visit.patient_name ?? '').split(' ')[0] || 'there',
                clinicName: profile.clinic_name ?? branding.clinicName,
                bookingUrl,
                logoUrl: branding.logoUrl,
                clinicImageUrl: branding.clinicImageUrl,
                brandColor: branding.brandColor,
                websiteUrl: branding.websiteUrl,
                instagramUrl: branding.instagramUrl,
                generalReminder: true,
                followUp: stage === 2,
              },
            })

            if (result.ok) {
              generalQueued++
              await supabaseAdmin.from('general_rebook_reminders_sent').insert({
                profile_id: profile.id,
                appointment_id: visit.id,
                patient_email: email,
                stage,
              })
            } else {
              generalSkipped++
            }
          }
        }

        return Response.json({
          ok: true,
          queued,
          skipped,
          scanned: rows?.length ?? 0,
          generalQueued,
          generalSkipped,
        })
      },
    },
  },
})
