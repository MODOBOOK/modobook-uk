/**
 * When a patient books several services in one go (e.g. 3 areas of Botox plus
 * add-ons), the per-appointment trigger creates the same medical form once per
 * appointment. Patients then get asked to fill in the identical form 4 times.
 *
 * This keeps ONE row per unique medical form template across the whole booking
 * and removes the duplicates (only ever unsubmitted ones).
 *
 * Consents are deliberately NOT de-duplicated — each treatment keeps its own
 * signed consent record.
 */
export async function dedupeBookingMedicalForms(appointmentIds: string[]) {
  if (appointmentIds.length < 2) return;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: rows } = await supabaseAdmin
    .from("appointment_medical_forms")
    .select("id, template_id, appointment_id, submitted_at, created_at")
    .in("appointment_id", appointmentIds)
    .order("created_at", { ascending: true });

  type Row = {
    id: string;
    template_id: string | null;
    submitted_at: string | null;
  };

  const keptByTemplate = new Map<string, Row>();
  const removeIds: string[] = [];

  for (const raw of (rows ?? []) as Row[]) {
    const key = raw.template_id ?? "";
    if (!key) continue;
    const kept = keptByTemplate.get(key);
    if (!kept) {
      keptByTemplate.set(key, raw);
      continue;
    }
    // Prefer to keep a form the patient has already completed.
    if (!kept.submitted_at && raw.submitted_at) {
      keptByTemplate.set(key, raw);
      removeIds.push(kept.id);
    } else if (!raw.submitted_at) {
      removeIds.push(raw.id);
    }
  }

  if (removeIds.length > 0) {
    await supabaseAdmin
      .from("appointment_medical_forms")
      .delete()
      .in("id", removeIds)
      .is("submitted_at", null);
  }
}
