import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

/* ---------- Schemas ---------- */
const PrescriptionUpsert = z.object({
  id: z.string().uuid().optional(),
  referral_id: z.string().uuid(),
  patient_name: z.string().min(1),
  patient_dob: z.string().nullable().optional(),
  patient_address: z.string().nullable().optional(),
  prescriber_name: z.string().min(1),
  prescriber_reg_body: z.string().nullable().optional(),
  prescriber_reg_number: z.string().nullable().optional(),
  prescriber_address: z.string().nullable().optional(),
  clinic_name: z.string().nullable().optional(),
  clinic_address: z.string().nullable().optional(),
  clinic_logo_url: z.string().nullable().optional(),
  drug_name: z.string().min(1),
  drug_form: z.string().nullable().optional(),
  drug_strength: z.string().nullable().optional(),
  dose: z.string().min(1),
  quantity: z.string().min(1),
  directions: z.string().min(1),
  repeats_allowed: z.number().int().min(0).max(12).default(0),
  valid_until: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});
export type PrescriptionInput = z.infer<typeof PrescriptionUpsert>;

const CarePlanUpsert = z.object({
  id: z.string().uuid().optional(),
  referral_id: z.string().uuid(),
  assessment: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  plan: z.string().nullable().optional(),
  follow_up: z.string().nullable().optional(),
});

async function loadReferral(supabase: any, refId: string, userId: string) {
  const { data, error } = await supabase
    .from("prescriber_referrals")
    .select("id, prescriber_user_id, practitioner_profile_id, appointment_id, patient_name")
    .eq("id", refId)
    .maybeSingle();
  if (error || !data) throw new Error("Referral not found");
  if (data.prescriber_user_id !== userId) throw new Error("Forbidden");
  return data;
}

/* ---------- Prescriptions ---------- */
export const savePrescription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: PrescriptionInput) => PrescriptionUpsert.parse(i))
  .handler(async ({ data, context }) => {
    const ref = await loadReferral(context.supabase, data.referral_id, context.userId);
    const row = {
      ...data,
      referral_id: ref.id,
      appointment_id: ref.appointment_id,
      prescriber_user_id: context.userId,
      practitioner_profile_id: ref.practitioner_profile_id,
      status: "draft",
    };
    if (data.id) {
      const { error } = await context.supabase
        .from("prescriptions")
        .update(row as never)
        .eq("id", data.id)
        .eq("prescriber_user_id", context.userId);
      if (error) throw error;
      return { id: data.id };
    } else {
      const { data: ins, error } = await context.supabase
        .from("prescriptions")
        .insert(row as never)
        .select("id")
        .single();
      if (error) throw error;
      return { id: (ins as { id: string }).id };
    }
  });

export const signPrescription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (i: { id: string; signature_name: string; signature_data: string }) => i,
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("prescriptions")
      .update({
        status: "signed",
        signed_at: new Date().toISOString(),
        signature_name: data.signature_name,
        signature_data: data.signature_data,
      } as never)
      .eq("id", data.id)
      .eq("prescriber_user_id", context.userId);
    if (error) throw error;
    return { ok: true };
  });

export const listPrescriptionsForReferral = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { referral_id: string }) => i)
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("prescriptions")
      .select("*")
      .eq("referral_id", data.referral_id)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return rows ?? [];
  });

/* ---------- Care plan ---------- */
export const saveCarePlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: z.infer<typeof CarePlanUpsert>) => CarePlanUpsert.parse(i))
  .handler(async ({ data, context }) => {
    const ref = await loadReferral(context.supabase, data.referral_id, context.userId);
    const row = {
      ...data,
      referral_id: ref.id,
      appointment_id: ref.appointment_id,
      prescriber_user_id: context.userId,
      practitioner_profile_id: ref.practitioner_profile_id,
    };
    if (data.id) {
      const { error } = await context.supabase
        .from("care_plans")
        .update(row as never)
        .eq("id", data.id)
        .eq("prescriber_user_id", context.userId);
      if (error) throw error;
      return { id: data.id };
    } else {
      const { data: ins, error } = await context.supabase
        .from("care_plans")
        .insert(row as never)
        .select("id")
        .single();
      if (error) throw error;
      return { id: (ins as { id: string }).id };
    }
  });

export const sendCarePlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { id: string }) => i)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("care_plans")
      .update({ status: "sent", sent_at: new Date().toISOString() } as never)
      .eq("id", data.id)
      .eq("prescriber_user_id", context.userId);
    if (error) throw error;
    return { ok: true };
  });

export const getCarePlanForReferral = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { referral_id: string }) => i)
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("care_plans")
      .select("*")
      .eq("referral_id", data.referral_id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return row;
  });

/* ---------- Read for practitioner side ---------- */
export const getReferralAttachments = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { referral_id: string }) => i)
  .handler(async ({ data, context }) => {
    const [{ data: prescriptions }, { data: plan }] = await Promise.all([
      context.supabase
        .from("prescriptions")
        .select("*")
        .eq("referral_id", data.referral_id)
        .order("created_at", { ascending: false }),
      context.supabase
        .from("care_plans")
        .select("*")
        .eq("referral_id", data.referral_id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);
    return {
      prescriptions: prescriptions ?? [],
      care_plan: plan ?? null,
    };
  });
