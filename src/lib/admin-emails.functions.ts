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

type BroadcastInput = {
  audience: 'all_practitioners' | 'user' | 'waitlist'
  recipient_email?: string | null
  subject: string
  message: string
  cta_text?: string | null
  cta_url?: string | null
  blocks?: any[] | null
}

async function loadRecipients(
  context: { supabase: any },
  data: BroadcastInput,
): Promise<Array<{ email: string; firstName?: string | null }>> {
  if (data.audience === 'user') {
    const email = (data.recipient_email || '').trim().toLowerCase()
    if (!email) throw new Error('Recipient email is required')
    return [{ email }]
  }

  if (data.audience === 'waitlist') {
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
    const { data: rows, error } = await supabaseAdmin
      .from('practitioner_waitlist')
      .select('email, name')
    if (error) throw error
    const seen = new Set<string>()
    const out: Array<{ email: string; firstName?: string | null }> = []
    for (const r of (rows as any[]) ?? []) {
      const email = String(r.email || '').trim().toLowerCase()
      if (!email || seen.has(email)) continue
      seen.add(email)
      out.push({ email, firstName: (r.name || '').split(' ')[0] || null })
    }
    return out
  }

  const { data: rows, error } = await context.supabase.rpc('admin_list_practitioners')
  if (error) throw error
  return ((rows as any[]) ?? [])
    .filter((p) => p.active && p.email)
    .map((p) => ({
      email: p.email as string,
      firstName: (p.full_name || '').split(' ')[0] || null,
    }))
}

/** Render the broadcast to HTML so admins can preview it before sending. */
export const previewAdminBroadcast = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: {
    subject: string
    message: string
    cta_text?: string | null
    cta_url?: string | null
    blocks?: any[] | null
    firstName?: string | null
  }) => input)
  .handler(async ({ data, context }) => {
    await assertAdmin(context)
    const React = await import('react')
    const { render } = await import('react-email')
    const { AdminBroadcastEmail } = await import('@/lib/email-templates/admin-broadcast')
    const html = await render(
      React.createElement(AdminBroadcastEmail, {
        subject: data.subject || 'A message from MODO Book',
        message: data.message || '',
        blocks: (data.blocks as any[]) || [],
        ctaText: data.cta_text || null,
        ctaUrl: data.cta_url || null,
        firstName: data.firstName ?? 'Alex',
      }) as any,
    )
    return { html }
  })

/** Send a one-off test copy of the broadcast to a single address. */
export const sendAdminBroadcastTest = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: {
    recipient_email: string
    subject: string
    message: string
    cta_text?: string | null
    cta_url?: string | null
    blocks?: any[] | null
  }) => input)
  .handler(async ({ data, context }) => {
    await assertAdmin(context)
    const email = (data.recipient_email || '').trim().toLowerCase()
    if (!email) throw new Error('Test recipient email is required')
    const { enqueueAppEmail } = await import('@/lib/email/send.server')
    const res = await enqueueAppEmail({
      templateName: 'admin-broadcast',
      recipientEmail: email,
      messageId: `admin-broadcast-test-${crypto.randomUUID()}`,
      templateData: {
        subject: `[TEST] ${data.subject.trim()}`,
        message: data.message.trim(),
        blocks: data.blocks || [],
        ctaText: data.cta_text?.trim() || null,
        ctaUrl: data.cta_url?.trim() || null,
        firstName: null,
      },
    })
    if (!res.ok && !res.skipped) throw new Error(res.error || 'Could not send test email')
    return { ok: true }
  })

export const sendAdminBroadcast = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: BroadcastInput) => input)
  .handler(async ({ data, context }) => {
    await assertAdmin(context)

    const hasBlocks = Array.isArray(data.blocks) && data.blocks.length > 0
    if (!data.subject.trim() || (!data.message.trim() && !hasBlocks)) {
      throw new Error('Subject and message (or content blocks) are required')
    }

    const recipients = await loadRecipients(context, data)

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
        blocks: hasBlocks ? data.blocks : null,
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
          blocks: hasBlocks ? data.blocks : [],
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

/** How many people are on the launch waitlist (for the audience picker). */
export const countWaitlist = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context)
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
    const { count, error } = await supabaseAdmin
      .from('practitioner_waitlist')
      .select('id', { count: 'exact', head: true })
    if (error) throw error
    return { count: count ?? 0 }
  })

