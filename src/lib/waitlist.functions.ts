// Public server function used by the landing page waitlist form. Inserts
// the row (bypassing RLS via service role) and enqueues a welcome email.
import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

const WAITLIST_CONSENT_TEXT =
  'I agree that MODO Book may store my name and email to contact me about the MODO launch, product updates and early-access offers. I can unsubscribe at any time.'

const schema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().toLowerCase().email().max(255),
  role: z.string().trim().max(120).optional().nullable(),
  clinic: z.string().trim().max(160).optional().nullable(),
  consent: z.boolean(),
})

export const joinWaitlist = createServerFn({ method: 'POST' })
  .inputValidator((input: unknown) => schema.parse(input))
  .handler(async ({ data }) => {
    if (!data.consent) {
      return { ok: false as const, error: 'Consent is required' }
    }

    const { supabaseAdmin } = await import('@/integrations/supabase/client.server')

    // Check if this email is already on the list — treat as success but skip email.
    const { data: existing } = await supabaseAdmin
      .from('practitioner_waitlist')
      .select('id')
      .eq('email', data.email)
      .maybeSingle()

    if (!existing) {
      const { error } = await supabaseAdmin.from('practitioner_waitlist').insert({
        email: data.email,
        name: data.name,
        role: data.role?.trim() || null,
        clinic_name: data.clinic?.trim() || null,
        source: 'landing',
        consent_at: new Date().toISOString(),
        consent_text: WAITLIST_CONSENT_TEXT,
      })
      if (error) {
        return { ok: false as const, error: 'Could not save signup' }
      }
    }

    // Fire-and-forget welcome email. Never block the response on email.
    try {
      const { tryEnqueueAppEmail } = await import('@/lib/email/send.server')
      const firstName = data.name.split(' ')[0] || null
      await tryEnqueueAppEmail({
        templateName: 'waitlist-welcome',
        recipientEmail: data.email,
        messageId: `waitlist-welcome-${data.email}`,
        templateData: { firstName },
      })
    } catch (e) {
      console.error('[waitlist] welcome email enqueue failed', e)
    }

    return { ok: true as const, alreadyJoined: !!existing }
  })
