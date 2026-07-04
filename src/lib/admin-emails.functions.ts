// Admin-only email management: platform-wide auth-email customizations,
// plus one-off broadcasts to all practitioners or a single user.
import { createServerFn } from '@tanstack/react-start'
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware'

async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data, error } = await context.supabase.rpc('has_role', {
    _user_id: context.userId,
    _role: 'admin',
  })
  if (error) throw error
  if (!data) throw new Error('Forbidden')
}

export const listPlatformEmailCustomizations = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context)
    const { data, error } = await context.supabase
      .from('platform_email_customizations')
      .select('*')
    if (error) throw error
    return data ?? []
  })

export const savePlatformEmailCustomization = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: {
    template_key: string
    subject_override: string | null
    intro_override: string | null
    closing_override: string | null
  }) => input)
  .handler(async ({ data, context }) => {
    await assertAdmin(context)
    const { data: row, error } = await context.supabase
      .from('platform_email_customizations')
      .upsert(
        {
          template_key: data.template_key,
          subject_override: data.subject_override,
          intro_override: data.intro_override,
          closing_override: data.closing_override,
          updated_by: context.userId,
        },
        { onConflict: 'template_key' },
      )
      .select()
      .single()
    if (error) throw error
    return row
  })

export const listAdminBroadcasts = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context)
    const { data, error } = await context.supabase
      .from('admin_broadcasts')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50)
    if (error) throw error
    return data ?? []
  })

export const sendAdminBroadcast = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: {
    audience: 'all_practitioners' | 'user'
    recipient_email?: string | null
    subject: string
    message: string
    cta_text?: string | null
    cta_url?: string | null
  }) => input)
  .handler(async ({ data, context }) => {
    await assertAdmin(context)

    if (!data.subject.trim() || !data.message.trim()) {
      throw new Error('Subject and message are required')
    }

    // Load recipients
    let recipients: Array<{ email: string; firstName?: string | null }> = []

    if (data.audience === 'user') {
      const email = (data.recipient_email || '').trim().toLowerCase()
      if (!email) throw new Error('Recipient email is required')
      recipients = [{ email }]
    } else {
      // All active practitioners with an email address.
      // Use the admin lookup RPC pattern already used by admin.functions.ts.
      const { data: rows, error } = await context.supabase
        .rpc('admin_list_practitioners')
      if (error) throw error
      recipients = ((rows as any[]) ?? [])
        .filter((p) => p.active && p.email)
        .map((p) => ({
          email: p.email as string,
          firstName: (p.full_name || '').split(' ')[0] || null,
        }))
    }

    if (recipients.length === 0) {
      throw new Error('No recipients to send to')
    }

    // Log the broadcast first
    const { data: log, error: logErr } = await context.supabase
      .from('admin_broadcasts')
      .insert({
        sent_by: context.userId,
        audience: data.audience,
        recipient_email: data.audience === 'user' ? recipients[0].email : null,
        subject: data.subject.trim(),
        message: data.message.trim(),
        cta_text: data.cta_text?.trim() || null,
        cta_url: data.cta_url?.trim() || null,
        recipient_count: recipients.length,
      })
      .select()
      .single()
    if (logErr) throw logErr

    // Enqueue an email to each recipient using the admin-broadcast template
    const { enqueueAppEmail } = await import('@/lib/email/send.server')
    let sent = 0
    let failed = 0
    for (const r of recipients) {
      const res = await enqueueAppEmail({
        templateName: 'admin-broadcast',
        recipientEmail: r.email,
        messageId: `admin-broadcast-${log.id}-${r.email}`,
        templateData: {
          subject: data.subject.trim(),
          message: data.message.trim(),
          ctaText: data.cta_text?.trim() || null,
          ctaUrl: data.cta_url?.trim() || null,
          firstName: r.firstName || null,
        },
      })
      if (res.ok) sent++
      else failed++
    }

    return { id: log.id, sent, failed, total: recipients.length }
  })
