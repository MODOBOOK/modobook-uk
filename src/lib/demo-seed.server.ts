// Server-only. Idempotent seed + reset for the MODO demo clinic.
// Never import from routes or *.functions.ts at module scope — always
// `await import(...)` from inside a handler.
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  DEMO_CLINIC_NAME,
  DEMO_PATIENT_EMAIL,
  DEMO_PATIENT_NAME,
  DEMO_PRACTITIONER_EMAIL,
  DEMO_PRACTITIONER_NAME,
  DEMO_SLUG,
} from "./demo.server";

type Admin = SupabaseClient<any, any, any>;

async function findOrCreateAuthUser(
  admin: Admin,
  email: string,
  meta: Record<string, unknown>,
): Promise<string> {
  const { data: existing } = await (admin as any).auth.admin.listUsers({
    page: 1,
    perPage: 200,
  });
  const found = (existing?.users ?? []).find(
    (u: any) => (u.email || "").toLowerCase() === email.toLowerCase(),
  );
  if (found?.id) return found.id as string;
  const { data, error } = await (admin as any).auth.admin.createUser({
    email,
    email_confirm: true,
    password: crypto.randomUUID(),
    user_metadata: meta,
  });
  if (error) throw error;
  return data.user.id as string;
}

/** Ensures the demo practitioner + patient exist. Returns their user ids and
 *  the demo profile id. Safe to call many times. */
export async function seedDemoClinic(admin: Admin) {
  const practitionerUserId = await findOrCreateAuthUser(admin, DEMO_PRACTITIONER_EMAIL, {
    full_name: DEMO_PRACTITIONER_NAME,
    clinic_name: DEMO_CLINIC_NAME,
  });
  const patientUserId = await findOrCreateAuthUser(admin, DEMO_PATIENT_EMAIL, {
    full_name: DEMO_PATIENT_NAME,
  });

  // Upsert profile by user_id.
  const { data: existingProfile } = await admin
    .from("profiles")
    .select("id")
    .eq("user_id", practitionerUserId)
    .maybeSingle();

  let profileId = existingProfile?.id as string | undefined;
  if (!profileId) {
    const { data: created, error } = await admin
      .from("profiles")
      .insert({
        user_id: practitionerUserId,
        full_name: DEMO_PRACTITIONER_NAME,
        clinic_name: DEMO_CLINIC_NAME,
        slug: DEMO_SLUG,
        is_demo: true,
        active: true,
      })
      .select("id")
      .single();
    if (error) throw error;
    profileId = created!.id as string;
  } else {
    await admin
      .from("profiles")
      .update({ is_demo: true, active: true, slug: DEMO_SLUG, clinic_name: DEMO_CLINIC_NAME })
      .eq("id", profileId);
  }

  // Location
  const { data: existingLoc } = await admin
    .from("locations")
    .select("id")
    .eq("profile_id", profileId)
    .eq("name", "Demo Clinic Room")
    .maybeSingle();
  let locationId = existingLoc?.id as string | undefined;
  if (!locationId) {
    const { data: loc, error } = await admin
      .from("locations")
      .insert({
        profile_id: profileId,
        name: "Demo Clinic Room",
        address_line1: "1 Example Street",
        city: "London",
        postcode: "SW1A 1AA",
        country: "United Kingdom",
        is_primary: true,
        is_public: true,
        active: true,
      })
      .select("id")
      .single();
    if (error) throw error;
    locationId = loc!.id as string;
  }

  // Treatments
  async function ensureTreatment(name: string, price: number, duration: number) {
    const { data: existing } = await admin
      .from("treatments")
      .select("id")
      .eq("profile_id", profileId!)
      .eq("name", name)
      .maybeSingle();
    if (existing?.id) return existing.id as string;
    const { data, error } = await admin
      .from("treatments")
      .insert({
        profile_id: profileId!,
        name,
        price,
        duration,
        payment_mode: "on_the_day",
        active: true,
      })
      .select("id")
      .single();
    if (error) throw error;
    return data!.id as string;
  }
  const t1 = await ensureTreatment("Anti-wrinkle consultation", 15000, 30);
  const t2 = await ensureTreatment("Lip filler — 1ml", 22000, 45);
  const t3 = await ensureTreatment("Skin booster review", 8500, 20);

  // Demo patient clinic-side record
  const { data: existingClient } = await admin
    .from("clinic_clients")
    .select("id")
    .eq("profile_id", profileId)
    .eq("email", DEMO_PATIENT_EMAIL)
    .maybeSingle();
  let clientId = existingClient?.id as string | undefined;
  if (!clientId) {
    const { data, error } = await admin
      .from("clinic_clients")
      .insert({
        profile_id: profileId,
        patient_user_id: patientUserId,
        full_name: DEMO_PATIENT_NAME,
        email: DEMO_PATIENT_EMAIL,
        phone: "+447700900000",
        is_demo: true,
      })
      .select("id")
      .single();
    if (error) throw error;
    clientId = data!.id as string;
  }

  // Appointments — a past one and an upcoming one
  const now = new Date();
  const upcoming = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
  const past = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

  async function ensureAppointment(when: Date, treatmentId: string, treatmentName: string, status: string) {
    const iso = when.toISOString();
    const { data: existing } = await admin
      .from("appointments")
      .select("id")
      .eq("profile_id", profileId!)
      .eq("client_id", clientId!)
      .eq("start_at", iso)
      .maybeSingle();
    if (existing?.id) return existing.id;
    const { error } = await admin.from("appointments").insert({
      profile_id: profileId!,
      client_id: clientId!,
      location_id: locationId!,
      treatment_id: treatmentId,
      treatment_name_snapshot: treatmentName,
      start_at: iso,
      end_at: new Date(when.getTime() + 30 * 60 * 1000).toISOString(),
      status,
      is_demo: true,
    });
    if (error) throw error;
    return null;
  }
  await ensureAppointment(past, t1, "Anti-wrinkle consultation", "completed");
  await ensureAppointment(upcoming, t2, "Lip filler — 1ml", "confirmed");

  return {
    ok: true,
    profileId,
    practitionerUserId,
    patientUserId,
    slug: DEMO_SLUG,
    seeded: { treatments: [t1, t2, t3], locationId, clientId },
  };
}

/** Removes transient demo activity and re-seeds baseline. Keeps the
 *  practitioner/patient users and the profile itself. */
export async function resetDemoClinic(admin: Admin) {
  const { data: profile } = await admin
    .from("profiles")
    .select("id")
    .eq("slug", DEMO_SLUG)
    .maybeSingle();
  if (profile?.id) {
    // Delete transient demo data. RLS is bypassed by admin client.
    // Order matters when FKs cascade — appointments cascade to reminders etc.
    await admin.from("appointments").delete().eq("profile_id", profile.id).eq("is_demo", true);
    await admin.from("client_notes").delete().eq("profile_id", profile.id);
    await admin.from("consultations").delete().eq("profile_id", profile.id);
  }
  const seeded = await seedDemoClinic(admin);
  return { ...seeded, ok: true };
}
