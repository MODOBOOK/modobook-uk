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

          if (!rules || rules.length === 0) {
            return Response.json({ ok: true, enqueued: 0, note: 'no rules' })
          }

          let enqueued = 0
          const nowMs = Date.now()
          const brandingCache = new Map<string, any>()

          for (const rule of rules as any[]) {
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

              // WhatsApp reminder (per-clinic toggle; no-ops when off / no phone)
              try {
                const { sendWhatsApp, smsMessage } = await import('@/lib/whatsapp/send.server')
                await sendWhatsApp({
                  profileId: a.profile_id,
                  appointmentId: a.id,
                  kind: 'appointment-reminder',
                  toPhone: a.patient_phone,
                  messageKey: `wa-reminder-${a.id}-${rule.id}`,
                  ...smsMessage('appointment-reminder', {
                    patientName: a.patient_name,
                    clinicName: a.profiles?.clinic_name ?? branding.clinicName,
                    treatmentName: a.treatments?.name,
                    dateTime: formatBookingDateTime(a.scheduled_date, a.start_time),
                    locationName: loc?.name,
                    locationAddress: loc ? [loc.address_line1, loc.city, loc.postcode].filter(Boolean).join(', ') : undefined,
                    manageUrl,
                    hoursBefore: rule.hours_before,
                  }),
                })
              } catch (e) {
                console.error('[whatsapp] appointment reminder failed', e)
              }

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

          return Response.json({ ok: true, enqueued, rules: rules.length })
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
