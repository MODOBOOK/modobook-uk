// Server-side helper for enqueueing app emails from server functions and cron
// routes. Mirrors the logic in /lovable/email/transactional/send but callable
// from trusted server code (no bearer JWT required) — used by unauthenticated
// public flows (bookings, patient self-cancel) and internal jobs (review
// requests).
import * as React from 'react'
import { render } from 'react-email'
import { TEMPLATES } from '@/lib/email-templates/registry'

const SITE_NAME = 'MODO Book'
const SENDER_DOMAIN = 'notify.modobook.uk'
const FROM_DOMAIN = 'modobook.uk'

function generateToken() {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('')
}

export interface EnqueueAppEmailInput {
  templateName: keyof typeof TEMPLATES | string
  recipientEmail: string
  templateData?: Record<string, unknown>
  /** Stable id — used both as message_id and idempotency_key. If a row already
   * exists in email_send_log with this message_id, the send is skipped. */
  messageId?: string
  /** Optional Reply-To header (e.g. so patient replies go to practitioner). */
  replyTo?: string
}

export async function enqueueAppEmail(
  input: EnqueueAppEmailInput,
): Promise<{ ok: boolean; skipped?: string; error?: string }> {
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
  const supabase = supabaseAdmin

  const template = TEMPLATES[input.templateName as string]
  if (!template) return { ok: false, error: `Template ${input.templateName} not found` }

  const recipient = (template.to || input.recipientEmail || '').trim()
  if (!recipient) return { ok: false, error: 'recipientEmail required' }
  const normalized = recipient.toLowerCase()

  // Demo-mode guard: never send real emails from a demo clinic, and never
  // send anything to reserved demo email addresses.
  const dm = await import('@/lib/demo.server')
  const profileIdForDemo = (input.templateData as any)?.profileId as string | undefined
  if (dm.isDemoEmail(recipient) || (await dm.isDemoProfile(profileIdForDemo))) {
    console.log('[demo] Skipping email', input.templateName, 'to', recipient)
    return { ok: true, skipped: 'demo-mode' }
  }

  const messageId = input.messageId || crypto.randomUUID()



  // Merge practitioner override wording (subject/intro/closing) when a
  // profileId is passed in templateData. Templates that accept the *Override
  // props render them; templates that don't ignore them. {{var}} placeholders
  // are interpolated using the current template data so overrides can still
  // include the patient/clinic/appointment info.
  const baseData = { ...(input.templateData || {}) } as Record<string, unknown>
  const profileId = baseData.profileId as string | undefined
  // Auto-resolve Reply-To from the practitioner's profile email so patient
  // replies land in the practitioner's inbox instead of a no-reply address.
  let resolvedReplyTo = input.replyTo
  if (profileId) {
    try {
      const [{ data: cust }, { data: prof }] = await Promise.all([
        supabase
          .from('email_customizations')
          .select('subject_override, intro_override, body_override, closing_override')
          .eq('profile_id', profileId)
          .eq('template_key', input.templateName as string)
          .maybeSingle(),
        supabase
          .from('profiles')
          .select('email')
          .eq('id', profileId)
          .maybeSingle(),
      ])
      if (cust) {
        const c = cust as {
          subject_override?: string | null
          intro_override?: string | null
          body_override?: string | null
          closing_override?: string | null
        }
        const { interpolateOverride } = await import('@/lib/email-templates/defaults')
        const vars: Record<string, string | undefined | null> = {
          patient_name: baseData.patientName as string | undefined,
          clinic_name: baseData.clinicName as string | undefined,
          treatment_name: baseData.treatmentName as string | undefined,
          practitioner_name: baseData.practitionerName as string | undefined,
          date_time: baseData.dateTime as string | undefined,
          form_name: baseData.formName as string | undefined,
        }
        if (c.subject_override) baseData.subjectOverride = interpolateOverride(c.subject_override, vars)
        if (c.intro_override) baseData.introOverride = interpolateOverride(c.intro_override, vars)
        if (c.body_override) baseData.bodyOverride = interpolateOverride(c.body_override, vars)
        if (c.closing_override) baseData.closingOverride = interpolateOverride(c.closing_override, vars)
      }
      const profEmail = (prof as { email?: string | null } | null)?.email?.trim()
      if (!resolvedReplyTo && profEmail) resolvedReplyTo = profEmail
    } catch (e) {
      console.error('[email] failed to load customization/profile email', e)
    }
  }



  // Dedup by message_id (skip if this exact send was already recorded)
  if (input.messageId) {
    const { data: existing } = await supabase
      .from('email_send_log')
      .select('id')
      .eq('message_id', messageId)
      .limit(1)
      .maybeSingle()
    if (existing) return { ok: true, skipped: 'already_sent' }
  }

  // Suppression check
  const { data: suppressed } = await supabase
    .from('suppressed_emails')
    .select('id')
    .eq('email', normalized)
    .maybeSingle()
  if (suppressed) {
    await supabase.from('email_send_log').insert({
      message_id: messageId,
      template_name: input.templateName as string,
      recipient_email: recipient,
      status: 'suppressed',
    })
    return { ok: false, skipped: 'suppressed' }
  }

  // Unsubscribe token (one per email)
  let unsubscribeToken: string
  const { data: existingToken } = await supabase
    .from('email_unsubscribe_tokens')
    .select('token, used_at')
    .eq('email', normalized)
    .maybeSingle()
  if (existingToken?.used_at) {
    await supabase.from('email_send_log').insert({
      message_id: messageId,
      template_name: input.templateName as string,
      recipient_email: recipient,
      status: 'suppressed',
    })
    return { ok: false, skipped: 'unsubscribed' }
  }
  if (existingToken) {
    unsubscribeToken = existingToken.token
  } else {
    unsubscribeToken = generateToken()
    await supabase
      .from('email_unsubscribe_tokens')
      .upsert({ token: unsubscribeToken, email: normalized }, { onConflict: 'email', ignoreDuplicates: true })
    const { data: stored } = await supabase
      .from('email_unsubscribe_tokens')
      .select('token')
      .eq('email', normalized)
      .maybeSingle()
    if (stored?.token) unsubscribeToken = stored.token
  }

  // Inject tokenised unsubscribe URL so recipients can actually unsubscribe
  // from marketing broadcasts (and any template that surfaces a link).
  const unsubscribeUrlWithToken = `https://modobook.uk/unsubscribe?token=${unsubscribeToken}`
  baseData.unsubscribeUrl = unsubscribeUrlWithToken

  const element = React.createElement(template.component, baseData)
  const html = await render(element)
  const text = await render(element, { plainText: true })


  const subject =
    typeof template.subject === 'function'
      ? template.subject(baseData)
      : template.subject

  await supabase.from('email_send_log').insert({
    message_id: messageId,
    template_name: input.templateName as string,
    recipient_email: recipient,
    status: 'pending',
  })

  const { error: enqueueError } = await supabase.rpc('enqueue_email', {
    queue_name: 'transactional_emails',
    payload: {
      message_id: messageId,
      to: recipient,
      from: `"${SITE_NAME}" <noreply@${FROM_DOMAIN}>`,
      sender_domain: SENDER_DOMAIN,
      subject,
      html,
      text,
      purpose: 'transactional',
      label: input.templateName,
      idempotency_key: messageId,
      unsubscribe_token: unsubscribeToken,
      queued_at: new Date().toISOString(),
      ...(resolvedReplyTo ? { reply_to: resolvedReplyTo } : {}),
    },
  })

  if (enqueueError) {
    await supabase.from('email_send_log').insert({
      message_id: messageId,
      template_name: input.templateName as string,
      recipient_email: recipient,
      status: 'failed',
      error_message: enqueueError.message,
    })
    return { ok: false, error: enqueueError.message }
  }

  return { ok: true }
}

/** Fire-and-forget helper: never throws, logs to console on failure. */
export async function tryEnqueueAppEmail(input: EnqueueAppEmailInput) {
  try {
    const r = await enqueueAppEmail(input)
    if (!r.ok && !r.skipped) console.error('[email] enqueue failed', input.templateName, r.error)
    return r
  } catch (e) {
    console.error('[email] enqueue threw', input.templateName, e)
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

export async function sendPlatformArrearsEmail(input: {
  profileId: string
  stripeInvoiceId: string
  amountDueCents: number
  currency: string
  hostedInvoiceUrl: string | null
  attemptCount: number
}) {
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('email, full_name, clinic_name, brand_color')
    .eq('id', input.profileId)
    .maybeSingle()
  if (!profile?.email) return
  const symbol = input.currency === 'gbp' ? '£' : input.currency === 'usd' ? '$' : input.currency === 'eur' ? '€' : ''
  const amountFormatted = `${symbol}${(input.amountDueCents / 100).toFixed(2)}`
  const origin = process.env.PUBLIC_APP_URL || process.env.APP_URL || 'https://modobook.uk'
  await tryEnqueueAppEmail({
    templateName: 'platform-arrears',
    recipientEmail: profile.email,
    messageId: `platform-arrears-${input.stripeInvoiceId}-${input.attemptCount}`,
    templateData: {
      practitionerName: profile.full_name || profile.clinic_name || 'there',
      clinicName: profile.clinic_name || 'MODO',
      amountFormatted,
      attemptCount: input.attemptCount,
      hostedInvoiceUrl: input.hostedInvoiceUrl || undefined,
      billingUrl: `${origin}/dashboard/billing`,
      logoUrl: null,
      brandColor: profile.brand_color || null,
    },
  })
}



export async function sendBookingConfirmationEmails(appointmentIds: string[]) {
  if (appointmentIds.length === 0) return []

  const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
  const origin = process.env.PUBLIC_APP_URL || process.env.APP_URL || 'https://modobook.uk'

  const { data: appts, error } = await supabaseAdmin
    .from('appointments')
    .select('id, patient_name, patient_email, patient_phone, scheduled_date, start_time, manage_token, profile_id, treatments(name), practitioners(name), locations(name, address_line1, city, postcode), profiles(clinic_name, slug)')
    .in('id', appointmentIds)

  if (error) throw error

  const brandingCache = new Map<string, PractitionerBranding>()
  const results: Array<{ appointmentId: string; ok: boolean; skipped?: string; error?: string }> = []

  for (const raw of appts ?? []) {
    const a = raw as {
      id: string
      patient_name: string | null
      patient_email: string | null
      patient_phone: string | null
      scheduled_date: string
      start_time: string
      manage_token: string | null
      profile_id: string
      treatments?: { name?: string } | null
      practitioners?: { name?: string } | null
      locations?: { name?: string; address_line1?: string; city?: string; postcode?: string } | null
      profiles?: { clinic_name?: string; slug?: string } | null
    }

    let branding = brandingCache.get(a.profile_id)
    if (!branding) {
      branding = await getPractitionerBranding(a.profile_id)
      brandingCache.set(a.profile_id, branding)
    }

    const manageUrl = a.manage_token && a.profiles?.slug
      ? `${origin}/m/${a.profiles.slug}/manage/${a.manage_token}`
      : undefined
    const loc = a.locations

    // WhatsApp confirmation (per-clinic toggle; no-ops when off / no phone)
    try {
      const { sendWhatsApp, smsMessage } = await import('@/lib/whatsapp/send.server')
      const ctx = {
        patientName: a.patient_name,
        clinicName: a.profiles?.clinic_name ?? branding.clinicName,
        treatmentName: a.treatments?.name,
        dateTime: formatBookingDateTime(a.scheduled_date, a.start_time),
        locationName: loc?.name,
        locationAddress: loc ? [loc.address_line1, loc.city, loc.postcode].filter(Boolean).join(', ') : undefined,
        manageUrl,
      }
      await sendWhatsApp({
        profileId: a.profile_id,
        appointmentId: a.id,
        kind: 'booking-confirmation',
        toPhone: a.patient_phone,
        messageKey: `wa-confirm-${a.id}`,
        ...smsMessage('booking-confirmation', ctx),
      })
    } catch (e) {
      console.error('[whatsapp] booking confirmation failed', e)
    }

    if (!a.patient_email) continue

    const res = await tryEnqueueAppEmail({
      templateName: 'booking-confirmation',
      recipientEmail: a.patient_email,
      messageId: `booking-confirm-${a.id}`,
      templateData: {
        profileId: a.profile_id,
        patientName: (a.patient_name ?? '').split(' ')[0] || 'there',
        clinicName: a.profiles?.clinic_name ?? branding.clinicName,
        treatmentName: a.treatments?.name ?? 'your treatment',
        practitionerName: a.practitioners?.name,
        locationName: loc?.name,
        locationAddress: loc ? [loc.address_line1, loc.city, loc.postcode].filter(Boolean).join(', ') : undefined,
        dateTime: formatBookingDateTime(a.scheduled_date, a.start_time),
        manageUrl,
        logoUrl: branding.logoUrl,
        brandColor: branding.brandColor,
      },
    })

    results.push({ appointmentId: a.id, ok: res.ok, skipped: res.skipped, error: res.error })
  }

  // Also enqueue medical form + consent request emails so patients get direct links
  await sendBookingFormRequestEmails(appointmentIds, origin, brandingCache).catch((e) =>
    console.error('[email] form-request enqueue failed', e),
  )

  return results
}

/** For every unsubmitted medical form and unsigned consent on the given
 *  appointments, enqueue a `medical-form-request` email pointing at the
 *  patient-facing token URL. Reuses the medical-form-request template for
 *  consents by setting formName to the consent name and formUrl to /c/{token}. */
export async function sendBookingFormRequestEmails(
  appointmentIds: string[],
  origin: string,
  brandingCache?: Map<string, PractitionerBranding>,
) {
  if (appointmentIds.length === 0) return
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server')

  const [{ data: forms }, { data: consents }] = await Promise.all([
    supabaseAdmin
      .from('appointment_medical_forms')
      .select('id, token, appointment_id, submitted_at, medical_form_templates(name), appointments(patient_name, patient_email, profile_id, profiles(clinic_name))')
      .in('appointment_id', appointmentIds)
      .is('submitted_at', null),
    supabaseAdmin
      .from('appointment_consents')
      .select('id, token, appointment_id, signed_at, consent_templates(name), appointments(patient_name, patient_email, profile_id, profiles(clinic_name))')
      .in('appointment_id', appointmentIds)
      .is('signed_at', null),
  ])

  const cache = brandingCache ?? new Map<string, PractitionerBranding>()
  const brandingFor = async (pid: string) => {
    let b = cache.get(pid)
    if (!b) { b = await getPractitionerBranding(pid); cache.set(pid, b) }
    return b
  }

  type FormRow = {
    id: string; token: string | null; appointment_id: string;
    medical_form_templates?: { name?: string } | null;
    appointments?: { patient_name?: string | null; patient_email?: string | null; profile_id?: string; profiles?: { clinic_name?: string } | null } | null;
  }
  for (const raw of (forms ?? []) as FormRow[]) {
    const a = raw.appointments
    if (!a?.patient_email || !raw.token || !a.profile_id) continue
    const branding = await brandingFor(a.profile_id)
    await tryEnqueueAppEmail({
      templateName: 'medical-form-request',
      recipientEmail: a.patient_email,
      messageId: `form-request-${raw.id}`,
      templateData: {
        profileId: a.profile_id,
        patientName: (a.patient_name ?? '').split(' ')[0] || 'there',
        clinicName: a.profiles?.clinic_name ?? branding.clinicName,
        formName: raw.medical_form_templates?.name ?? 'medical form',
        formUrl: `${origin}/f/${raw.token}`,
        logoUrl: branding.logoUrl,
        brandColor: branding.brandColor,
      },
    })
  }

  type ConsentRow = {
    id: string; token: string | null; appointment_id: string;
    consent_templates?: { name?: string } | null;
    appointments?: { patient_name?: string | null; patient_email?: string | null; profile_id?: string; profiles?: { clinic_name?: string } | null } | null;
  }
  for (const raw of (consents ?? []) as ConsentRow[]) {
    const a = raw.appointments
    if (!a?.patient_email || !raw.token || !a.profile_id) continue
    const branding = await brandingFor(a.profile_id)
    await tryEnqueueAppEmail({
      templateName: 'medical-form-request',
      recipientEmail: a.patient_email,
      messageId: `consent-request-${raw.id}`,
      templateData: {
        profileId: a.profile_id,
        patientName: (a.patient_name ?? '').split(' ')[0] || 'there',
        clinicName: a.profiles?.clinic_name ?? branding.clinicName,
        formName: raw.consent_templates?.name ?? 'consent form',
        formUrl: `${origin}/c/${raw.token}`,
        logoUrl: branding.logoUrl,
        brandColor: branding.brandColor,
      },
    })
  }
}

export function formatBookingDateTime(date: string, startTime: string): string {
  // "2026-07-12" + "14:30" → "Sun 12 Jul 2026 · 2:30 PM"
  try {
    const [h, m] = startTime.split(':').map(Number)
    const d = new Date(`${date}T${startTime}:00`)
    const fmt = new Intl.DateTimeFormat('en-GB', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(d)
    const hr12 = ((h + 11) % 12) + 1
    const ampm = h >= 12 ? 'PM' : 'AM'
    return `${fmt} · ${hr12}:${String(m).padStart(2, '0')} ${ampm}`
  } catch {
    return `${date} ${startTime}`
  }
}

export interface PractitionerBranding {
  clinicName: string
  logoUrl: string | null
  brandColor: string | null
}

/** Fetch a practitioner's clinic name, logo and brand colour for emails.
 * Merges profiles (clinic_name, brand_color) with clinic_theme (logo_url,
 * primary_color). Never throws — returns MODO defaults on failure. */
export async function getPractitionerBranding(
  profileId: string | null | undefined,
): Promise<PractitionerBranding> {
  const fallback: PractitionerBranding = { clinicName: 'MODO', logoUrl: null, brandColor: null }
  if (!profileId) return fallback
  try {
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
    const [{ data: prof }, { data: theme }] = await Promise.all([
      supabaseAdmin.from('profiles').select('clinic_name, brand_color').eq('id', profileId).maybeSingle(),
      supabaseAdmin.from('clinic_theme').select('logo_url, primary_color').eq('profile_id', profileId).maybeSingle(),
    ])
    const p = prof as { clinic_name?: string | null; brand_color?: string | null } | null
    const t = theme as { logo_url?: string | null; primary_color?: string | null } | null
    return {
      clinicName: p?.clinic_name || 'MODO',
      logoUrl: t?.logo_url || null,
      brandColor: t?.primary_color || p?.brand_color || null,
    }
  } catch (e) {
    console.error('[email] getPractitionerBranding failed', e)
    return fallback
  }
}
