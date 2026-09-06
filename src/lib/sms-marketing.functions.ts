// SMS marketing blasts: audience, pay-up-front checkout, and send.
import { createServerFn } from '@tanstack/react-start'
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware'
import { z } from 'zod'
import { countSms, blastCost, SMS_MIN_TEXTS, SMS_PRICE_PENCE } from '@/lib/sms-count'

async function getOwnerProfileId(supabase: any, userId: string): Promise<string> {
  const { data: prof } = await supabase.from('profiles').select('id').eq('user_id', userId).maybeSingle()
  if (prof?.id) return prof.id as string
  const { data: staff } = await supabase
    .from('staff_members').select('profile_id').eq('user_id', userId).eq('status', 'active').maybeSingle()
  if (staff?.profile_id) return staff.profile_id as string
  throw new Error('No practitioner profile found for this account')
}

function normalisePhone(raw?: string | null) {
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
  if (digits.startsWith('0')) return `+44${digits.slice(1)}`
  if (digits.startsWith('44') && digits.length >= 11) return `+${digits}`
  return digits.length >= 8 ? `+44${digits}` : null
}

async function loadAudience(supabase: any, practitionerId: string) {
  const { data, error } = await supabase
    .from('clinic_clients')
    .select('id, full_name, phone, marketing_opt_in, archived, is_blocked, whatsapp_opt_out')
    .eq('profile_id', practitionerId)
    .eq('marketing_opt_in', true)
    .eq('archived', false)
    .eq('is_blocked', false)
    .not('phone', 'is', null)
  if (error) throw new Error(error.message)
  const seen = new Set<string>()
  const list: Array<{ id: string; name: string; phone: string }> = []
  for (const c of (data ?? []) as any[]) {
    if (c.whatsapp_opt_out) continue
    const phone = normalisePhone(c.phone)
    if (!phone || seen.has(phone)) continue
    seen.add(phone)
    list.push({ id: c.id as string, name: (c.full_name as string) ?? '', phone })
  }
  return list
}

export const getSmsBlastAudience = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const profileId = await getOwnerProfileId(context.supabase, context.userId)
    const list = await loadAudience(context.supabase, profileId)
    return { count: list.length, patients: list, pricePence: SMS_PRICE_PENCE, minTexts: SMS_MIN_TEXTS }
  })

export const listSmsBlasts = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const profileId = await getOwnerProfileId(context.supabase, context.userId)
    const { data, error } = await context.supabase
      .from('sms_blasts')
      .select('id, name, body, status, recipient_count, segments, billable_texts, total_pence, sent_count, failed_count, created_at, sent_at')
      .eq('practitioner_id', profileId)
      .order('created_at', { ascending: false })
      .limit(50)
    if (error) throw new Error(error.message)
    return data ?? []
  })

/** Create the blast and open MODO's Stripe checkout for it — pay first, send after. */
export const startSmsBlastCheckout = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) =>
    z.object({
      name: z.string().max(120).optional(),
      body: z.string().min(5).max(1600),
      recipientIds: z.array(z.string().uuid()).max(5000).optional(),
      successUrl: z.string().url(),
      cancelUrl: z.string().url(),
    }).parse(raw),
  )
  .handler(async ({ data, context }) => {
    const profileId = await getOwnerProfileId(context.supabase, context.userId)
    const { smsMarketingEnabled } = await import('./feature-flags')
    const { data: prof } = await context.supabase.from('profiles').select('slug').eq('id', profileId).maybeSingle()
    if (!smsMarketingEnabled((prof as { slug?: string | null } | null)?.slug)) {
      throw new Error('SMS marketing is coming soon for your account.')
    }
    const body = data.body.trim()
    const { segments } = countSms(body)
    if (segments < 1) throw new Error('Write your message first')

    const all = await loadAudience(context.supabase, profileId)
    if (!all.length) throw new Error('No patients have opted in to marketing texts yet')
    const audience = data.recipientIds?.length
      ? all.filter((p) => data.recipientIds!.includes(p.id))
      : all
    if (!audience.length) throw new Error('Select at least one patient to text')

    const { texts, pence } = blastCost(audience.length, segments)
    if (texts < SMS_MIN_TEXTS) {
      throw new Error(
        `Blasts start at ${SMS_MIN_TEXTS} texts. This one is only ${texts} — select more patients or lengthen the message.`,
      )
    }

    const { data: profile } = await context.supabase
      .from('profiles').select('id, email, clinic_name, full_name').eq('id', profileId).maybeSingle()

    const { data: blast, error: insErr } = await context.supabase
      .from('sms_blasts')
      .insert({
        practitioner_id: profileId,
        name: data.name?.trim() || 'SMS blast',
        body,
        recipient_count: audience.length,
        segments,
        billable_texts: texts,
        unit_price_pence: SMS_PRICE_PENCE,
        total_pence: pence,
        status: 'awaiting_payment',
        recipients: audience,
      } as never)
      .select('id')
      .single()
    if (insErr) throw new Error(insErr.message)
    const blastId = (blast as { id: string }).id

    const { getStripe } = await import('./stripe.server')
    const stripe = getStripe()
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      customer_email: (profile as any)?.email ?? undefined,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: 'gbp',
            unit_amount: pence,
            product_data: {
              name: `MODO SMS blast — ${texts} texts`,
              description: `${audience.length} patients × ${segments} text${segments > 1 ? 's' : ''} at 10p each`,
            },
          },
        },
      ],
      success_url: `${data.successUrl}${data.successUrl.includes('?') ? '&' : '?'}blast=${blastId}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: data.cancelUrl,
      metadata: { kind: 'sms_blast', sms_blast_id: blastId, profile_id: profileId },
      payment_intent_data: {
        metadata: { kind: 'sms_blast', sms_blast_id: blastId, profile_id: profileId },
      },
    })

    await context.supabase
      .from('sms_blasts')
      .update({ stripe_session_id: session.id } as never)
      .eq('id', blastId)

    return { url: session.url, blastId }
  })

/** Called when the practitioner lands back from Stripe — pays and sends if the webhook hasn't yet. */
export const confirmSmsBlast = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) =>
    z.object({ blastId: z.string().uuid(), sessionId: z.string().min(5) }).parse(raw),
  )
  .handler(async ({ data, context }) => {
    const profileId = await getOwnerProfileId(context.supabase, context.userId)
    const { data: blast } = await context.supabase
      .from('sms_blasts')
      .select('id, status, practitioner_id')
      .eq('id', data.blastId)
      .eq('practitioner_id', profileId)
      .maybeSingle()
    if (!blast) throw new Error('Blast not found')
    if ((blast as any).status !== 'awaiting_payment') {
      return { status: (blast as any).status as string }
    }

    const { getStripe } = await import('./stripe.server')
    const session = await getStripe().checkout.sessions.retrieve(data.sessionId)
    if (session.payment_status !== 'paid') return { status: 'awaiting_payment' }

    const { markBlastPaid, dispatchSmsBlast } = await import('./sms-blast.server')
    await markBlastPaid({
      blastId: data.blastId,
      sessionId: session.id,
      paymentIntentId: typeof session.payment_intent === 'string' ? session.payment_intent : null,
    })
    const res = await dispatchSmsBlast(data.blastId)
    return { status: 'sent', ...res }
  })

export const cancelSmsBlast = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => z.object({ id: z.string().uuid() }).parse(raw))
  .handler(async ({ data, context }) => {
    const profileId = await getOwnerProfileId(context.supabase, context.userId)
    const { error } = await context.supabase
      .from('sms_blasts')
      .delete()
      .eq('id', data.id)
      .eq('practitioner_id', profileId)
      .eq('status', 'awaiting_payment')
    if (error) throw new Error(error.message)
    return { ok: true }
  })

/** Free test: send the composed blast text to the practitioner's own phone only. */
export const sendSmsBlastTest = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) =>
    z.object({ body: z.string().min(1).max(1600) }).parse(raw),
  )
  .handler(async ({ data, context }) => {
    const profileId = await getOwnerProfileId(context.supabase, context.userId)
    const { data: prof } = await context.supabase
      .from('profiles')
      .select('phone, clinic_name')
      .eq('id', profileId)
      .maybeSingle()
    const phone = normalisePhone((prof as { phone?: string } | null)?.phone)
    if (!phone) throw new Error('Add a phone number to your clinic settings to send a test text.')
    const { sendWhatsApp } = await import('@/lib/whatsapp/send.server')
    const firstName =
      ((prof as { clinic_name?: string } | null)?.clinic_name ?? 'there').split(' ')[0] ?? 'there'
    const body = data.body.replaceAll('{{name}}', firstName)
    const result = await sendWhatsApp({
      profileId,
      kind: 'marketing',
      toPhone: phone,
      messageKey: `sms-blast-test-${profileId}-${Date.now()}`,
      body,
      force: true,
    })
    if (!result.ok) throw new Error(result.error ?? result.skipped ?? 'Test text failed to send')
    return { ok: true, phone }
  })
