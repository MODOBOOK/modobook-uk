// Shared (client + server safe) definitions for editable SMS templates.
//
// Each clinic can override the wording per message type and choose whether
// that message goes out by text, email, or both. Email templates themselves
// are untouched — the channel choice only decides whether each channel fires.

export type SmsTemplateKey =
  | 'booking-confirmation'
  | 'appointment-reminder'
  | 'booking-cancellation'
  | 'booking-reschedule'
  | 'rebook-reminder'
  | 'topup-reminder'
  | 'review-request'

export type MessageChannel = 'sms' | 'email' | 'both' | 'off'

/** One SMS segment for plain GSM text is 160 chars; we warn from 155. */
export const SMS_SOFT_LIMIT = 155
export const SMS_SEGMENT_SIZE = 160

export function smsSegments(text: string) {
  const len = text.length
  if (len <= SMS_SEGMENT_SIZE) return 1
  // Concatenated messages carry a header, leaving 153 chars per part.
  return Math.ceil(len / 153)
}

export interface SmsTemplateMeta {
  key: SmsTemplateKey
  label: string
  hint: string
  /** Merge tags that make sense for this message. */
  tags: string[]
  default: string
}

// Links are never sent by text (UK carriers content-filter them), so {link}
// isn't offered. {location} inserts the location name; {address} inserts the
// full address and is only used on messages the patient needs it for.
export const MERGE_TAGS = ['{name}', '{clinic}', '{location}', '{address}', '{date}', '{time}'] as const

/** Messages where the full address is allowed (the patient needs to travel). */
export const ADDRESS_KINDS: SmsTemplateKey[] = [
  'booking-confirmation',
  'appointment-reminder',
  'booking-reschedule',
]

export function allowsAddress(key: string) {
  return (ADDRESS_KINDS as string[]).includes(key)
}

/**
 * Only these message types can go out by SMS. Everything else (cancellation,
 * reschedule, rebook, top-up) is email-only to keep text costs down — SMS is
 * reserved for the three highest-value moments.
 */
export const SMS_ENABLED_KEYS: SmsTemplateKey[] = [
  'booking-confirmation',
  'appointment-reminder',
  'review-request',
]

export function smsCapable(key: string) {
  return (SMS_ENABLED_KEYS as string[]).includes(key)
}

export const SMS_TEMPLATES: SmsTemplateMeta[] = [
  {
    key: 'booking-confirmation',
    label: 'Booking confirmation',
    hint: 'Sent as soon as a booking is made.',
    tags: ['{name}', '{clinic}', '{location}', '{address}', '{date}', '{time}'],
    default: "Hi {name}, you're booked in with {clinic} at {location} on {date} at {time}. {address}",
  },
  {
    key: 'appointment-reminder',
    label: 'Appointment reminder',
    hint: 'Follows your email reminder timings.',
    tags: ['{name}', '{clinic}', '{location}', '{address}', '{date}', '{time}'],
    default: 'Hi {name}, reminder: your appointment with {clinic} at {location} on {date} at {time}. {address}',
  },
  {
    key: 'booking-cancellation',
    label: 'Cancellation',
    hint: 'Sent when an appointment is cancelled.',
    tags: ['{name}', '{clinic}', '{location}', '{date}', '{time}'],
    default:
      'Hi {name}, your appointment with {clinic} at {location} on {date} at {time} has been cancelled. Check your email to rebook.',
  },
  {
    key: 'booking-reschedule',
    label: 'Reschedule',
    hint: 'Sent when an appointment is moved.',
    tags: ['{name}', '{clinic}', '{location}', '{address}', '{date}', '{time}'],
    default: 'Hi {name}, your appointment with {clinic} at {location} has moved to {date} at {time}. {address}',
  },
  // The four below are kept for template storage/back-compat but are
  // email-only — see SMS_ENABLED_KEYS.
  {
    key: 'rebook-reminder',
    label: 'Rebook reminder',
    hint: 'When a treatment is due again.',
    tags: ['{name}', '{clinic}', '{location}'],
    default:
      "Hi {name}, it's about time for your next appointment with {clinic} at {location}. Check your email to book.",
  },
  {
    key: 'topup-reminder',
    label: 'Top-up reminder',
    hint: 'When a treatment is due a top-up.',
    tags: ['{name}', '{clinic}', '{location}'],
    default:
      'Hi {name}, your treatment with {clinic} at {location} is due a top-up. Check your email to book.',
  },
  {
    key: 'review-request',
    label: 'Aftercare & review',
    hint: 'Sent about 2 hours after the appointment, pointing patients to their aftercare and review link.',
    tags: ['{name}', '{clinic}'],
    default:
      'Hi {name}, your appointment with {clinic} is complete. Check your emails for your review link and aftercare. Any issues, please contact your practitioner.',
  },
]

/**
 * Strip anything UK networks content-filter out of SMS: URLs and email
 * addresses (always), plus postcodes unless the message is one that needs the
 * address (booking confirmation / reminder / reschedule).
 */
export function stripSmsUnsafe(text: string, opts?: { keepAddress?: boolean }) {
  let out = text
    .replace(/\b(?:https?:\/\/|www\.)\S+/gi, '')
    .replace(/\b[\w.+-]+@[\w-]+\.[\w.-]+\b/gi, '')
  if (!opts?.keepAddress) out = out.replace(/\b[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2}\b/gi, '')
  return out
    .replace(/\b[\w-]+\.(?:com|co\.uk|uk|net|org|io|app|link)\b\/?\S*/gi, '')
    .replace(/\s+(?:at|from|:)\s*(?=[.,!]|$)/gm, '')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\s+([.,!])/g, '$1')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export function defaultSmsTemplate(key: SmsTemplateKey) {
  return SMS_TEMPLATES.find((t) => t.key === key)?.default ?? ''
}

export interface SmsMergeValues {
  name?: string | null
  clinic?: string | null
  treatment?: string | null
  date?: string | null
  location?: string | null
  address?: string | null
  link?: string | null
}

/** Replace merge tags; unresolved tags (and any stray punctuation) are cleaned up. */
export function renderSmsTemplate(
  template: string,
  values: SmsMergeValues,
  opts?: { keepAddress?: boolean },
) {
  const map: Record<string, string> = {
    '{name}': (values.name ?? '').split(' ')[0] || 'there',
    '{clinic}': values.clinic || 'your clinic',
    '{treatment}': values.treatment || 'your treatment',
    '{date}': values.date || '',
    '{location}': (values.location ?? '').trim(),
    '{address}': opts?.keepAddress ? (values.address ?? '').trim() : '',
    '{link}': '',
  }
  let out = template
  // Drop "at {location}" entirely when there is no location for the booking.
  if (!map['{location}']) out = out.replace(/\s*\bat\s+\{location\}/gi, '')
  for (const [tag, val] of Object.entries(map)) {
    out = out.split(tag).join(val)
  }
  return stripSmsUnsafe(
    out
      .replace(/\s+at\s*(?=[.,!]|$)/gm, '')
      .replace(/\s{2,}/g, ' ')
      .replace(/\s+([.,!])/g, '$1')
      .trim(),
    { keepAddress: opts?.keepAddress },
  )
}

/** Default channel when a clinic hasn't chosen one. */
export const DEFAULT_CHANNEL: MessageChannel = 'both'

export function channelFor(
  channels: Record<string, unknown> | null | undefined,
  key: SmsTemplateKey,
): MessageChannel {
  // Non-SMS-capable kinds are always email-only regardless of stored choice.
  if (!smsCapable(key)) return 'email'
  const v = channels?.[key]
  return v === 'sms' || v === 'email' || v === 'off' || v === 'both' ? v : DEFAULT_CHANNEL
}

// ---------------------------------------------------------------------------
// Timings — when each text goes out
// ---------------------------------------------------------------------------

export interface SmsTimings {
  /** Minutes to wait after a booking before the confirmation text (0 = instant). */
  confirmationDelayMinutes: number
  /** Hours before the appointment to send reminder texts (one text per entry). */
  reminderHoursBefore: number[]
  /** Hours after the appointment ends before the review text. */
  reviewDelayHours: number
}

export const DEFAULT_SMS_TIMINGS: SmsTimings = {
  confirmationDelayMinutes: 0,
  reminderHoursBefore: [24],
  reviewDelayHours: 2,
}

export const CONFIRMATION_DELAY_OPTIONS = [
  { value: 0, label: 'Straight away' },
  { value: 5, label: '5 minutes after' },
  { value: 15, label: '15 minutes after' },
  { value: 60, label: '1 hour after' },
]

export const REMINDER_HOUR_OPTIONS = [
  { value: 1, label: '1 hour before' },
  { value: 2, label: '2 hours before' },
  { value: 24, label: '24 hours before' },
  { value: 48, label: '48 hours before' },
  { value: 72, label: '3 days before' },
  { value: 168, label: '1 week before' },
]

export const REVIEW_DELAY_OPTIONS = [
  { value: 1, label: '1 hour after' },
  { value: 2, label: '2 hours after' },
  { value: 4, label: '4 hours after' },
  { value: 24, label: 'Next day (24h)' },
]

/** Parse the stored jsonb into safe, bounded values. */
export function parseSmsTimings(raw: unknown): SmsTimings {
  const o = (raw ?? {}) as Record<string, unknown>
  const num = (v: unknown, fallback: number, min: number, max: number) => {
    const n = Number(v)
    if (!Number.isFinite(n)) return fallback
    return Math.min(max, Math.max(min, Math.round(n)))
  }
  const hoursRaw = Array.isArray(o.reminderHoursBefore) ? o.reminderHoursBefore : undefined
  const hours = hoursRaw
    ? Array.from(
        new Set(
          hoursRaw
            .map((h) => Number(h))
            .filter((h) => Number.isFinite(h) && h > 0 && h <= 336)
            .map((h) => Math.round(h)),
        ),
      ).sort((a, b) => a - b)
    : DEFAULT_SMS_TIMINGS.reminderHoursBefore
  return {
    confirmationDelayMinutes: num(
      o.confirmationDelayMinutes,
      DEFAULT_SMS_TIMINGS.confirmationDelayMinutes,
      0,
      1440,
    ),
    reminderHoursBefore: hours,
    reviewDelayHours: num(o.reviewDelayHours, DEFAULT_SMS_TIMINGS.reviewDelayHours, 0, 168),
  }
}

