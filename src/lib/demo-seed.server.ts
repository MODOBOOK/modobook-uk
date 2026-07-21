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

const IMG = {
  hero: "/__l5e/assets-v1/c25093d4-96f1-42e9-9659-af599b93813e/demo-hero.jpg",
  t1: "/__l5e/assets-v1/a955505c-9ebe-411c-abb8-5fc350d497e8/demo-t1.jpg",
  t2: "/__l5e/assets-v1/93115707-117b-4948-aa28-a1e99ffdd109/demo-t2.jpg",
  t3: "/__l5e/assets-v1/baf3572c-2869-431f-872a-c4e0f9e2e248/demo-t3.jpg",
  gallery1: "/__l5e/assets-v1/2fd0e57d-cf1d-4e4c-8f15-0fbf357b3ab7/demo-g1.jpg",
};

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
  const profileFields = {
    is_demo: true,
    active: true,
    slug: DEMO_SLUG,
    clinic_name: DEMO_CLINIC_NAME,
    hero_url: IMG.hero,
    bio: "A boutique aesthetics studio pairing clinical rigour with a slow, considered treatment experience.",
    about:
      "We're a small, women-led team creating an unhurried environment for consultations, treatments and reviews. Every visit begins with a proper conversation.",
    brand_color: "#8b7355",
  } as const;
  if (!profileId) {
    const { data: created, error } = await admin
      .from("profiles")
      .insert({
        user_id: practitionerUserId,
        full_name: DEMO_PRACTITIONER_NAME,
        ...profileFields,
      })
      .select("id")
      .single();
    if (error) throw error;
    profileId = created!.id as string;
  } else {
    await admin.from("profiles").update(profileFields).eq("id", profileId);
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
        image_url: IMG.gallery1,
      })
      .select("id")
      .single();
    if (error) throw error;
    locationId = loc!.id as string;
  } else {
    await admin.from("locations").update({ image_url: IMG.gallery1 }).eq("id", locationId);
  }

  // Treatments
  async function ensureTreatment(
    name: string,
    price: number,
    duration: number,
    picture_url: string,
    description: string,
  ) {
    const { data: existing } = await admin
      .from("treatments")
      .select("id")
      .eq("profile_id", profileId!)
      .eq("name", name)
      .maybeSingle();
    if (existing?.id) {
      await admin.from("treatments").update({ picture_url, description }).eq("id", existing.id);
      return existing.id as string;
    }
    const { data, error } = await admin
      .from("treatments")
      .insert({
        profile_id: profileId!,
        name,
        price,
        duration,
        payment_mode: "full",
        active: true,
        picture_url,
        description,
      })
      .select("id")
      .single();
    if (error) throw error;
    return data!.id as string;
  }
  const t1 = await ensureTreatment(
    "Anti-wrinkle consultation",
    15000,
    30,
    IMG.t1,
    "A relaxed 30-minute conversation to understand what you'd like from treatment, review your medical history and map a plan together.",
  );
  const t2 = await ensureTreatment(
    "Lip filler — 1ml",
    22000,
    45,
    IMG.t2,
    "Subtle, natural-looking enhancement using premium hyaluronic acid filler. Includes numbing, treatment and a follow-up review.",
  );
  const t3 = await ensureTreatment(
    "Skin booster review",
    8500,
    20,
    IMG.t3,
    "A 20-minute review appointment to assess results and plan the next stage of your skin journey.",
  );

  // Availability — Mon-Fri 09:00-17:00
  const { count: availCount } = await admin
    .from("availability_rules")
    .select("id", { count: "exact", head: true })
    .eq("profile_id", profileId);
  if (!availCount) {
    await admin.from("availability_rules").insert(
      [1, 2, 3, 4, 5].map((day_of_week) => ({
        profile_id: profileId!,
        location_id: locationId!,
        day_of_week,
        start_time: "09:00",
        end_time: "17:00",
        slot_interval: 15,
      })),
    );
  }

  // Gallery
  const { count: galleryCount } = await admin
    .from("clinic_gallery")
    .select("id", { count: "exact", head: true })
    .eq("profile_id", profileId);
  if (!galleryCount) {
    await admin.from("clinic_gallery").insert([
      { profile_id: profileId!, image_url: IMG.gallery1, caption: "The studio", display_order: 1 },
      { profile_id: profileId!, image_url: IMG.t1, caption: "Consultation space", display_order: 2 },
      { profile_id: profileId!, image_url: IMG.t3, caption: "Products we love", display_order: 3 },
    ]);
  }

  // Testimonials
  const { count: tCount } = await admin
    .from("clinic_testimonials")
    .select("id", { count: "exact", head: true })
    .eq("profile_id", profileId);
  if (!tCount) {
    await admin.from("clinic_testimonials").insert([
      {
        profile_id: profileId!,
        author_name: "Sophie R.",
        quote: "The most calming clinic I've ever visited. Genuinely felt heard from the moment I sat down.",
        rating: 5,
        display_order: 1,
      },
      {
        profile_id: profileId!,
        author_name: "Amara K.",
        quote: "Results are beautifully natural and the aftercare is second to none. I won't go anywhere else.",
        rating: 5,
        display_order: 2,
      },
    ]);
  }

  // Theme — hero + warm sand palette
  const themePayload = {
    profile_id: profileId!,
    hero_image_url: IMG.hero,
    hero_carousel_enabled: true,
    hero_carousel_urls: [IMG.hero, IMG.gallery1, IMG.t2] as unknown as any,
    hero_heading: DEMO_CLINIC_NAME,
    hero_subheading: "Considered aesthetics, without the rush.",
    hero_show_text: true,
    hero_text_color: "#ffffff",
    hero_overlay_color: "#1a1a1a",
    hero_overlay_opacity: 0.35,
    hero_height: "tall",
    primary_color: "#8b7355",
    accent_color: "#c9b99a",
    background_color: "#faf8f5",
    text_color: "#2d2d2d",
    button_color: "#8b7355",
    button_text_color: "#ffffff",
    heading_font: "Syne",
    body_font: "Plus Jakarta Sans",
    preset_key: "warm-sand",
  };
  const { data: existingTheme } = await admin
    .from("clinic_theme")
    .select("id")
    .eq("profile_id", profileId!)
    .maybeSingle();
  if (existingTheme?.id) {
    await admin.from("clinic_theme").update(themePayload).eq("id", existingTheme.id);
  } else {
    await admin.from("clinic_theme").insert(themePayload);
  }

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

  function ymd(d: Date) {
    return d.toISOString().slice(0, 10);
  }
  function hms(d: Date) {
    return d.toISOString().slice(11, 19);
  }

  async function ensureAppointment(when: Date, treatmentId: string, treatmentName: string, status: string) {
    const date = ymd(when);
    const start = hms(when);
    const { data: existing } = await admin
      .from("appointments")
      .select("id")
      .eq("profile_id", profileId!)
      .eq("patient_user_id", patientUserId)
      .eq("scheduled_date", date)
      .eq("start_time", start)
      .maybeSingle();
    if (existing?.id) return existing.id;
    const end = hms(new Date(when.getTime() + 30 * 60 * 1000));
    const { error } = await admin.from("appointments").insert({
      profile_id: profileId!,
      patient_user_id: patientUserId,
      patient_name: DEMO_PATIENT_NAME,
      patient_email: DEMO_PATIENT_EMAIL,
      location_id: locationId!,
      treatment_id: treatmentId,
      treatment_name_snapshot: treatmentName,
      scheduled_date: date,
      start_time: start,
      end_time: end,
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
