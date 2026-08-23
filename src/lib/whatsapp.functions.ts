import { createServerFn } from '@tanstack/react-start'
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware'

/**
 * Patient text/WhatsApp messaging is not live at MODO level yet, so this test
 * endpoint is disabled for every clinic. Restore the send logic only when
 * sending is genuinely switched on.
 */
export const sendWhatsAppTest = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { phone: string }) => input)
  .handler(async () => ({
    ok: false as boolean,
    message: 'Patient text messaging is not available yet.',
  }))

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
