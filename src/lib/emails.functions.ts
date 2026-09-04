// Server functions for the Email templates dashboard: per-practitioner
// wording overrides + appointment reminder rules + test sends.
import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware'

// Staff/admins of a clinic may not have their own profiles row, so saves must
// target the active clinic's profile (matches how the rest of the dashboard
// resolves context) instead of the raw auth user id — otherwise the
// email_customizations_profile_id_fkey constraint rejects the write.
async function activeClinicProfileId(supabase: any, userId: string): Promise<string> {
  const { activeProfileId } = await import('./clinic-context.server')
  const id = await activeProfileId(supabase, userId)
  if (!id) throw new Error('No clinic profile found for your account.')
  return id
}

export const listEmailCustomizations = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context
    const profileId = await activeClinicProfileId(supabase, userId)
    const { data, error } = await supabase
      .from('email_customizations')
      .select('*')
      .eq('profile_id', profileId)
    if (error) throw new Error(error.message)
    return data ?? []
  })

export const saveEmailCustomization = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      template_key: z.string().min(1).max(80),
      subject_override: z.string().max(300).nullable().optional(),
      intro_override: z.string().max(4000).nullable().optional(),
      body_override: z.string().max(8000).nullable().optional(),
      closing_override: z.string().max(4000).nullable().optional(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context
    const profileId = await activeClinicProfileId(supabase, userId)
    const row = {
      profile_id: profileId,
      template_key: data.template_key,
      subject_override: data.subject_override?.trim() || null,
      intro_override: data.intro_override?.trim() || null,
      body_override: data.body_override?.trim() || null,
      closing_override: data.closing_override?.trim() || null,
      updated_at: new Date().toISOString(),
    }
    const { data: saved, error } = await supabase
      .from('email_customizations')
      .upsert(row, { onConflict: 'profile_id,template_key' })
      .select()
      .single()
    if (error) throw new Error(error.message)
    return saved
  })

export const listReminderRules = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context
    const profileId = await activeClinicProfileId(supabase, userId)
    const { data, error } = await supabase
      .from('appointment_reminder_rules')
      .select('*')
      .eq('profile_id', profileId)
      .order('hours_before', { ascending: false })
    if (error) throw new Error(error.message)
    return data ?? []
  })

export const saveReminderRule = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      id: z.string().uuid().optional(),
      hours_before: z.number().int().positive().max(720),
      subject: z.string().max(300).nullable().optional(),
      intro: z.string().max(4000).nullable().optional(),
      closing: z.string().max(4000).nullable().optional(),
      enabled: z.boolean().default(true),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context
    const profileId = await activeClinicProfileId(supabase, userId)
    const row = {
      profile_id: profileId,
      hours_before: data.hours_before,
      subject: data.subject?.trim() || null,
      intro: data.intro?.trim() || null,
      closing: data.closing?.trim() || null,
      enabled: data.enabled,
    }
    const query = data.id
      ? supabase.from('appointment_reminder_rules').update(row).eq('id', data.id).eq('profile_id', profileId).select().single()
      : supabase.from('appointment_reminder_rules').upsert({ ...row }, { onConflict: 'profile_id,hours_before' }).select().single()
    const { data: saved, error } = await query
    if (error) throw new Error(error.message)
    return saved
  })

export const deleteReminderRule = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context
    const profileId = await activeClinicProfileId(supabase, userId)
    const { error } = await supabase
      .from('appointment_reminder_rules')
      .delete()
      .eq('id', data.id)
      .eq('profile_id', profileId)
    if (error) throw new Error(error.message)
    return { ok: true }
  })

/** Send a preview of a template to the signed-in practitioner's own email
 *  address, using sample data so they can see exactly what patients receive. */
export const sendTestEmail = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      template_key: z.string().min(1).max(80),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId, claims } = context
    const profileId = await activeClinicProfileId(supabase, userId)

    const { data: profileRow, error: profErr } = await supabase
      .from('profiles')
      .select('email, clinic_name, slug')
      .eq('id', profileId)
      .maybeSingle()
    if (profErr) throw new Error(profErr.message)
    // Fall back to the authenticated user's account email (from the JWT)
    // when the profile row doesn't have one saved.
    const accountEmail = (claims as { email?: string } | null)?.email ?? null
    const profile = {
      email: profileRow?.email || accountEmail,
      clinic_name: profileRow?.clinic_name ?? null,
      slug: profileRow?.slug ?? null,
    }
    if (!profile.email) throw new Error('No email on your account — add one first.')

    const { tryEnqueueAppEmail, getPractitionerBranding } = await import('@/lib/email/send.server')
    const branding = await getPractitionerBranding(userId)
    const clinicName = profile.clinic_name || branding.clinicName

    // Per-template sample data. `profileId` triggers the send helper to merge
    // in the practitioner's saved subject/intro/body/closing overrides.
    const samples: Record<string, Record<string, unknown>> = {
      'booking-confirmation': {
        patientName: 'Alex',
        treatmentName: 'Lip filler consultation',
        practitionerName: 'You',
        locationName: profile.clinic_name || 'Your studio',
        dateTime: 'Fri 12 Jul 2026 · 2:30 PM',
      },
      'booking-cancellation': {
        patientName: 'Alex',
        treatmentName: 'Lip filler consultation',
        dateTime: 'Fri 12 Jul 2026 · 2:30 PM',
        cancelledBy: 'clinic',
      },
      'appointment-reminder': {
        patientName: 'Alex',
        treatmentName: 'Lip filler consultation',
        dateTime: 'Tomorrow · 2:30 PM',
        hoursBefore: 24,
      },
      'medical-form-request': {
        patientName: 'Alex',
        formName: 'Pre-treatment medical form',
        formUrl: 'https://modobook.uk',
      },
      'review-request': {
        patientName: 'Alex',
        treatmentName: 'Lip filler consultation',
        reviewUrl: 'https://modobook.uk',
      },
      'patient-message': {
        patientName: 'Alex',
        message: 'This is where your message to the patient appears.',
      },
    }
    const sample = samples[data.template_key] || {}

    const res = await tryEnqueueAppEmail({
      templateName: data.template_key,
      recipientEmail: profile.email,
      // Fresh id every test so we don't hit dedup
      messageId: `test-${data.template_key}-${userId}-${Date.now()}`,
      templateData: {
        profileId: userId,
        clinicName,
        logoUrl: branding.logoUrl,
        brandColor: branding.brandColor,
        ...sample,
      },
    })
    if (!res.ok) throw new Error(res.error || res.skipped || 'Failed to send')
    return { ok: true, sentTo: profile.email }
  })
