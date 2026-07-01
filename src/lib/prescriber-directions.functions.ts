import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

/* ---------------- Snippets (short reusable text for directions field) ---------------- */

export const listMySnippets = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("prescribing_snippets")
      .select("id, label, body, category, sort_order, updated_at")
      .eq("prescriber_user_id", context.userId)
      .order("sort_order", { ascending: true })
      .order("label", { ascending: true });
    if (error) throw error;
    return data ?? [];
  });

const SnippetSchema = z.object({
  id: z.string().uuid().nullable().optional(),
  label: z.string().trim().min(1).max(120),
  body: z.string().trim().min(1).max(2000),
  category: z.string().trim().max(60).nullable().optional(),
  sort_order: z.number().int().min(0).max(9999).default(0),
});
export const upsertSnippet = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: z.infer<typeof SnippetSchema>) => SnippetSchema.parse(i))
  .handler(async ({ data, context }) => {
    const payload = {
      prescriber_user_id: context.userId,
      label: data.label,
      body: data.body,
      category: data.category ?? null,
      sort_order: data.sort_order,
    };
    if (data.id) {
      const { error } = await context.supabase
        .from("prescribing_snippets")
        .update(payload as never)
        .eq("id", data.id)
        .eq("prescriber_user_id", context.userId);
      if (error) throw error;
      return { id: data.id };
    }
    const { data: row, error } = await context.supabase
      .from("prescribing_snippets")
      .insert(payload as never)
      .select("id")
      .single();
    if (error) throw error;
    return { id: (row as { id: string }).id };
  });

export const deleteSnippet = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { id: string }) => i)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("prescribing_snippets")
      .delete()
      .eq("id", data.id)
      .eq("prescriber_user_id", context.userId);
    if (error) throw error;
    return { ok: true };
  });

/* ---------------- Rx templates (one-click full prescription prefill) ---------------- */

export const listMyRxTemplates = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("prescribing_rx_templates")
      .select("*")
      .eq("prescriber_user_id", context.userId)
      .order("sort_order", { ascending: true })
      .order("label", { ascending: true });
    if (error) throw error;
    return data ?? [];
  });

const RxTemplateSchema = z.object({
  id: z.string().uuid().nullable().optional(),
  label: z.string().trim().min(1).max(120),
  drug_name: z.string().trim().min(1).max(200),
  drug_form: z.string().trim().max(80).nullable().optional(),
  drug_strength: z.string().trim().max(80).nullable().optional(),
  dose: z.string().trim().max(200).nullable().optional(),
  quantity: z.string().trim().max(80).nullable().optional(),
  directions: z.string().trim().max(2000).nullable().optional(),
  repeats_allowed: z.number().int().min(0).max(24).default(0),
  validity_days: z.number().int().min(0).max(365).nullable().optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
  sort_order: z.number().int().min(0).max(9999).default(0),
});
export const upsertRxTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: z.infer<typeof RxTemplateSchema>) => RxTemplateSchema.parse(i))
  .handler(async ({ data, context }) => {
    const payload = {
      prescriber_user_id: context.userId,
      label: data.label,
      drug_name: data.drug_name,
      drug_form: data.drug_form ?? null,
      drug_strength: data.drug_strength ?? null,
      dose: data.dose ?? null,
      quantity: data.quantity ?? null,
      directions: data.directions ?? null,
      repeats_allowed: data.repeats_allowed,
      validity_days: data.validity_days ?? null,
      notes: data.notes ?? null,
      sort_order: data.sort_order,
    };
    if (data.id) {
      const { error } = await context.supabase
        .from("prescribing_rx_templates")
        .update(payload as never)
        .eq("id", data.id)
        .eq("prescriber_user_id", context.userId);
      if (error) throw error;
      return { id: data.id };
    }
    const { data: row, error } = await context.supabase
      .from("prescribing_rx_templates")
      .insert(payload as never)
      .select("id")
      .single();
    if (error) throw error;
    return { id: (row as { id: string }).id };
  });

export const deleteRxTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { id: string }) => i)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("prescribing_rx_templates")
      .delete()
      .eq("id", data.id)
      .eq("prescriber_user_id", context.userId);
    if (error) throw error;
    return { ok: true };
  });

/* ---------------- Walk-in consult ---------------- */

const WalkInSchema = z.object({
  practitioner_profile_id: z.string().uuid(),
  patient_name: z.string().trim().min(1).max(200),
  patient_email: z.string().trim().email().max(200).nullable().optional().or(z.literal("")),
  patient_phone: z.string().trim().max(60).nullable().optional().or(z.literal("")),
  patient_dob: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional().or(z.literal("")),
  note: z.string().trim().max(2000).nullable().optional(),
});
export const createWalkIn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: z.infer<typeof WalkInSchema>) => WalkInSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { data: id, error } = await context.supabase.rpc("create_walk_in_referral", {
      p_practitioner_profile_id: data.practitioner_profile_id,
      p_patient_name: data.patient_name,
      p_patient_email: data.patient_email || null,
      p_patient_phone: data.patient_phone || null,
      p_patient_dob: data.patient_dob || null,
      p_note: data.note ?? null,
      p_client_id: null,
    });
    if (error) throw error;
    return { id: id as unknown as string };
  });

export const sendWalkInToPractitioner = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { id: string }) => i)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("send_walk_in_to_practitioner", { p_id: data.id });
    if (error) throw error;
    return { ok: true };
  });

export const closeWalkInAsPractitioner = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { id: string; note?: string }) => i)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("close_walk_in_as_practitioner", {
      p_id: data.id,
      p_note: data.note ?? null,
    });
    if (error) throw error;
    return { ok: true };
  });

/* ---------------- Practitioner: walk-ins awaiting my close ---------------- */
export const listWalkInsAwaitingClose = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: profile } = await context.supabase
      .from("profiles").select("id").eq("user_id", context.userId).maybeSingle();
    if (!profile) return [];
    const { data, error } = await context.supabase
      .from("prescriber_referrals")
      .select("id, patient_name, walk_in_note, notes, created_at, prescriber_user_id, awaiting_practitioner_close, status")
      .eq("practitioner_profile_id", profile.id)
      .eq("is_walk_in", true)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw error;
    const rows = data ?? [];
    const prescIds = Array.from(new Set(rows.map((r) => r.prescriber_user_id)));
    const { data: presc } = prescIds.length
      ? await context.supabase.from("prescriber_profiles").select("user_id, full_name").in("user_id", prescIds)
      : { data: [] as { user_id: string; full_name: string | null }[] };
    const pmap = new Map((presc ?? []).map((p) => [p.user_id, p]));
    return rows.map((r) => ({
      ...r,
      prescriber_name: pmap.get(r.prescriber_user_id)?.full_name ?? "Prescriber",
    }));
  });
