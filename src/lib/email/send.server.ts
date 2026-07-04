// Server-side helper for enqueueing app emails from server functions and cron
// routes. Mirrors the logic in /lovable/email/transactional/send but callable
// from trusted server code (no bearer JWT required) — used by unauthenticated
// public flows (bookings, patient self-cancel) and internal jobs (review
// requests).
import * as React from 'react'
import { render } from 'react-email'
import { TEMPLATES } from '@/lib/email-templates/registry'

const SITE_NAME = 'modobook-uk'
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

  const messageId = input.messageId || crypto.randomUUID()

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

  const element = React.createElement(template.component, input.templateData || {})
  const html = await render(element)
  const text = await render(element, { plainText: true })

  const subject =
    typeof template.subject === 'function'
      ? template.subject(input.templateData || {})
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
      from: `${SITE_NAME} <noreply@${FROM_DOMAIN}>`,
      sender_domain: SENDER_DOMAIN,
      subject,
      html,
      text,
      purpose: 'transactional',
      label: input.templateName,
      idempotency_key: messageId,
      unsubscribe_token: unsubscribeToken,
      queued_at: new Date().toISOString(),
      ...(input.replyTo ? { reply_to: input.replyTo } : {}),
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

export async function sendBookingConfirmationEmails(appointmentIds: string[]) {
  if (appointmentIds.length === 0) return []

  const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
  const origin = process.env.PUBLIC_APP_URL || process.env.APP_URL || 'https://modobook.uk'

  const { data: appts, error } = await supabaseAdmin
    .from('appointments')
    .select('id, patient_name, patient_email, scheduled_date, start_time, manage_token, profile_id, treatments(name), practitioners(name), locations(name, address_line1, city, postcode), profiles(clinic_name, slug)')
    .in('id', appointmentIds)

  if (error) throw error

  const brandingCache = new Map<string, PractitionerBranding>()
  const results: Array<{ appointmentId: string; ok: boolean; skipped?: string; error?: string }> = []

  for (const raw of appts ?? []) {
    const a = raw as {
      id: string
      patient_name: string | null
      patient_email: string | null
      scheduled_date: string
      start_time: string
      manage_token: string | null
      profile_id: string
      treatments?: { name?: string } | null
      practitioners?: { name?: string } | null
      locations?: { name?: string; address_line1?: string; city?: string; postcode?: string } | null
      profiles?: { clinic_name?: string; slug?: string } | null
    }

    if (!a.patient_email) continue

    let branding = brandingCache.get(a.profile_id)
    if (!branding) {
      branding = await getPractitionerBranding(a.profile_id)
      brandingCache.set(a.profile_id, branding)
    }

    const manageUrl = a.manage_token && a.profiles?.slug
      ? `${origin}/m/${a.profiles.slug}/manage/${a.manage_token}`
      : undefined
    const loc = a.locations
    const res = await tryEnqueueAppEmail({
      templateName: 'booking-confirmation',
      recipientEmail: a.patient_email,
      messageId: `booking-confirm-${a.id}`,
      templateData: {
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

  return results
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
