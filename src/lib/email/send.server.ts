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
