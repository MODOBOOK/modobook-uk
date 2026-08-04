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

// The launch waitlist is now closed — MODO has opened to the clinics on the
// list. New signups are refused; existing waitlist emails can still create an
// account at /auth.
export const WAITLIST_OPEN = false

export const joinWaitlist = createServerFn({ method: 'POST' })
  .inputValidator((input: unknown) => schema.parse(input))
  .handler(async ({ data }) => {
    if (!WAITLIST_OPEN) {
      return { ok: false as const, closed: true as const, error: 'The MODO waitlist is closed.' }
    }
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

// --- Waitlist-gated account creation -------------------------------------
// Only emails present on the practitioner waitlist may create a MODO account.

const eligibilitySchema = z.object({
  email: z.string().trim().toLowerCase().email().max(255),
})

export const checkWaitlistEligibility = createServerFn({ method: 'POST' })
  .inputValidator((input: unknown) => eligibilitySchema.parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
    const { data: row } = await supabaseAdmin
      .from('practitioner_waitlist')
      .select('id,name,clinic_name')
      .eq('email', data.email)
      .maybeSingle()
    return { eligible: !!row, name: row?.name ?? null, clinic: row?.clinic_name ?? null }
  })

const signUpSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(255),
  password: z.string().min(8).max(128),
  name: z.string().trim().max(120).optional().nullable(),
})

// MODO is now open to everyone — signup is no longer gated on the waitlist.
// Waitlist rows are still used to prefill name/clinic when we have them.
export const signUpFromWaitlist = createServerFn({ method: 'POST' })
  .inputValidator((input: unknown) => signUpSchema.parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server')

    const { data: row } = await supabaseAdmin
      .from('practitioner_waitlist')
      .select('id,name,clinic_name')
      .eq('email', data.email)
      .maybeSingle()

    const { error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: {
        full_name: data.name?.trim() || row.name || null,
        clinic_name: row.clinic_name || null,
        source: 'waitlist',
      },
    })

    if (error) {
      const msg = String(error.message || '')
      if (/already been registered|already exists/i.test(msg)) {
        return { ok: false as const, code: 'exists' as const, error: 'An account already exists for this email — sign in instead.' }
      }
      return { ok: false as const, code: 'failed' as const, error: msg || 'Could not create your account' }
    }

    return { ok: true as const }
  })
