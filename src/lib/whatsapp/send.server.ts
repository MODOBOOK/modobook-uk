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

/** Maps a message kind to the profile column that gates it. */
const KIND_SETTING: Record<WhatsAppKind, string | null> = {
  'booking-confirmation': 'whatsapp_notify_confirmation',
  'appointment-reminder': 'whatsapp_notify_reminder',
  'booking-cancellation': 'whatsapp_notify_cancellation',
  'booking-reschedule': 'whatsapp_notify_cancellation',
  'rebook-reminder': 'whatsapp_notify_rebook',
  'topup-reminder': 'whatsapp_notify_rebook',
  'review-request': 'whatsapp_notify_rebook',
  test: null,
}


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

const settingsCache = new Map<string, ClinicWhatsAppSettings>()

export async function getClinicWhatsAppSettings(
  profileId?: string | null,
): Promise<ClinicWhatsAppSettings | null> {
  if (!profileId) return null
  const cached = settingsCache.get(profileId)
  if (cached) return cached
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
  const { data } = await supabaseAdmin
    .from('profiles')
    .select(
      'clinic_name, whatsapp_reminders_enabled, whatsapp_notify_confirmation, whatsapp_notify_reminder, whatsapp_notify_cancellation, whatsapp_notify_rebook',
    )
    .eq('id', profileId)
    .maybeSingle()
  if (!data) return null
  const row = data as Record<string, unknown>
  const value: ClinicWhatsAppSettings = {
    enabled: !!row.whatsapp_reminders_enabled,
    clinicName: (row.clinic_name as string) || 'your clinic',
    settings: row,
  }
  settingsCache.set(profileId, value)
  return value
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

    // Per-clinic master switch + per-message-type switch
    if (!input.force) {
      const cfg = await getClinicWhatsAppSettings(input.profileId)
      if (!cfg || !cfg.enabled) return { ok: false, skipped: 'clinic-disabled' }
      const key = KIND_SETTING[input.kind]
      if (key && cfg.settings[key] === false) return { ok: false, skipped: 'kind-disabled' }
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
      body: input.body,
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
    const smsSender = (process.env['MODO_SMS_SENDER'] || 'MODO').slice(0, 11)

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
      const smsBody = input.body
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
          Body: input.body,
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
      const parsed = JSON.parse(text) as { sid?: string; id?: string | number; ids?: Array<string | number> }
      sid = parsed.sid ?? (parsed.id != null ? String(parsed.id) : undefined) ?? (parsed.ids?.[0] != null ? String(parsed.ids[0]) : undefined)
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

const SIGN_OFF = 'Sent by MODO on behalf of your clinic. Reply STOP to opt out.'

function line(...parts: Array<string | undefined | null>) {
  return parts.filter(Boolean).join('\n')
}

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
  const where = c.locationName
    ? `📍 ${[c.locationName, c.locationAddress].filter(Boolean).join(' — ')}`
    : null
  // Short, single-segment location for SMS: prefer the street address, fall
  // back to the location name when no address is stored.
  const shortWhere = [c.locationAddress, c.locationName].find(
    (v) => typeof v === 'string' && v.trim().length > 0,
  )
  const at = shortWhere ? ` at ${String(shortWhere).replace(/\s*\n\s*/g, ', ').trim()}` : ''

  switch (kind) {
    case 'booking-confirmation':
      return line(
        `Hi ${first}, you're booked with ${clinic}${c.dateTime ? ` at ${c.dateTime}` : ''}${at}. See you then!`,
      )

    // Kept as short as possible (no sign-off, no emoji) to minimise cost.
    case 'appointment-reminder':
      return `Hi ${first}, reminder: ${clinic}${c.dateTime ? ` ${c.dateTime}` : ''}${at}. See you then!`

    case 'review-request':
      return `Hi ${first}, thanks for visiting ${clinic}. Mind leaving us a quick review?${
        c.reviewUrl ? ` ${c.reviewUrl}` : ''
      }`


    case 'booking-cancellation':
      return line(
        `Hi ${first}, your appointment with ${clinic} has been cancelled.`,
        '',
        `💉 ${treatment}`,
        c.dateTime ? `🗓 ${c.dateTime}` : null,
        c.bookingUrl ? `\nRebook any time: ${c.bookingUrl}` : null,
        '',
        SIGN_OFF,
      )
    case 'booking-reschedule':
      return line(
        `Hi ${first}, your appointment with ${clinic} has been moved.`,
        '',
        `💉 ${treatment}`,
        c.dateTime ? `🗓 New time: ${c.dateTime}` : null,
        where,
        c.manageUrl ? `\nView booking: ${c.manageUrl}` : null,
        '',
        SIGN_OFF,
      )
    case 'rebook-reminder':
      return line(
        `Hi ${first}, it's about time for your next ${treatment} at ${clinic} ✨`,
        c.bookingUrl ? `\nBook your slot: ${c.bookingUrl}` : null,
        '',
        SIGN_OFF,
      )
    case 'topup-reminder':
      return line(
        `Hi ${first}, your ${treatment} is due a top-up at ${clinic} 💫`,
        `Keeping on schedule gives the best, most natural results.`,
        c.bookingUrl ? `\nBook your top-up: ${c.bookingUrl}` : null,
        '',
        SIGN_OFF,
      )
    default:
      return line(
        `Test message from MODO for ${clinic} ✅`,
        'If you can read this, WhatsApp notifications are working.',
      )
  }
}
