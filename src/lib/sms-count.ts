// Character / segment counting for SMS marketing blasts.
// Client-safe: used by the composer to show the live counter and cost.

const GSM7 =
  '@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !"#¤%&\'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà'
const GSM7_EXT = '^{}\\[~]|€'

export interface SmsCount {
  /** Billable characters (extended GSM chars count as 2). */
  chars: number
  /** How many texts one message costs. */
  segments: number
  /** Characters left in the current segment. */
  remaining: number
  /** True when the message contains characters outside the GSM alphabet. */
  unicode: boolean
  perSegment: number
}

export function countSms(input: string): SmsCount {
  const text = input ?? ''
  let unicode = false
  let chars = 0
  for (const ch of text) {
    if (GSM7.includes(ch)) chars += 1
    else if (GSM7_EXT.includes(ch)) chars += 2
    else {
      unicode = true
      // Surrogate pairs (emoji) take two UCS-2 units
      chars += ch.length
    }
  }
  if (unicode) {
    chars = Array.from(text).reduce((n, ch) => n + ch.length, 0)
  }
  const single = unicode ? 70 : 160
  const multi = unicode ? 67 : 153
  const perSegment = chars <= single ? single : multi
  const segments = chars === 0 ? 0 : chars <= single ? 1 : Math.ceil(chars / multi)
  const used = segments <= 1 ? chars : chars % multi
  return {
    chars,
    segments,
    unicode,
    perSegment,
    remaining: segments <= 1 ? single - chars : (used === 0 ? 0 : multi - used),
  }
}

/** £0.10 per text sent. One recipient can cost several texts on long messages. */
export const SMS_PRICE_PENCE = 10
/** A blast has to be worth at least 20 texts before it can be paid for. */
export const SMS_MIN_TEXTS = 20

export function blastCost(recipients: number, segments: number) {
  const texts = Math.max(0, recipients) * Math.max(0, segments)
  return { texts, pence: texts * SMS_PRICE_PENCE }
}

export function formatPence(pence: number) {
  return `£${(pence / 100).toFixed(2)}`
}
