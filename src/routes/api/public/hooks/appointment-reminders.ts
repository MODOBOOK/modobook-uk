// Cron endpoint: scans upcoming appointments and enqueues reminder emails
// for each practitioner's enabled reminder rules. Runs every 5 minutes.
// Idempotent via public.appointment_reminders_sent (unique on (appointment, rule)).
import { createFileRoute } from '@tanstack/react-router'
import { tryEnqueueAppEmail, formatBookingDateTime, getPractitionerBranding } from '@/lib/email/send.server'

export const Route = createFileRoute('/api/public/hooks/appointment-reminders')({
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
          const origin = process.env.PUBLIC_APP_URL || process.env.APP_URL || 'https://modobook.uk'

          // Load all enabled rules
          const { data: rules, error: rulesErr } = await supabaseAdmin
            .from('appointment_reminder_rules')
            .select('id, profile_id, hours_before, subject, intro, closing, enabled')
            .eq('enabled', true)
          if (rulesErr) throw rulesErr

          let enqueued = 0
          const nowMs = Date.now()
          const brandingCache = new Map<string, any>()

          for (const rule of (rules ?? []) as any[]) {

            // Window: appointments starting in [hours_before-5min, hours_before+5min]
            const targetMs = nowMs + rule.hours_before * 3600_000
            const windowStartMs = targetMs - 6 * 60_000
            const windowEndMs = targetMs + 6 * 60_000
            // Broad date filter (UTC dates covering both edges) — final match uses start_time.
            const startDate = new Date(windowStartMs).toISOString().slice(0, 10)
            const endDate = new Date(windowEndMs).toISOString().slice(0, 10)

            const { data: appts, error: apptErr } = await supabaseAdmin
              .from('appointments')
              .select('id, patient_name, patient_email, patient_phone, scheduled_date, start_time, manage_token, profile_id, status, treatments(name), practitioners(name), locations(name, address_line1, city, postcode), profiles(clinic_name, slug)')
              .eq('profile_id', rule.profile_id)
              .in('status', ['confirmed', 'pending'])
              .gte('scheduled_date', startDate)
              .lte('scheduled_date', endDate)

            if (apptErr) {
              console.error('[reminders] appt query failed', apptErr)
              continue
            }

            for (const raw of appts ?? []) {
              const a = raw as any
              // Precise time check
              const apptMs = new Date(`${a.scheduled_date}T${a.start_time}:00`).getTime()
              if (Number.isNaN(apptMs) || apptMs < windowStartMs || apptMs > windowEndMs) continue

              // Skip if already sent
              const { data: already } = await supabaseAdmin
                .from('appointment_reminders_sent')
                .select('appointment_id')
                .eq('appointment_id', a.id)
                .eq('rule_id', rule.id)
                .maybeSingle()
              if (already) continue

              let branding = brandingCache.get(a.profile_id)
              if (!branding) {
                branding = await getPractitionerBranding(a.profile_id)
                brandingCache.set(a.profile_id, branding)
              }

              const manageUrl = a.manage_token && a.profiles?.slug
                ? `${origin}/m/${a.profiles.slug}/manage/${a.manage_token}`
                : undefined
              const loc = a.locations

              // Texts are handled separately below, on the clinic's own SMS timings.


              if (!a.patient_email) {
                await supabaseAdmin
                  .from('appointment_reminders_sent')
                  .insert({ appointment_id: a.id, rule_id: rule.id })
                  .then(() => {}, () => {})
                continue
              }

              const res = await tryEnqueueAppEmail({
                templateName: 'appointment-reminder',
                recipientEmail: a.patient_email,
                messageId: `reminder-${a.id}-${rule.id}`,
                templateData: {
                  profileId: a.profile_id,
                  patientName: (a.patient_name ?? '').split(' ')[0] || 'there',
                  clinicName: a.profiles?.clinic_name ?? branding.clinicName,
                  treatmentName: a.treatments?.name ?? 'your treatment',
                  practitionerName: a.practitioners?.name,
                  locationName: loc?.name,
                  locationAddress: loc ? [loc.address_line1, loc.city, loc.postcode].filter(Boolean).join(', ') : undefined,
                  dateTime: formatBookingDateTime(a.scheduled_date, a.start_time),
                  hoursBefore: rule.hours_before,
                  manageUrl,
                  logoUrl: branding.logoUrl,
                  brandColor: branding.brandColor,
                  // Rule-specific overrides win over per-template customization
                  subjectOverride: rule.subject || undefined,
                  introOverride: rule.intro || undefined,
                  closingOverride: rule.closing || undefined,
                },
              })

              if (res.ok || res.skipped) {
                await supabaseAdmin
                  .from('appointment_reminders_sent')
                  .insert({ appointment_id: a.id, rule_id: rule.id })
                  .then(() => {}, () => {})
                if (res.ok) enqueued++
              }
            }
          }

          // ---------------------------------------------------------------
          // Text messages — sent on each clinic's own SMS timings, which are
          // independent of the email reminder rules above. Idempotent via the
          // message key, so re-runs never double-text.
          // ---------------------------------------------------------------
          let texted = 0
          try {
            const { sendWhatsApp, smsMessage } = await import('@/lib/whatsapp/send.server')
            const { parseSmsTimings } = await import('@/lib/whatsapp/templates')

            const { data: smsClinics } = await supabaseAdmin
              .from('profiles')
              .select('id, slug, clinic_name, sms_timings')
              .eq('whatsapp_reminders_enabled', true)

            const apptSelect =
              'id, patient_name, patient_phone, scheduled_date, start_time, created_at, manage_token, profile_id, status, treatments(name), locations(name, address_line1, city, postcode), profiles(clinic_name, slug)'

            const ctxFor = (a: any, hoursBefore?: number) => {
              const loc = a.locations
              return {
                patientName: a.patient_name,
                clinicName: a.profiles?.clinic_name,
                treatmentName: a.treatments?.name,
                dateTime: formatBookingDateTime(a.scheduled_date, a.start_time),
                locationName: loc?.name,
                locationAddress: loc
                  ? [loc.address_line1, loc.city, loc.postcode].filter(Boolean).join(', ')
                  : undefined,
                manageUrl:
                  a.manage_token && a.profiles?.slug
                    ? `${origin}/m/${a.profiles.slug}/manage/${a.manage_token}`
                    : undefined,
                hoursBefore,
              }
            }

            for (const clinicRaw of smsClinics ?? []) {
              const clinic = clinicRaw as any
              const timings = parseSmsTimings(clinic.sms_timings)

              // Delayed booking confirmations
              if (timings.confirmationDelayMinutes > 0) {
                const targetMs = nowMs - timings.confirmationDelayMinutes * 60_000
                const { data: fresh } = await supabaseAdmin
                  .from('appointments')
                  .select(apptSelect)
                  .eq('profile_id', clinic.id)
                  .in('status', ['confirmed', 'pending'])
                  .gte('created_at', new Date(targetMs - 6 * 60_000).toISOString())
                  .lte('created_at', new Date(targetMs + 6 * 60_000).toISOString())
                for (const raw of fresh ?? []) {
                  const a = raw as any
                  const r = await sendWhatsApp({
                    profileId: a.profile_id,
                    appointmentId: a.id,
                    kind: 'booking-confirmation',
                    toPhone: a.patient_phone,
                    messageKey: `wa-confirm-${a.id}`,
                    ...smsMessage('booking-confirmation', ctxFor(a)),
                  })
                  if (r.ok && !r.skipped) texted++
                }
              }

              // Reminders, one per configured lead time
              for (const hours of timings.reminderHoursBefore) {
                const targetMs = nowMs + hours * 3600_000
                const winStart = targetMs - 6 * 60_000
                const winEnd = targetMs + 6 * 60_000
                const { data: appts } = await supabaseAdmin
                  .from('appointments')
                  .select(apptSelect)
                  .eq('profile_id', clinic.id)
                  .in('status', ['confirmed', 'pending'])
                  .gte('scheduled_date', new Date(winStart).toISOString().slice(0, 10))
                  .lte('scheduled_date', new Date(winEnd).toISOString().slice(0, 10))
                for (const raw of appts ?? []) {
                  const a = raw as any
                  const apptMs = new Date(`${a.scheduled_date}T${a.start_time}:00`).getTime()
                  if (Number.isNaN(apptMs) || apptMs < winStart || apptMs > winEnd) continue
                  const r = await sendWhatsApp({
                    profileId: a.profile_id,
                    appointmentId: a.id,
                    kind: 'appointment-reminder',
                    toPhone: a.patient_phone,
                    messageKey: `wa-reminder-${a.id}-h${hours}`,
                    ...smsMessage('appointment-reminder', ctxFor(a, hours)),
                  })
                  if (r.ok && !r.skipped) texted++
                }
              }
            }
          } catch (e) {
            console.error('[reminders] sms pass failed', e)
          }

          return Response.json({ ok: true, enqueued, texted, rules: rules.length })

        } catch (e) {
          console.error('[reminders] failed', e)
          return new Response(JSON.stringify({ ok: false, error: e instanceof Error ? e.message : String(e) }), {
            status: 500, headers: { 'Content-Type': 'application/json' },
          })
        }
      },
    },
  },
})
