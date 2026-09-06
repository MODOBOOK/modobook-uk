// Dispatching a paid SMS marketing blast.
//
// Money first: a blast is only ever dispatched once its Stripe payment has
// landed (webhook or the return-from-checkout confirmation). Both entry points
// call dispatchSmsBlast, which claims the row atomically so a retried webhook
// can never double-text a patient.

export interface BlastRecipient {
  id?: string | null
  name?: string | null
  phone: string
}

export async function markBlastPaid(params: {
  blastId: string
  sessionId?: string | null
  paymentIntentId?: string | null
}) {
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
  const { data } = await supabaseAdmin
    .from('sms_blasts')
    .update({
      status: 'paid',
      paid_at: new Date().toISOString(),
      ...(params.sessionId ? { stripe_session_id: params.sessionId } : {}),
      ...(params.paymentIntentId ? { stripe_payment_intent: params.paymentIntentId } : {}),
    } as never)
    .eq('id', params.blastId)
    .eq('status', 'awaiting_payment')
    .select('id')
    .maybeSingle()
  return !!data
}

/**
 * Send a paid blast. Safe to call more than once — only the run that flips the
 * row from `paid` to `sending` actually sends.
 */
export async function dispatchSmsBlast(blastId: string) {
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server')

  const { data: claimed } = await supabaseAdmin
    .from('sms_blasts')
    .update({ status: 'sending' } as never)
    .eq('id', blastId)
    .eq('status', 'paid')
    .select('id, practitioner_id, body, recipients')
    .maybeSingle()
  if (!claimed) return { ok: false, skipped: 'not-payable' as const }

  const row = claimed as unknown as {
    id: string
    practitioner_id: string
    body: string
    recipients: BlastRecipient[]
  }
  const recipients = Array.isArray(row.recipients) ? row.recipients : []
  const { sendWhatsApp } = await import('@/lib/whatsapp/send.server')

  let sent = 0
  let failed = 0
  for (const r of recipients) {
    if (!r?.phone) { failed += 1; continue }
    const first = String(r.name ?? '').trim().split(/\s+/)[0] || 'there'
    const body = row.body.replace(/\{\{\s*(name|first_name)\s*\}\}/gi, first)
    const res = await sendWhatsApp({
      profileId: row.practitioner_id,
      kind: 'marketing',
      toPhone: r.phone,
      messageKey: `blast-${row.id}-${(r.id ?? r.phone).toString()}`,
      body,
    })
    if (res.ok) sent += 1
    else failed += 1
  }

  await supabaseAdmin
    .from('sms_blasts')
    .update({
      status: 'sent',
      sent_at: new Date().toISOString(),
      sent_count: sent,
      failed_count: failed,
    } as never)
    .eq('id', row.id)

  return { ok: true, sent, failed }
}
