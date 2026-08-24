import { createServerFn } from '@tanstack/react-start'
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware'

/** Send a live test text (GatewayAPI SMS) to the given number. */
export const sendWhatsAppTest = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { phone: string }) => input)
  .handler(async ({ data, context }) => {
    const { sendWhatsApp } = await import('@/lib/whatsapp/send.server')
    const { supabase, userId } = context
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, clinic_name')
      .eq('user_id', userId)
      .maybeSingle()
    const clinic = (profile as { clinic_name?: string } | null)?.clinic_name || 'your clinic'
    const res = await sendWhatsApp({
      profileId: (profile as { id?: string } | null)?.id ?? null,
      toPhone: data.phone,
      kind: 'test',
      force: true,
      messageKey: `test:${userId}:${Date.now()}`,
      body: `MODO test message from ${clinic}. Texts are working.`,
    })
    return {
      ok: !!res.ok,
      message: res.ok
        ? 'Test text sent.'
        : res.error || `Could not send (${res.skipped ?? 'unknown reason'}).`,
    }
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
