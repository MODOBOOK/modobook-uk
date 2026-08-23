import { createServerFn } from '@tanstack/react-start'
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware'

/** Sends a one-off test WhatsApp message to the practitioner's own number. */
export const sendWhatsAppTest = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { phone: string }) => input)
  .handler(async ({ data, context }) => {
    // Patient messaging is not live at MODO level yet — no clinic may test or
    // trigger it. Remove this guard only when sending is genuinely switched on.
    return {
      ok: false,
      message: 'Patient text messaging is not available yet.',
    }
    // eslint-disable-next-line no-unreachable
    const { supabase, userId } = context
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, clinic_name')
      .eq('user_id', userId)
      .maybeSingle()
    if (!profile) throw new Error('Profile not found')


    const { sendWhatsApp, buildWhatsAppBody, toE164 } = await import('@/lib/whatsapp/send.server')
    const to = toE164(data.phone)
    if (!to) return { ok: false, message: "That doesn't look like a valid mobile number." }

    const res = await sendWhatsApp({
      profileId: profile.id,
      kind: 'test',
      toPhone: to,
      messageKey: `wa-test-${profile.id}-${Date.now()}`,
      body: buildWhatsAppBody('test', { clinicName: profile.clinic_name }),
      force: true,
    })

    if (res.ok) return { ok: true, message: `Test sent to ${to}.` }
    if (res.skipped === 'not-configured') {
      return {
        ok: false,
        message: 'WhatsApp sending is not switched on at MODO level yet — nothing was sent.',
      }
    }
    return { ok: false, message: res.error || res.skipped || 'Could not send.' }
  })

/** Recent WhatsApp activity for the signed-in clinic. */
export const listWhatsAppLog = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context
    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle()
    if (!profile) return []
    const { data } = await supabase
      .from('whatsapp_send_log')
      .select('id, kind, to_phone, status, error, created_at')
      .eq('profile_id', profile.id)
      .order('created_at', { ascending: false })
      .limit(20)
    return (data ?? []) as Array<{
      id: string
      kind: string
      to_phone: string
      status: string
      error: string | null
      created_at: string
    }>
  })
