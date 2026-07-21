import { supabase } from '@/integrations/supabase/client'

export interface SendAppEmailInput {
  templateName:
    | 'booking-confirmation'
    | 'booking-cancellation'
    | 'medical-form-request'
    | 'review-request'
    | 'patient-message'
    | 'prescriber-invoice'
  recipientEmail: string
  idempotencyKey?: string
  templateData?: Record<string, unknown>
}

/**
 * Send an app email via the internal Lovable transactional route.
 * Requires a signed-in user (route enforces Supabase JWT).
 */
export async function sendAppEmail(input: SendAppEmailInput): Promise<{ ok: boolean; error?: string }> {
  try {
    const { data: { session } } = await supabase.auth.getSession()
    const token = session?.access_token
    if (!token) return { ok: false, error: 'Not signed in' }

    const res = await fetch('/lovable/email/transactional/send', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(input),
    })
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      return { ok: false, error: text || `HTTP ${res.status}` }
    }
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}
