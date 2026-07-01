import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

// ---- Prescriber: full list of prescriptions I've signed / drafted ----
export const listMyPrescriptions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("prescriptions")
      .select(
        "id, status, rx_type, drug_name, drug_strength, drug_form, dose, quantity, directions, repeats_allowed, valid_until, signed_at, created_at, updated_at, patient_name, patient_dob, clinic_name, pdf_url, practitioner_profile_id, appointment_id",
      )
      .eq("prescriber_user_id", userId)
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw error;

    const rows = data ?? [];
    // Enrich with practitioner (clinic) name — needs service role since profiles
    // RLS won't let the prescriber read the practitioner's row directly.
    const profileIds = Array.from(
      new Set(rows.map((r) => r.practitioner_profile_id).filter(Boolean) as string[]),
    );
    let clinicNames = new Map<string, string>();
    if (profileIds.length > 0) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: profs } = await supabaseAdmin
        .from("profiles")
        .select("id, clinic_name, full_name")
        .in("id", profileIds);
      for (const p of profs ?? []) {
        clinicNames.set(p.id, p.clinic_name ?? p.full_name ?? "Clinic");
      }
    }

    return rows.map((r) => ({
      ...r,
      practitioner_clinic_name:
        r.clinic_name ?? clinicNames.get(r.practitioner_profile_id) ?? "Clinic",
    }));
  });

// ---- Cancel / void a prescription (soft — sets status) ----
export const setPrescriptionStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { id: string; status: "cancelled" | "signed" }) =>
    z.object({ id: z.string().uuid(), status: z.enum(["cancelled", "signed"]) }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("prescriptions")
      .update({ status: data.status } as never)
      .eq("id", data.id)
      .eq("prescriber_user_id", userId);
    if (error) throw error;
    return { ok: true };
  });
