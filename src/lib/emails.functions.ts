// Server functions for the Email templates dashboard: per-practitioner
// wording overrides + appointment reminder rules.
import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware'

export const listEmailCustomizations = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context
    const { data, error } = await supabase
      .from('email_customizations')
      .select('*')
      .eq('profile_id', userId)
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
      closing_override: z.string().max(4000).nullable().optional(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context
    const row = {
      profile_id: userId,
      template_key: data.template_key,
      subject_override: data.subject_override?.trim() || null,
      intro_override: data.intro_override?.trim() || null,
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
    const { data, error } = await supabase
      .from('appointment_reminder_rules')
      .select('*')
      .eq('profile_id', userId)
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
    const row = {
      profile_id: userId,
      hours_before: data.hours_before,
      subject: data.subject?.trim() || null,
      intro: data.intro?.trim() || null,
      closing: data.closing?.trim() || null,
      enabled: data.enabled,
    }
    const query = data.id
      ? supabase.from('appointment_reminder_rules').update(row).eq('id', data.id).eq('profile_id', userId).select().single()
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
    const { error } = await supabase
      .from('appointment_reminder_rules')
      .delete()
      .eq('id', data.id)
      .eq('profile_id', userId)
    if (error) throw new Error(error.message)
    return { ok: true }
  })
