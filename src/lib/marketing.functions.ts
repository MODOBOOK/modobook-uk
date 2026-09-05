// Marketing server functions: segments, templates, campaigns, dispatch, analytics.
import { createServerFn } from '@tanstack/react-start'
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware'
import { z } from 'zod'
import type { Block } from '@/lib/email-templates/marketing-broadcast'

const RECIPIENT_LIMIT = 2000
const COOLDOWN_HOURS = 6

// ---------- schemas ----------
const BlockSchema: z.ZodType<Block> = z.union([
  z.object({ type: z.literal('heading'), text: z.string().max(200), level: z.union([z.literal(1), z.literal(2), z.literal(3)]).optional() }),
  z.object({ type: z.literal('paragraph'), text: z.string().max(5000) }),
  z.object({ type: z.literal('image'), src: z.string().url().max(1000), alt: z.string().max(200).optional() }),
  z.object({ type: z.literal('button'), text: z.string().max(80), url: z.string().max(1000).refine((v) => /^https?:\/\//.test(v) || v.includes('{{'), 'Must be a URL or merge tag') }),
  z.object({ type: z.literal('divider') }),
  z.object({ type: z.literal('spacer'), size: z.enum(['sm', 'md', 'lg']).optional() }),
  z.object({ type: z.literal('html'), html: z.string().max(200000), full: z.boolean().optional() }),
])

const SegmentRulesSchema = z.object({
  static_ids: z.array(z.string().uuid()).optional(),
  last_visit_within_days: z.number().int().min(1).max(3650).nullable().optional(),
  no_visit_within_days: z.number().int().min(1).max(3650).nullable().optional(),
  has_upcoming: z.boolean().nullable().optional(),
  gender: z.enum(['male', 'female', 'other']).nullable().optional(),
  treatment_ids: z.array(z.string().uuid()).optional(),
  location_ids: z.array(z.string().uuid()).optional(),
}).strict()

// ---------- helpers ----------
// Resolve the practitioner profile id for the current auth user. Supports both
// the practitioner (their own profiles row) and active clinic staff (who
// operate under the owning practitioner's profile id).
async function getOwnerProfileId(supabase: any, userId: string): Promise<string> {
  const { data: prof } = await supabase.from('profiles').select('id').eq('user_id', userId).maybeSingle()
  if (prof?.id) return prof.id as string
  const { data: staff } = await supabase.from('staff_members')
    .select('profile_id').eq('user_id', userId).eq('status', 'active').maybeSingle()
  if (staff?.profile_id) return staff.profile_id as string
  throw new Error('No practitioner profile found for this account')
}

async function assertOwnCampaign(supabase: any, practitionerId: string, id: string) {
  const { data, error } = await supabase
    .from('marketing_campaigns').select('*').eq('id', id).eq('practitioner_id', practitionerId).maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) throw new Error('Campaign not found')
  return data
}

async function resolveSegmentRecipients(
  supabase: any,
  practitionerId: string,
  segmentId: string | null,
): Promise<Array<{ id: string; email: string; full_name: string; first_name: string }>> {
  // Base: opted-in, non-archived, non-blocked, has email
  let base = supabase
    .from('clinic_clients')
    .select('id, email, full_name')
    .eq('profile_id', practitionerId)
    .eq('marketing_opt_in', true)
    .eq('archived', false)
    .eq('is_blocked', false)
    .not('email', 'is', null)

  let rules: any = {}
  if (segmentId) {
    const { data: seg } = await supabase
      .from('marketing_segments').select('*').eq('id', segmentId).eq('practitioner_id', practitionerId).maybeSingle()
    if (!seg) throw new Error('Segment not found')
    rules = seg.rules || {}
    if (seg.kind === 'static' && Array.isArray(rules.static_ids) && rules.static_ids.length) {
      base = base.in('id', rules.static_ids)
    }
    if (rules.gender) base = base.eq('gender', rules.gender)
  }

  const { data: clients, error } = await base
  if (error) throw new Error(error.message)
  let list = (clients || []) as Array<{ id: string; email: string; full_name: string }>

  // Dynamic filters requiring joins (last visit / upcoming / treatments / locations)
  const needsAppointmentFilter =
    rules.last_visit_within_days || rules.no_visit_within_days || rules.has_upcoming !== undefined ||
    (rules.treatment_ids && rules.treatment_ids.length) || (rules.location_ids && rules.location_ids.length)
  if (needsAppointmentFilter && list.length) {
    const ids = list.map((c) => c.id)
    let apptQ = supabase.from('appointments')
      .select('client_id, appointment_date, treatment_id, location_id')
      .eq('practitioner_id', practitionerId)
      .in('client_id', ids)
    const { data: appts } = await apptQ
    const byClient = new Map<string, Array<{ date: string; treatment_id: string | null; location_id: string | null }>>()
    for (const a of (appts || []) as any[]) {
      const arr = byClient.get(a.client_id) || []
      arr.push({ date: a.appointment_date, treatment_id: a.treatment_id, location_id: a.location_id })
      byClient.set(a.client_id, arr)
    }
    const today = new Date().toISOString().slice(0, 10)
    list = list.filter((c) => {
      const rows = byClient.get(c.id) || []
      if (rules.treatment_ids?.length && !rows.some((r) => r.treatment_id && rules.treatment_ids.includes(r.treatment_id))) return false
      if (rules.location_ids?.length && !rows.some((r) => r.location_id && rules.location_ids.includes(r.location_id))) return false
      if (rules.has_upcoming === true && !rows.some((r) => r.date >= today)) return false
      if (rules.has_upcoming === false && rows.some((r) => r.date >= today)) return false
      if (rules.last_visit_within_days) {
        const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - rules.last_visit_within_days)
        const cutStr = cutoff.toISOString().slice(0, 10)
        if (!rows.some((r) => r.date >= cutStr && r.date <= today)) return false
      }
      if (rules.no_visit_within_days) {
        const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - rules.no_visit_within_days)
        const cutStr = cutoff.toISOString().slice(0, 10)
        if (rows.some((r) => r.date >= cutStr && r.date <= today)) return false
      }
      return true
    })
  }

  return list.map((c) => ({
    ...c,
    first_name: (c.full_name || '').trim().split(/\s+/)[0] || '',
  }))
}

// ---------- SEGMENTS ----------
export const listSegments = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from('marketing_segments').select('*')
      .eq('practitioner_id', (await getOwnerProfileId(context.supabase, context.userId)))
      .order('created_at', { ascending: false })
    if (error) throw new Error(error.message)
    return data || []
  })

export const saveSegment = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => z.object({
    id: z.string().uuid().optional(),
    name: z.string().min(1).max(120),
    description: z.string().max(500).optional().nullable(),
    kind: z.enum(['dynamic', 'static']),
    rules: SegmentRulesSchema.default({}),
  }).parse(raw))
  .handler(async ({ data, context }) => {
    const payload = {
      practitioner_id: (await getOwnerProfileId(context.supabase, context.userId)),
      name: data.name,
      description: data.description ?? null,
      kind: data.kind,
      rules: data.rules,
    }
    if (data.id) {
      const { data: row, error } = await context.supabase.from('marketing_segments')
        .update(payload).eq('id', data.id).eq('practitioner_id', (await getOwnerProfileId(context.supabase, context.userId))).select().single()
      if (error) throw new Error(error.message)
      return row
    }
    const { data: row, error } = await context.supabase.from('marketing_segments').insert(payload).select().single()
    if (error) throw new Error(error.message)
    return row
  })

export const deleteSegment = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => z.object({ id: z.string().uuid() }).parse(raw))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from('marketing_segments').delete().eq('id', data.id).eq('practitioner_id', (await getOwnerProfileId(context.supabase, context.userId)))
    if (error) throw new Error(error.message)
    return { ok: true }
  })

export const previewSegmentCount = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => z.object({
    segmentId: z.string().uuid().nullable().optional(),
    rules: SegmentRulesSchema.optional(),
    kind: z.enum(['dynamic', 'static']).optional(),
  }).parse(raw))
  .handler(async ({ data, context }) => {
    // If rules are inline, materialise a temporary segment lookup by creating an in-memory shape
    if (data.rules && !data.segmentId) {
      // Reuse resolver by inserting a shadow segment row is overkill; replicate logic inline via a fake segment
      const fakeSegmentId = crypto.randomUUID()
      // Insert temp then delete? Simpler: bypass by inlining via a query shim.
      const rules = data.rules
      const list = await resolveSegmentRecipientsInline(context.supabase, (await getOwnerProfileId(context.supabase, context.userId)), data.kind || 'dynamic', rules)
      return { count: list.length }
    }
    const list = await resolveSegmentRecipients(context.supabase, (await getOwnerProfileId(context.supabase, context.userId)), data.segmentId || null)
    return { count: list.length }
  })

async function resolveSegmentRecipientsInline(supabase: any, practitionerId: string, kind: string, rules: any) {
  // Duplicate small logic path — matches resolveSegmentRecipients without a segment row.
  let base = supabase.from('clinic_clients').select('id, email, full_name, gender')
    .eq('profile_id', practitionerId).eq('marketing_opt_in', true).eq('archived', false)
    .eq('is_blocked', false).not('email', 'is', null)
  if (kind === 'static' && Array.isArray(rules.static_ids) && rules.static_ids.length) base = base.in('id', rules.static_ids)
  if (rules.gender) base = base.eq('gender', rules.gender)
  const { data: clients } = await base
  let list = (clients || []) as any[]
  const needsAppt = rules.last_visit_within_days || rules.no_visit_within_days || rules.has_upcoming !== undefined ||
    (rules.treatment_ids && rules.treatment_ids.length) || (rules.location_ids && rules.location_ids.length)
  if (needsAppt && list.length) {
    const ids = list.map((c) => c.id)
    const { data: appts } = await supabase.from('appointments')
      .select('client_id, appointment_date, treatment_id, location_id')
      .eq('practitioner_id', practitionerId).in('client_id', ids)
    const byClient = new Map<string, any[]>()
    for (const a of (appts || []) as any[]) {
      const arr = byClient.get(a.client_id) || []; arr.push(a); byClient.set(a.client_id, arr)
    }
    const today = new Date().toISOString().slice(0, 10)
    list = list.filter((c) => {
      const rows = byClient.get(c.id) || []
      if (rules.treatment_ids?.length && !rows.some((r) => r.treatment_id && rules.treatment_ids.includes(r.treatment_id))) return false
      if (rules.location_ids?.length && !rows.some((r) => r.location_id && rules.location_ids.includes(r.location_id))) return false
      if (rules.has_upcoming === true && !rows.some((r) => r.appointment_date >= today)) return false
      if (rules.has_upcoming === false && rows.some((r) => r.appointment_date >= today)) return false
      if (rules.last_visit_within_days) {
        const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - rules.last_visit_within_days)
        const cutStr = cutoff.toISOString().slice(0, 10)
        if (!rows.some((r) => r.appointment_date >= cutStr && r.appointment_date <= today)) return false
      }
      if (rules.no_visit_within_days) {
        const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - rules.no_visit_within_days)
        const cutStr = cutoff.toISOString().slice(0, 10)
        if (rows.some((r) => r.appointment_date >= cutStr && r.appointment_date <= today)) return false
      }
      return true
    })
  }
  return list
}

// ---------- TEMPLATES ----------
export const listTemplates = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.from('marketing_templates').select('*')
      .eq('practitioner_id', (await getOwnerProfileId(context.supabase, context.userId))).order('created_at', { ascending: false })
    if (error) throw new Error(error.message)
    return data || []
  })

export const saveTemplate = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => z.object({
    id: z.string().uuid().optional(),
    name: z.string().min(1).max(120),
    subject: z.string().max(200).default(''),
    preheader: z.string().max(200).optional().nullable(),
    body_json: z.array(BlockSchema).max(80).default([]),
  }).parse(raw))
  .handler(async ({ data, context }) => {
    const payload = {
      practitioner_id: (await getOwnerProfileId(context.supabase, context.userId)),
      name: data.name, subject: data.subject,
      preheader: data.preheader ?? null,
      body_json: data.body_json,
    }
    if (data.id) {
      const { data: row, error } = await context.supabase.from('marketing_templates')
        .update(payload).eq('id', data.id).eq('practitioner_id', (await getOwnerProfileId(context.supabase, context.userId))).select().single()
      if (error) throw new Error(error.message)
      return row
    }
    const { data: row, error } = await context.supabase.from('marketing_templates').insert(payload).select().single()
    if (error) throw new Error(error.message)
    return row
  })

export const deleteTemplate = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => z.object({ id: z.string().uuid() }).parse(raw))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from('marketing_templates').delete().eq('id', data.id).eq('practitioner_id', (await getOwnerProfileId(context.supabase, context.userId)))
    if (error) throw new Error(error.message)
    return { ok: true }
  })

// ---------- CAMPAIGNS ----------
export const listCampaigns = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.from('marketing_campaigns').select('*')
      .eq('practitioner_id', (await getOwnerProfileId(context.supabase, context.userId))).order('created_at', { ascending: false }).limit(200)
    if (error) throw new Error(error.message)
    return data || []
  })

export const getCampaign = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => z.object({ id: z.string().uuid() }).parse(raw))
  .handler(async ({ data, context }) => assertOwnCampaign(context.supabase, (await getOwnerProfileId(context.supabase, context.userId)), data.id))

const CampaignSaveSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1).max(120),
  subject: z.string().max(200).default(''),
  preheader: z.string().max(200).optional().nullable(),
  body_json: z.array(BlockSchema).max(80).default([]),
  segment_id: z.string().uuid().nullable().optional(),
  scheduled_for: z.string().datetime().nullable().optional(),
})

export const saveCampaignDraft = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => CampaignSaveSchema.parse(raw))
  .handler(async ({ data, context }) => {
    const payload = {
      practitioner_id: (await getOwnerProfileId(context.supabase, context.userId)),
      name: data.name, subject: data.subject, preheader: data.preheader ?? null,
      body_json: data.body_json, segment_id: data.segment_id ?? null,
      status: 'draft',
    }
    if (data.id) {
      const existing = await assertOwnCampaign(context.supabase, (await getOwnerProfileId(context.supabase, context.userId)), data.id)
      if (existing.status !== 'draft' && existing.status !== 'scheduled' && existing.status !== 'cancelled') {
        throw new Error('Only draft, scheduled or cancelled campaigns can be edited')
      }
      const { data: row, error } = await context.supabase.from('marketing_campaigns')
        .update(payload).eq('id', data.id).eq('practitioner_id', (await getOwnerProfileId(context.supabase, context.userId))).select().single()
      if (error) throw new Error(error.message)
      return row
    }
    const { data: row, error } = await context.supabase.from('marketing_campaigns').insert(payload).select().single()
    if (error) throw new Error(error.message)
    return row
  })

export const deleteCampaign = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => z.object({ id: z.string().uuid() }).parse(raw))
  .handler(async ({ data, context }) => {
    const c = await assertOwnCampaign(context.supabase, (await getOwnerProfileId(context.supabase, context.userId)), data.id)
    if (c.status === 'sending') throw new Error('Cannot delete a campaign that is currently sending')
    const { error } = await context.supabase.from('marketing_campaigns').delete().eq('id', data.id).eq('practitioner_id', (await getOwnerProfileId(context.supabase, context.userId)))
    if (error) throw new Error(error.message)
    return { ok: true }
  })

export const scheduleCampaign = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => z.object({
    id: z.string().uuid(), scheduled_for: z.string().datetime(),
  }).parse(raw))
  .handler(async ({ data, context }) => {
    const c = await assertOwnCampaign(context.supabase, (await getOwnerProfileId(context.supabase, context.userId)), data.id)
    if (c.status !== 'draft' && c.status !== 'scheduled' && c.status !== 'cancelled') {
      throw new Error('Only drafts can be scheduled')
    }
    if (new Date(data.scheduled_for).getTime() < Date.now() + 60_000) {
      throw new Error('Scheduled time must be at least a minute in the future')
    }
    const { data: row, error } = await context.supabase.from('marketing_campaigns')
      .update({ status: 'scheduled', scheduled_for: data.scheduled_for })
      .eq('id', data.id).eq('practitioner_id', (await getOwnerProfileId(context.supabase, context.userId))).select().single()
    if (error) throw new Error(error.message)
    return row
  })

export const cancelScheduledCampaign = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => z.object({ id: z.string().uuid() }).parse(raw))
  .handler(async ({ data, context }) => {
    const c = await assertOwnCampaign(context.supabase, (await getOwnerProfileId(context.supabase, context.userId)), data.id)
    if (c.status !== 'scheduled') throw new Error('Only scheduled campaigns can be cancelled')
    const { data: row, error } = await context.supabase.from('marketing_campaigns')
      .update({ status: 'cancelled', scheduled_for: null })
      .eq('id', data.id).eq('practitioner_id', (await getOwnerProfileId(context.supabase, context.userId))).select().single()
    if (error) throw new Error(error.message)
    return row
  })

// Rate limit: 1 campaign per practitioner per COOLDOWN_HOURS
async function checkCooldown(supabase: any, userId: string) {
  const cutoff = new Date(Date.now() - COOLDOWN_HOURS * 3600_000).toISOString()
  const { count } = await supabase.from('marketing_campaigns')
    .select('id', { count: 'exact', head: true })
    .eq('practitioner_id', userId)
    .in('status', ['sent', 'sending'])
    .gte('sent_at', cutoff)
  if ((count || 0) > 0) {
    throw new Error(`For patient safety we only allow one campaign every ${COOLDOWN_HOURS} hours.`)
  }
}

async function dispatchCampaign(campaignId: string, practitionerId: string) {
  const { tryEnqueueAppEmail, getPractitionerBranding } = await import('@/lib/email/send.server')
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
  const supabase = supabaseAdmin

  // Load campaign
  const { data: campaign, error: cErr } = await supabase.from('marketing_campaigns')
    .select('*').eq('id', campaignId).maybeSingle()
  if (cErr || !campaign) throw new Error('Campaign not found')
  if (campaign.status === 'sent' || campaign.status === 'sending') return { ok: true, skipped: 'already_processing' }

  // Lock
  await supabase.from('marketing_campaigns').update({ status: 'sending' })
    .eq('id', campaignId).eq('status', campaign.status)

  try {
    const branding = await getPractitionerBranding(practitionerId)
    // Fetch practitioner slug for booking_url merge tag
    const { data: prof } = await supabase.from('profiles').select('slug').eq('id', practitionerId).maybeSingle()
    const bookingUrl = prof?.slug ? `https://modobook.uk/m/${prof.slug}` : 'https://modobook.uk'

    // Reuse authenticated resolver logic via admin client (RLS bypassed but scoped by practitioner id)
    const recipients = await resolveSegmentRecipients(supabase, practitionerId, campaign.segment_id)
    const capped = recipients.slice(0, RECIPIENT_LIMIT)

    // Pre-compute last treatment name per client (for {{last_treatment}} merge tag)
    const lastTreatmentByClient = new Map<string, string>()
    if (capped.length) {
      const { data: latestAppts } = await supabase.from('appointments')
        .select('client_id, appointment_date, treatments(name)')
        .eq('practitioner_id', practitionerId)
        .in('client_id', capped.map((c) => c.id))
        .order('appointment_date', { ascending: false })
      const seen = new Set<string>()
      for (const a of (latestAppts || []) as any[]) {
        if (seen.has(a.client_id)) continue
        seen.add(a.client_id)
        if (a.treatments?.name) lastTreatmentByClient.set(a.client_id, a.treatments.name)
      }
    }

    let sent = 0, failed = 0, suppressed = 0

    for (const r of capped) {
      const messageId = `campaign-${campaignId}-${r.id}`
      const { error: insErr } = await supabase.from('marketing_campaign_recipients').insert({
        campaign_id: campaignId, practitioner_id: practitionerId,
        client_id: r.id, email: r.email, message_id: messageId, status: 'queued',
      })
      if (insErr && !String(insErr.message).includes('duplicate')) {
        failed++; continue
      }

      const res = await tryEnqueueAppEmail({
        templateName: 'marketing-broadcast',
        recipientEmail: r.email,
        messageId,
        templateData: {
          subject: campaign.subject,
          preheader: campaign.preheader || undefined,
          blocks: campaign.body_json,
          clinicName: branding.clinicName,
          logoUrl: branding.logoUrl,
          brandColor: branding.brandColor,
          firstName: r.first_name,
          last_treatment: lastTreatmentByClient.get(r.id) || '',
          bookingUrl,
        },
      })
      if (res.ok) { sent++; await supabase.from('marketing_campaign_recipients').update({ status: 'sent' }).eq('message_id', messageId) }
      else if (res.skipped === 'suppressed' || res.skipped === 'unsubscribed') {
        suppressed++
        await supabase.from('marketing_campaign_recipients').update({ status: 'suppressed' }).eq('message_id', messageId)
      } else {
        failed++
        await supabase.from('marketing_campaign_recipients').update({ status: 'failed', error_message: res.error?.slice(0, 500) || null }).eq('message_id', messageId)
      }
    }


    await supabase.from('marketing_campaigns').update({
      status: 'sent',
      sent_at: new Date().toISOString(),
      recipient_count: capped.length,
      sent_count: sent,
      failed_count: failed,
      suppressed_count: suppressed,
    }).eq('id', campaignId)

    return { ok: true, sent, failed, suppressed, total: capped.length }
  } catch (e) {
    await supabase.from('marketing_campaigns').update({ status: 'failed' }).eq('id', campaignId)
    throw e
  }
}

export const sendCampaignNow = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => z.object({ id: z.string().uuid() }).parse(raw))
  .handler(async ({ data, context }) => {
    const c = await assertOwnCampaign(context.supabase, (await getOwnerProfileId(context.supabase, context.userId)), data.id)
    if (c.status !== 'draft' && c.status !== 'scheduled' && c.status !== 'cancelled') {
      throw new Error('Campaign already sent or is currently sending')
    }
    if (!c.subject || !Array.isArray(c.body_json) || c.body_json.length === 0) {
      throw new Error('Add a subject and some content before sending')
    }
    await checkCooldown(context.supabase, (await getOwnerProfileId(context.supabase, context.userId)))
    return await dispatchCampaign(data.id, (await getOwnerProfileId(context.supabase, context.userId)))
  })

export const sendTestEmail = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => z.object({
    id: z.string().uuid(),
    to: z.string().email().optional().nullable(),
  }).parse(raw))
  .handler(async ({ data, context }) => {
    const c = await assertOwnCampaign(context.supabase, (await getOwnerProfileId(context.supabase, context.userId)), data.id)
    // Default the preview recipient to the practitioner's own email.
    const claimsEmail = (context.claims as any)?.email as string | undefined
    const recipient = (data.to && data.to.trim()) || claimsEmail
    if (!recipient) throw new Error('No email address available for preview')
    if (!c.subject || !Array.isArray(c.body_json) || c.body_json.length === 0) {
      throw new Error('Add a subject and some content before previewing')
    }
    const { tryEnqueueAppEmail, getPractitionerBranding } = await import('@/lib/email/send.server')
    const pid = await getOwnerProfileId(context.supabase, context.userId)
    const branding = await getPractitionerBranding(pid)
    const { data: prof } = await context.supabase.from('profiles').select('slug').eq('id', pid).maybeSingle()
    const bookingUrl = (prof as any)?.slug ? `https://modobook.uk/m/${(prof as any).slug}` : 'https://modobook.uk'
    const res = await tryEnqueueAppEmail({
      templateName: 'marketing-broadcast',
      recipientEmail: recipient,
      messageId: `campaign-test-${c.id}-${Date.now()}`,
      templateData: {
        subject: `[TEST] ${c.subject || 'Untitled'}`,
        preheader: c.preheader || undefined,
        blocks: c.body_json,
        clinicName: branding.clinicName,
        logoUrl: branding.logoUrl,
        brandColor: branding.brandColor,
        firstName: 'there',
        last_treatment: 'your last treatment',
        bookingUrl,
      },
    })

    if (!res.ok && !res.skipped) throw new Error(res.error || 'Failed to send test')
    return { ok: true, sentTo: recipient }
  })

export const getCampaignAnalytics = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => z.object({ id: z.string().uuid() }).parse(raw))
  .handler(async ({ data, context }) => {
    await assertOwnCampaign(context.supabase, (await getOwnerProfileId(context.supabase, context.userId)), data.id)
    const { data: recips, error } = await context.supabase.from('marketing_campaign_recipients')
      .select('status, email, error_message, created_at')
      .eq('campaign_id', data.id).eq('practitioner_id', (await getOwnerProfileId(context.supabase, context.userId)))
      .order('created_at', { ascending: false }).limit(2000)
    if (error) throw new Error(error.message)
    const byStatus: Record<string, number> = {}
    for (const r of recips || []) byStatus[r.status] = (byStatus[r.status] || 0) + 1
    return { total: recips?.length || 0, byStatus, recipients: recips || [] }
  })

// ---------- Overview ----------
export const getMarketingOverview = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const since = new Date(Date.now() - 30 * 24 * 3600_000).toISOString()
    const [{ data: campaigns }, { count: optedIn }, { count: totalPatients }] = await Promise.all([
      context.supabase.from('marketing_campaigns').select('id, status, sent_count, sent_at')
        .eq('practitioner_id', (await getOwnerProfileId(context.supabase, context.userId))).gte('created_at', since),
      context.supabase.from('clinic_clients').select('id', { count: 'exact', head: true })
        .eq('profile_id', (await getOwnerProfileId(context.supabase, context.userId))).eq('marketing_opt_in', true).eq('archived', false),
      context.supabase.from('clinic_clients').select('id', { count: 'exact', head: true })
        .eq('profile_id', (await getOwnerProfileId(context.supabase, context.userId))).eq('archived', false),
    ])
    const totalSent = (campaigns || []).reduce((s: number, c: any) => s + (c.sent_count || 0), 0)
    return {
      optedIn: optedIn || 0,
      totalPatients: totalPatients || 0,
      totalSentLast30Days: totalSent,
      campaignsLast30Days: (campaigns || []).length,
    }
  })

// Bulk opt-in toggle (single client)
export const setClientMarketingOptIn = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => z.object({
    clientId: z.string().uuid(), optIn: z.boolean(),
  }).parse(raw))
  .handler(async ({ data, context }) => {
    const patch: any = {
      marketing_opt_in: data.optIn,
      marketing_opt_in_at: data.optIn ? new Date().toISOString() : null,
      marketing_opt_in_source: data.optIn ? 'practitioner_manual' : null,
    }
    const { error } = await context.supabase.from('clinic_clients')
      .update(patch).eq('id', data.clientId).eq('profile_id', (await getOwnerProfileId(context.supabase, context.userId)))
    if (error) throw new Error(error.message)
    return { ok: true }
  })

// ---------- Bulk opt-in (soft opt-in / legitimate interest, UK PECR + GDPR) ----------
// Only existing customers (patients who have actually booked) with a usable
// email address are eligible. Never touches anyone who has unsubscribed or is
// suppressed, and never touches anyone already opted in.
async function collectBulkOptInCandidates(supabase: any, ownerId: string) {
  const { data: clients, error } = await supabase.from('clinic_clients')
    .select('id, email, marketing_opt_in')
    .eq('profile_id', ownerId).eq('archived', false).eq('is_demo', false)
    .limit(5000)
  if (error) throw new Error(error.message)
  const rows = (clients || []) as Array<{ id: string; email: string | null; marketing_opt_in: boolean }>

  const alreadyOptedIn = rows.filter((r) => r.marketing_opt_in).length
  const pending = rows.filter((r) => !r.marketing_opt_in)
  const noEmail = pending.filter((r) => !r.email || !r.email.includes('@')).length
  const withEmail = pending.filter((r) => !!r.email && r.email.includes('@'))

  // Existing customer relationship: must have at least one appointment.
  const ids = withEmail.map((r) => r.id)
  const bookedIds = new Set<string>()
  for (let i = 0; i < ids.length; i += 500) {
    const chunk = ids.slice(i, i + 500)
    if (!chunk.length) continue
    const { data: appts } = await supabase.from('appointments').select('client_id').in('client_id', chunk).limit(20000)
    for (const a of (appts || []) as any[]) if (a.client_id) bookedIds.add(a.client_id as string)
  }
  const customers = withEmail.filter((r) => bookedIds.has(r.id))
  const noAppointment = withEmail.length - customers.length

  // Exclude suppressed / previously unsubscribed emails.
  const emails = Array.from(new Set(customers.map((r) => (r.email || '').toLowerCase())))
  const suppressedSet = new Set<string>()
  for (let i = 0; i < emails.length; i += 500) {
    const chunk = emails.slice(i, i + 500)
    if (!chunk.length) continue
    const { data: sup } = await supabase.from('suppressed_emails').select('email').in('email', chunk)
    for (const s of (sup || []) as any[]) suppressedSet.add(String(s.email).toLowerCase())
  }
  const eligible = customers.filter((r) => !suppressedSet.has((r.email || '').toLowerCase()))
  const suppressed = customers.length - eligible.length

  return {
    totalActive: rows.length,
    alreadyOptedIn,
    eligible: eligible.map((r) => r.id),
    skippedNoEmail: noEmail,
    skippedNoAppointment: noAppointment,
    skippedUnsubscribed: suppressed,
  }
}

export const previewBulkMarketingOptIn = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const ownerId = await getOwnerProfileId(context.supabase, context.userId)
    const res = await collectBulkOptInCandidates(context.supabase, ownerId)
    return { ...res, eligible: res.eligible.length }
  })

export const bulkMarketingOptIn = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => z.object({
    confirmText: z.string(),
    acknowledgements: z.object({
      existingCustomers: z.boolean(),
      similarServices: z.boolean(),
      optOutOffered: z.boolean(),
      responsible: z.boolean(),
    }),
  }).parse(raw))
  .handler(async ({ data, context }) => {
    const a = data.acknowledgements
    if (!a.existingCustomers || !a.similarServices || !a.optOutOffered || !a.responsible) {
      throw new Error('You must confirm every compliance statement before opting patients in.')
    }
    if (data.confirmText.trim().toUpperCase() !== 'OPT IN') {
      throw new Error('Type OPT IN to confirm.')
    }
    const ownerId = await getOwnerProfileId(context.supabase, context.userId)
    const { eligible } = await collectBulkOptInCandidates(context.supabase, ownerId)
    if (!eligible.length) return { ok: true, updated: 0 }

    const nowIso = new Date().toISOString()
    let updated = 0
    for (let i = 0; i < eligible.length; i += 200) {
      const chunk = eligible.slice(i, i + 200)
      const { error } = await context.supabase.from('clinic_clients').update({
        marketing_opt_in: true,
        marketing_opt_in_at: nowIso,
        marketing_opt_in_source: 'practitioner_bulk_soft_optin',
      }).in('id', chunk).eq('profile_id', ownerId).eq('marketing_opt_in', false)
      if (error) throw new Error(error.message)
      updated += chunk.length
    }
    return { ok: true, updated }
  })

// Cron entry called by the public dispatch route

export async function processScheduledCampaigns() {
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
  const nowIso = new Date().toISOString()
  const { data: due } = await supabaseAdmin.from('marketing_campaigns')
    .select('id, practitioner_id').eq('status', 'scheduled').lte('scheduled_for', nowIso).limit(20)
  const results: any[] = []
  for (const c of (due || []) as any[]) {
    try { results.push({ id: c.id, ...(await dispatchCampaign(c.id, c.practitioner_id)) }) }
    catch (e) { results.push({ id: c.id, error: e instanceof Error ? e.message : String(e) }) }
  }
  return { processed: results.length, results }
}

// ---------- AUTOMATIONS ----------
const AutomationConfigSchema = z.object({
  // treatment_interval
  treatment_id: z.string().uuid().nullable().optional(),
  interval_weeks: z.number().int().min(1).max(104).nullable().optional(),
  // win_back
  no_visit_days: z.number().int().min(7).max(3650).nullable().optional(),
  // monthly_newsletter / custom_recurring
  day_of_month: z.number().int().min(1).max(28).nullable().optional(),
  // birthday (no config)
}).strict()

const AutomationSaveSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1).max(120),
  type: z.enum(['birthday', 'treatment_interval', 'win_back', 'monthly_newsletter', 'custom_recurring']),
  enabled: z.boolean().default(true),
  template_id: z.string().uuid().nullable().optional(),
  segment_id: z.string().uuid().nullable().optional(),
  config: AutomationConfigSchema.default({}),
})

export const listAutomations = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const pid = await getOwnerProfileId(context.supabase, context.userId)
    const { data, error } = await context.supabase.from('marketing_automations').select('*')
      .eq('practitioner_id', pid).order('created_at', { ascending: false })
    if (error) throw new Error(error.message)
    return data || []
  })

export const saveAutomation = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => AutomationSaveSchema.parse(raw))
  .handler(async ({ data, context }) => {
    const pid = await getOwnerProfileId(context.supabase, context.userId)
    const payload = {
      practitioner_id: pid,
      name: data.name, type: data.type, enabled: data.enabled,
      template_id: data.template_id ?? null,
      segment_id: data.segment_id ?? null,
      config: data.config,
    }
    if (data.id) {
      const { data: row, error } = await context.supabase.from('marketing_automations')
        .update(payload).eq('id', data.id).eq('practitioner_id', pid).select().single()
      if (error) throw new Error(error.message)
      return row
    }
    const { data: row, error } = await context.supabase.from('marketing_automations').insert(payload).select().single()
    if (error) throw new Error(error.message)
    return row
  })

export const deleteAutomation = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => z.object({ id: z.string().uuid() }).parse(raw))
  .handler(async ({ data, context }) => {
    const pid = await getOwnerProfileId(context.supabase, context.userId)
    const { error } = await context.supabase.from('marketing_automations').delete().eq('id', data.id).eq('practitioner_id', pid)
    if (error) throw new Error(error.message)
    return { ok: true }
  })

export const toggleAutomation = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => z.object({ id: z.string().uuid(), enabled: z.boolean() }).parse(raw))
  .handler(async ({ data, context }) => {
    const pid = await getOwnerProfileId(context.supabase, context.userId)
    const { data: row, error } = await context.supabase.from('marketing_automations')
      .update({ enabled: data.enabled }).eq('id', data.id).eq('practitioner_id', pid).select().single()
    if (error) throw new Error(error.message)
    return row
  })

// Resolve automation recipients using rules specific to the automation type.
// Returns clients that qualify TODAY.
async function resolveAutomationRecipients(supabase: any, automation: any): Promise<Array<{
  id: string; email: string; full_name: string; first_name: string; last_treatment?: string; dedup_key: string
}>> {
  const pid = automation.practitioner_id as string
  const today = new Date()
  const todayStr = today.toISOString().slice(0, 10)
  const cfg = automation.config || {}

  // Base opted-in clients
  const { data: baseClients } = await supabase.from('clinic_clients')
    .select('id, email, full_name, date_of_birth')
    .eq('profile_id', pid).eq('marketing_opt_in', true).eq('archived', false)
    .eq('is_blocked', false).not('email', 'is', null)
  const clients = (baseClients || []) as Array<{ id: string; email: string; full_name: string; date_of_birth: string | null }>

  const mapClient = (c: typeof clients[number], extra: { last_treatment?: string; dedup_key: string }) => ({
    id: c.id, email: c.email, full_name: c.full_name,
    first_name: (c.full_name || '').trim().split(/\s+/)[0] || '',
    ...extra,
  })

  if (automation.type === 'birthday') {
    const mm = String(today.getMonth() + 1).padStart(2, '0')
    const dd = String(today.getDate()).padStart(2, '0')
    return clients.filter((c) => {
      if (!c.date_of_birth) return false
      return c.date_of_birth.slice(5, 10) === `${mm}-${dd}`
    }).map((c) => mapClient(c, { dedup_key: `birthday-${todayStr.slice(0, 4)}-${c.id}` }))
  }

  if (automation.type === 'win_back') {
    const days = cfg.no_visit_days || 180
    const cutoff = new Date(Date.now() - days * 86400_000).toISOString().slice(0, 10)
    const ids = clients.map((c) => c.id)
    if (!ids.length) return []
    const { data: appts } = await supabase.from('appointments')
      .select('client_id, appointment_date').eq('practitioner_id', pid).in('client_id', ids)
    const lastByClient = new Map<string, string>()
    for (const a of (appts || []) as any[]) {
      const prev = lastByClient.get(a.client_id)
      if (!prev || a.appointment_date > prev) lastByClient.set(a.client_id, a.appointment_date)
    }
    return clients.filter((c) => {
      const last = lastByClient.get(c.id)
      return last && last < cutoff
    }).map((c) => mapClient(c, { dedup_key: `winback-${todayStr.slice(0, 7)}-${c.id}` }))
  }

  if (automation.type === 'treatment_interval') {
    const treatmentId = cfg.treatment_id as string | null
    const weeks = cfg.interval_weeks || 8
    if (!treatmentId) return []
    const targetDate = new Date(Date.now() - weeks * 7 * 86400_000).toISOString().slice(0, 10)
    const ids = clients.map((c) => c.id)
    if (!ids.length) return []
    const { data: appts } = await supabase.from('appointments')
      .select('client_id, appointment_date, treatment_id, treatments(name)')
      .eq('practitioner_id', pid).eq('treatment_id', treatmentId).in('client_id', ids)
      .eq('appointment_date', targetDate)
    const seen = new Set<string>()
    const out: any[] = []
    for (const a of (appts || []) as any[]) {
      if (seen.has(a.client_id)) continue
      seen.add(a.client_id)
      const c = clients.find((x) => x.id === a.client_id)
      if (!c) continue
      out.push(mapClient(c, {
        last_treatment: a.treatments?.name || '',
        dedup_key: `interval-${automation.id}-${targetDate}-${c.id}`,
      }))
    }
    return out
  }

  if (automation.type === 'monthly_newsletter' || automation.type === 'custom_recurring') {
    const targetDay = cfg.day_of_month || 1
    if (today.getDate() !== targetDay) return []
    const month = todayStr.slice(0, 7)
    return clients.map((c) => mapClient(c, { dedup_key: `${automation.type}-${automation.id}-${month}-${c.id}` }))
  }

  return []
}

async function dispatchAutomation(automationId: string) {
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
  const { tryEnqueueAppEmail, getPractitionerBranding } = await import('@/lib/email/send.server')
  const supabase = supabaseAdmin

  const { data: automation } = await supabase.from('marketing_automations').select('*').eq('id', automationId).maybeSingle()
  if (!automation || !automation.enabled) return { skipped: 'not_enabled' }
  if (!automation.template_id) return { skipped: 'no_template' }

  const { data: template } = await supabase.from('marketing_templates').select('*').eq('id', automation.template_id).maybeSingle()
  if (!template) return { skipped: 'template_missing' }

  const branding = await getPractitionerBranding(automation.practitioner_id)
  const recipients = await resolveAutomationRecipients(supabase, automation)

  let sent = 0, skipped = 0, failed = 0
  for (const r of recipients) {
    // Dedup — insert marker row; if unique conflict, skip.
    const messageId = `automation-${automation.id}-${r.dedup_key}`
    const { error: dedupErr } = await supabase.from('marketing_automation_sends').insert({
      automation_id: automation.id, practitioner_id: automation.practitioner_id,
      client_id: r.id, dedup_key: r.dedup_key, message_id: messageId, status: 'queued',
    })
    if (dedupErr) {
      if (String(dedupErr.message).includes('duplicate')) { skipped++; continue }
      failed++; continue
    }

    const res = await tryEnqueueAppEmail({
      templateName: 'marketing-broadcast',
      recipientEmail: r.email,
      messageId,
      templateData: {
        subject: template.subject || automation.name,
        preheader: template.preheader || undefined,
        blocks: template.body_json || [],
        clinicName: branding.clinicName,
        logoUrl: branding.logoUrl,
        brandColor: branding.brandColor,
        firstName: r.first_name,
        last_treatment: r.last_treatment || '',
      },
    })

    if (res.ok) {
      sent++
      await supabase.from('marketing_automation_sends').update({ status: 'sent' }).eq('message_id', messageId)
    } else if (res.skipped === 'suppressed' || res.skipped === 'unsubscribed') {
      skipped++
      await supabase.from('marketing_automation_sends').update({ status: 'suppressed' }).eq('message_id', messageId)
    } else {
      failed++
      await supabase.from('marketing_automation_sends')
        .update({ status: 'failed', error_message: res.error?.slice(0, 500) || null })
        .eq('message_id', messageId)
    }
  }

  await supabase.from('marketing_automations').update({ last_run_at: new Date().toISOString() }).eq('id', automationId)
  return { automationId, sent, skipped, failed, total: recipients.length }
}

export async function processAutomations() {
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
  const { data: due } = await supabaseAdmin.from('marketing_automations').select('id').eq('enabled', true)
  const results: any[] = []
  for (const a of (due || []) as any[]) {
    try { results.push(await dispatchAutomation(a.id)) }
    catch (e) { results.push({ id: a.id, error: e instanceof Error ? e.message : String(e) }) }
  }
  return { processed: results.length, results }
}

