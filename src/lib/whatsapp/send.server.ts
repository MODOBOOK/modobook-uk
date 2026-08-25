// Server-side WhatsApp sending for MODO.
//
// All WhatsApp messages go out from ONE MODO-branded WhatsApp Business sender
// via Twilio (routed through the Lovable connector gateway). Each clinic
// switches WhatsApp on/off for themselves in Booking settings, and can pick
// which message types go out. Patients can be opted out individually
// (clinic_clients.whatsapp_opt_out).
//
// Sending is idempotent: every message carries a stable `messageKey` and the
// first write to public.whatsapp_send_log (unique on message_key) wins, so a
// retried cron run or duplicated webhook never double-texts a patient.
//
// If the Twilio credentials aren't configured yet the send is recorded with
// status 'not_configured' and skipped — nothing breaks, and the log shows
// exactly what would have gone out.

const GATEWAY_URL = 'https://connector-gateway.lovable.dev/twilio'

export type WhatsAppKind =
  | 'booking-confirmation'
  | 'appointment-reminder'
  | 'booking-cancellation'
  | 'booking-reschedule'
  | 'rebook-reminder'
  | 'topup-reminder'
  | 'review-request'
  | 'test'

// Per-message-type control now lives in profiles.sms_channels (text / email /
// both / off), edited by the clinic in Booking settings.


export interface SendWhatsAppInput {
  profileId?: string | null
  appointmentId?: string | null
  kind: WhatsAppKind
  /** Raw phone as stored on the patient record. */
  toPhone?: string | null
  /** Stable idempotency key, e.g. `wa-confirm-<appointmentId>`. */
  messageKey: string
  /** Fully rendered message text. */
  body: string
  /** Skip the per-clinic toggle check (used by the "send me a test" action). */
  force?: boolean
  /** Merge values so a clinic's custom template can be rendered instead. */
  templateCtx?: ApptMessageContext
}

export interface SendWhatsAppResult {
  ok: boolean
  skipped?: string
  error?: string
  sid?: string
}

/**
 * Normalise a UK-centric phone number to E.164.
 * Returns null when the input can't be turned into something sendable.
 */
export function toE164(raw?: string | null, defaultCountry = '44'): string | null {
  if (!raw) return null
  let s = String(raw).trim().replace(/[\s()\-.]/g, '')
  if (!s) return null
  if (s.startsWith('00')) s = `+${s.slice(2)}`
  if (s.startsWith('+')) {
    const digits = s.slice(1).replace(/\D/g, '')
    return digits.length >= 8 && digits.length <= 15 ? `+${digits}` : null
  }
  const digits = s.replace(/\D/g, '')
  if (!digits) return null
  // UK national format: 07... -> +447...
  if (digits.startsWith('0')) return `+${defaultCountry}${digits.slice(1)}`
  if (digits.startsWith(defaultCountry) && digits.length >= 11) return `+${digits}`
  return digits.length >= 8 ? `+${defaultCountry}${digits}` : null
}

interface ClinicWhatsAppSettings {
  enabled: boolean
  clinicName: string
  settings: Record<string, unknown>
}

// Short TTL so a clinic toggling their text settings sees them apply within
// seconds rather than for the lifetime of the server instance.
const SETTINGS_TTL_MS = 15_000
const settingsCache = new Map<string, { at: number; value: ClinicWhatsAppSettings }>()

export async function getClinicWhatsAppSettings(
  profileId?: string | null,
): Promise<ClinicWhatsAppSettings | null> {
  if (!profileId) return null
  const cached = settingsCache.get(profileId)
  if (cached && Date.now() - cached.at < SETTINGS_TTL_MS) return cached.value
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
  const { data } = await supabaseAdmin
    .from('profiles')
    .select(
      'slug, clinic_name, sms_templates, sms_channels, sms_timings, whatsapp_reminders_enabled, whatsapp_notify_confirmation, whatsapp_notify_reminder, whatsapp_notify_cancellation, whatsapp_notify_rebook',
    )
    .eq('id', profileId)
    .maybeSingle()
  if (!data) return null
  const row = data as Record<string, unknown>
  const { whatsappMessagingEnabled } = await import('@/lib/feature-flags')
  const allowed = whatsappMessagingEnabled((row.slug as string) ?? null)
  const value: ClinicWhatsAppSettings = {
    enabled: allowed && !!row.whatsapp_reminders_enabled,
    clinicName: (row.clinic_name as string) || 'your clinic',
    settings: row,
  }
  settingsCache.set(profileId, { at: Date.now(), value })
  return value
}

/** When each text goes out for this clinic (safe defaults when unset). */
export async function getSmsTimings(profileId?: string | null) {
  const { parseSmsTimings } = await import('@/lib/whatsapp/templates')
  const cfg = await getClinicWhatsAppSettings(profileId)
  return parseSmsTimings(cfg?.settings.sms_timings)
}

/** Is this clinic allowed to use SMS at all (pilot allowlist)? */
export async function clinicSmsAllowed(profileId?: string | null) {
  if (!profileId) return false
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
  const { data } = await supabaseAdmin
    .from('profiles')
    .select('slug')
    .eq('id', profileId)
    .maybeSingle()
  const { whatsappMessagingEnabled } = await import('@/lib/feature-flags')
  return whatsappMessagingEnabled((data as { slug?: string } | null)?.slug ?? null)
}


/** Has this patient opted out of WhatsApp at this clinic? */
async function patientOptedOut(profileId?: string | null, phone?: string | null) {
  if (!profileId || !phone) return false
  try {
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
    const { data } = await supabaseAdmin
      .from('clinic_clients')
      .select('whatsapp_opt_out')
      .eq('profile_id', profileId)
      .eq('phone', phone)
      .maybeSingle()
    return !!(data as { whatsapp_opt_out?: boolean } | null)?.whatsapp_opt_out
  } catch {
    return false
  }
}

/**
 * Send one WhatsApp message. Safe to call from any server path — it never
 * throws; failures are logged and returned.
 */
export async function sendWhatsApp(input: SendWhatsAppInput): Promise<SendWhatsAppResult> {
  try {
    const to = toE164(input.toPhone)
    if (!to) return { ok: false, skipped: 'no-phone' }

    // Pilot allowlist: clinics outside it can never send (even test messages)
    if (input.profileId && !(await clinicSmsAllowed(input.profileId))) {
      return { ok: false, skipped: 'clinic-not-enabled' }
    }

    // Per-clinic master switch + per-message-type switch
    if (!input.force) {
      const cfg = await getClinicWhatsAppSettings(input.profileId)
      if (!cfg || !cfg.enabled) return { ok: false, skipped: 'clinic-disabled' }
    }


    // Clinic's own wording + channel choice (text / email / both)
    let body = input.body
    if (input.profileId) {
      const cfg = await getClinicWhatsAppSettings(input.profileId)
      const { channelFor, renderSmsTemplate, defaultSmsTemplate } = await import(
        '@/lib/whatsapp/templates'
      )
      const key = input.kind as never
      if (input.kind !== 'test') {
        const channel = channelFor(
          (cfg?.settings.sms_channels as Record<string, unknown>) ?? null,
          key,
        )
        if (!input.force && (channel === 'email' || channel === 'off')) {
          return { ok: false, skipped: 'channel-email-only' }
        }
        const custom = (cfg?.settings.sms_templates as Record<string, unknown>)?.[input.kind]
        if (typeof custom === 'string' && custom.trim() && input.templateCtx) {
          const c = input.templateCtx
          body = renderSmsTemplate(custom.trim() || defaultSmsTemplate(key), {
            name: c.patientName,
            clinic: c.clinicName ?? cfg?.clinicName,
            treatment: c.treatmentName,
            date: c.dateTime,
            // Addresses and links are never sent by text — UK carriers filter them.
            location: undefined,
            link: undefined,
          })
        }
      }
    }

    // Demo clinics never send real messages
    try {
      const dm = await import('@/lib/demo.server')
      if (input.profileId && (await dm.isDemoProfile(input.profileId))) {
        return { ok: true, skipped: 'demo-mode' }
      }
    } catch { /* demo helper optional */ }

    if (!input.force && (await patientOptedOut(input.profileId, input.toPhone))) {
      return { ok: false, skipped: 'patient-opted-out' }
    }

    const { supabaseAdmin } = await import('@/integrations/supabase/client.server')

    // Idempotency: claim the message_key first. A duplicate insert means this
    // message already went out (or is in flight) — skip.
    const { error: claimErr } = await supabaseAdmin.from('whatsapp_send_log').insert({
      profile_id: input.profileId ?? null,
      appointment_id: input.appointmentId ?? null,
      kind: input.kind,
      to_phone: to,
      message_key: input.messageKey,
      body,
      status: 'queued',
    } as never)
    if (claimErr) {
      if ((claimErr as { code?: string }).code === '23505') return { ok: true, skipped: 'duplicate' }
      console.error('[whatsapp] log insert failed', claimErr)
    }

    const lovableKey = process.env['LOVABLE_API_KEY']
    const gatewayApiKey = process.env['GATEWAYAPI_API_KEY']
    const twilioKey = process.env['TWILIO_API_KEY']
    const from = process.env['MODO_WHATSAPP_FROM']
    // Always identify SMS as MODO. Never allow an environment override to
    // replace this with a phone number or clinic-specific sender.
    const smsSender = 'MODO'

    async function mark(status: string, patch: Record<string, unknown> = {}) {
      await supabaseAdmin
        .from('whatsapp_send_log')
        .update({ status, ...patch } as never)
        .eq('message_key', input.messageKey)
        .then(() => {}, () => {})
    }

    // Provider preference: GatewayAPI SMS (cheapest, no Meta approval needed),
    // falling back to Twilio WhatsApp when that's the configured route.
    const useSms = !!(lovableKey && gatewayApiKey)
    const useWhatsApp = !useSms && !!(lovableKey && twilioKey && from)

    if (!useSms && !useWhatsApp) {
      await mark('not_configured')
      return { ok: false, skipped: 'not-configured' }
    }

    let res: Response
    if (useSms) {
      // UK networks content-filter SMS containing emoji / unusual symbols
      // (GatewayAPI status 0x1904 "Message filtered by content"), so strip
      // everything back to plain GSM-friendly text for the SMS route.
      const { stripSmsUnsafe } = await import('@/lib/whatsapp/templates')
      const smsBody = stripSmsUnsafe(body)
        .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{2190}-\u{21FF}\u{2B00}-\u{2BFF}]/gu, '')
        .replace(/[“”]/g, '"')
        .replace(/[‘’]/g, "'")
        .replace(/[–—]/g, '-')
        .replace(/[ \t]+/g, ' ')
        .replace(/\n{3,}/g, '\n\n')
        .trim()
      res = await fetch('https://connector-gateway.lovable.dev/gatewayapi/mobile/single', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${lovableKey}`,
          'X-Connection-Api-Key': gatewayApiKey!,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sender: smsSender,
          recipient: Number(to.replace(/\D/g, '')),
          message: smsBody,
          reference: input.messageKey,
        }),
      })
    } else {
      res = await fetch(`${GATEWAY_URL}/Messages.json`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${lovableKey}`,
          'X-Connection-Api-Key': twilioKey!,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          To: `whatsapp:${to}`,
          From: from!.startsWith('whatsapp:') ? from! : `whatsapp:${toE164(from!) ?? from!}`,
          Body: body,
        }),
      })
    }

    const text = await res.text()
    if (!res.ok) {
      console.error(`[messaging] send failed [${res.status}]: ${text}`)
      await mark('failed', { error: `${res.status}: ${text.slice(0, 500)}` })
      return { ok: false, error: `${res.status}: ${text}` }
    }


    let sid: string | undefined
    try {
      const parsed = JSON.parse(text) as {
        sid?: string
        msg_id?: string | number
        id?: string | number
        ids?: Array<string | number>
      }
      sid =
        parsed.sid ??
        (parsed.msg_id != null ? String(parsed.msg_id) : undefined) ??
        (parsed.id != null ? String(parsed.id) : undefined) ??
        (parsed.ids?.[0] != null ? String(parsed.ids[0]) : undefined)
    } catch { /* non-JSON */ }

    await mark('sent', { provider_sid: sid ?? null })
    return { ok: true, sid }
  } catch (e) {
    console.error('[whatsapp] unexpected failure', e)
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

// ---------------------------------------------------------------------------
// Message copy
// ---------------------------------------------------------------------------

export interface ApptMessageContext {
  patientName?: string | null
  clinicName?: string | null
  treatmentName?: string | null
  dateTime?: string | null
  locationName?: string | null
  locationAddress?: string | null
  manageUrl?: string | null
  bookingUrl?: string | null
  reviewUrl?: string | null
  hoursBefore?: number | null
}

export function buildWhatsAppBody(kind: WhatsAppKind, c: ApptMessageContext): string {
  const first = (c.patientName ?? '').split(' ')[0] || 'there'
  const clinic = c.clinicName || 'your clinic'
  const treatment = c.treatmentName || 'your appointment'
  const when = c.dateTime ? ` on ${c.dateTime}` : ''

  // Texts carry treatment, clinic, date/time only. No addresses, no links —
  // UK networks content-filter those (GatewayAPI 0x1904).
  switch (kind) {
    case 'booking-confirmation':
      return `Hi ${first}, you're booked in for ${treatment} with ${clinic}${when}. See you then!`
    case 'appointment-reminder':
      return `Hi ${first}, reminder: ${treatment} with ${clinic}${when}. See you then!`
    case 'review-request':
      return `Hi ${first}, your appointment with ${clinic} is complete. Check your emails for your review and aftercare. Any issues, please contact your practitioner.`
    case 'booking-cancellation':
      return `Hi ${first}, your ${treatment} with ${clinic}${when} has been cancelled. Check your email to rebook.`
    case 'booking-reschedule':
      return `Hi ${first}, your ${treatment} with ${clinic} has moved${when ? ` to ${c.dateTime}` : ''}. See you then!`
    case 'rebook-reminder':
      return `Hi ${first}, it's about time for your next ${treatment} at ${clinic}. Check your email to book.`
    case 'topup-reminder':
      return `Hi ${first}, your ${treatment} at ${clinic} is due a top-up. Check your email to book.`
    default:
      return `Test message from MODO for ${clinic}. If you can read this, texts are working.`
  }
}


/**
 * Convenience for call sites: renders the built-in copy and passes the merge
 * context along so a clinic's own template can replace it at send time.
 */
export function smsMessage(kind: WhatsAppKind, ctx: ApptMessageContext) {
  return { body: buildWhatsAppBody(kind, ctx), templateCtx: ctx }
}
