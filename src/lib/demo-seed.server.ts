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
  logo: "/__l5e/assets-v1/a087508a-6366-4786-99f0-eea05a33c8a3/demo-clinic-logo.png",
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
  const aboutPage = {
    show_hero_image: true,
    hero_image_url: IMG.hero,
    show_intro: true,
    intro_heading: "A quieter kind of clinic",
    intro_body:
      "MODO Demo Clinic is a small, women-led aesthetics studio. Every visit begins with an unhurried conversation — no upsells, no pressure, just a plan that suits your face and your life.",
    show_mission: true,
    mission:
      "We believe great aesthetics should feel like great skincare — considered, evidence-led and quietly confident. Our approach blends clinical rigour with a slow, spa-like experience.",
    show_why_choose: true,
    why_choose: [
      "Advanced nurse prescribers with 10+ years of clinical experience",
      "Premium, fully-traceable products only — no grey market",
      "Written aftercare and a two-week review with every treatment",
      "Transparent, itemised pricing with no hidden fees",
    ],
    show_what_to_expect: true,
    what_to_expect:
      "Your first visit is a full 30-minute consultation. We'll go through your medical history, photograph the areas you'd like to treat and map a plan together. You're never treated on the same day as your first consult unless you ask.",
    show_specialties: true,
    show_qualifications: true,
    show_timeline: true,
    show_locations: true,
    show_opening_hours: true,
    opening_hours: [
      { day: "Monday", hours: "9:00 – 17:00" },
      { day: "Tuesday", hours: "9:00 – 17:00" },
      { day: "Wednesday", hours: "9:00 – 19:00" },
      { day: "Thursday", hours: "9:00 – 19:00" },
      { day: "Friday", hours: "9:00 – 17:00" },
      { day: "Saturday", hours: "10:00 – 15:00" },
      { day: "Sunday", hours: "Closed" },
    ],
    show_faqs: true,
    faqs: [
      { q: "How soon will I see results?", a: "Anti-wrinkle treatments soften over 3–5 days and settle at two weeks. Filler is immediate but continues to integrate for up to four weeks." },
      { q: "Is there any downtime?", a: "Most treatments allow you to return to normal activity the same day. We'll give you written aftercare tailored to what you've had." },
      { q: "Do you offer payment plans?", a: "Yes — courses of three or more sessions can be split across the plan with no interest." },
    ],
    show_contact: true,
    contact_email: DEMO_PRACTITIONER_EMAIL,
    contact_phone: "+44 20 7946 0000",
  } as const;

  const profileFields = {
    is_demo: true,
    active: true,
    slug: DEMO_SLUG,
    clinic_name: DEMO_CLINIC_NAME,
    hero_url: IMG.hero,
    tagline: "Considered aesthetics, without the rush.",
    bio: "A boutique aesthetics studio pairing clinical rigour with a slow, considered treatment experience.",
    about:
      "We're a small, women-led team creating an unhurried environment for consultations, treatments and reviews. Every visit begins with a proper conversation.",
    brand_color: "#8b7355",
    specialties: ["Anti-wrinkle", "Lip filler", "Skin boosters", "Polynucleotides", "Skin health"],
    qualifications: [
      { label: "BSc (Hons) Adult Nursing — King's College London", year: "2012" },
      { label: "Independent Nurse Prescriber (V300)", year: "2017" },
      { label: "PgCert Non-Surgical Facial Aesthetics", year: "2019" },
      { label: "JCCP Registered Practitioner", year: "2021" },
    ],
    timeline: [
      { year: "2012", label: "Qualified as a registered nurse, moved into A&E and cardiology." },
      { year: "2017", label: "Completed independent prescribing and moved full-time into aesthetics." },
      { year: "2020", label: "Opened the first MODO Demo studio in central London." },
      { year: "2024", label: "Awarded 'Boutique Clinic of the Year' at the UK Aesthetics Awards." },
    ],
    about_page: aboutPage as unknown as any,
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

  // Categories (treatment + package)
  async function ensureCategory(
    name: string,
    kind: "treatment" | "package",
    sort_order: number,
    parent_id: string | null = null,
    description?: string,
  ) {
    const slugBase = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
    const slug = kind === "package" ? `pkg-${slugBase}` : slugBase;
    const { data: existing } = await admin
      .from("treatment_categories")
      .select("id")
      .eq("profile_id", profileId!)
      .eq("name", name)
      .eq("kind", kind)
      .maybeSingle();
    if (existing?.id) {
      await admin
        .from("treatment_categories")
        .update({ parent_id, sort_order, description: description ?? null })
        .eq("id", existing.id);
      return existing.id as string;
    }
    const { data, error } = await admin
      .from("treatment_categories")
      .insert({
        profile_id: profileId!,
        name,
        kind,
        slug,
        sort_order,
        parent_id,
        description: description ?? null,
      })
      .select("id")
      .single();
    if (error) throw error;
    return data!.id as string;
  }

  const catInjectables = await ensureCategory("Injectables", "treatment", 1, null, "Anti-wrinkle and dermal filler treatments.");
  const catSkin = await ensureCategory("Skin", "treatment", 2, null, "Boosters, polynucleotides and skin health.");
  const catConsults = await ensureCategory("Consultations", "treatment", 3, null, "Initial and review consultations.");
  const catAntiWrinkle = await ensureCategory("Anti-wrinkle", "treatment", 1, catInjectables);
  const catFiller = await ensureCategory("Dermal filler", "treatment", 2, catInjectables);
  const catBoosters = await ensureCategory("Skin boosters", "treatment", 1, catSkin);
  const catFacials = await ensureCategory("Facials & peels", "treatment", 2, catSkin);
  const catPackages = await ensureCategory("Signature packages", "package", 1);

  // Treatments
  async function ensureTreatment(
    name: string,
    price: number,
    duration: number,
    picture_url: string,
    description: string,
    extra: Record<string, unknown> = {},
  ) {
    const { data: existing } = await admin
      .from("treatments")
      .select("id")
      .eq("profile_id", profileId!)
      .eq("name", name)
      .maybeSingle();
    const payload = { picture_url, description, ...extra };
    if (existing?.id) {
      await admin.from("treatments").update(payload).eq("id", existing.id);
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
        ...payload,
      })
      .select("id")
      .single();
    if (error) throw error;
    return data!.id as string;
  }
  const t1 = await ensureTreatment(
    "Anti-wrinkle consultation",
    25,
    30,
    IMG.t1,
    "A relaxed 30-minute conversation to understand what you'd like from treatment, review your medical history and map a plan together.",
    { category_id: catConsults, is_consultation: true, sort_order: 1 },
  );
  const t2 = await ensureTreatment(
    "Lip filler — 1ml",
    220,
    45,
    IMG.t2,
    "Subtle, natural-looking enhancement using premium hyaluronic acid filler. Includes numbing, treatment and a follow-up review.",
    { category_id: catFiller, sort_order: 1, rebook_reminder_days: 270 },
  );
  const t3 = await ensureTreatment(
    "Skin booster review",
    85,
    20,
    IMG.t3,
    "A 20-minute review appointment to assess results and plan the next stage of your skin journey.",
    { category_id: catBoosters, sort_order: 3 },
  );
  await ensureTreatment(
    "Anti-wrinkle — 3 areas",
    275,
    30,
    IMG.t1,
    "Forehead, frown and crow's feet. Includes a two-week review and any small adjustments.",
    { category_id: catAntiWrinkle, sort_order: 1, requires_prescriber: true, rebook_reminder_days: 120 },
  );
  await ensureTreatment(
    "Anti-wrinkle — 2 areas",
    220,
    25,
    IMG.t1,
    "Choose any two upper-face areas. Includes review.",
    { category_id: catAntiWrinkle, sort_order: 2, requires_prescriber: true, rebook_reminder_days: 120 },
  );
  const t6 = await ensureTreatment(
    "Profhilo® — course of 2",
    480,
    40,
    IMG.t3,
    "Two Profhilo sessions spaced four weeks apart to deeply hydrate and improve skin quality.",
    {
      category_id: catBoosters,
      sort_order: 1,
      session_count: 2,
      session_interval_days: 28,
      allow_split_payment: true,
      topup_reminder_days: 180,
    },
  );
  await ensureTreatment(
    "Polynucleotides — course of 3",
    540,
    45,
    IMG.t3,
    "Three sessions of regenerative polynucleotide therapy, ideal for under-eye and skin quality.",
    {
      category_id: catBoosters,
      sort_order: 2,
      session_count: 3,
      session_interval_days: 21,
      allow_split_payment: true,
    },
  );
  const t8 = await ensureTreatment(
    "Signature facial",
    95,
    60,
    IMG.t2,
    "A one-hour skin-health facial with cleanse, gentle exfoliation, mask and LED. A lovely reset.",
    { category_id: catFacials, sort_order: 1 },
  );

  // Packages
  async function ensurePackage(
    name: string,
    price: number,
    session_count: number,
    treatment_ids: string[],
    description: string,
    image_url: string,
  ) {
    const { data: existing } = await admin
      .from("packages")
      .select("id")
      .eq("profile_id", profileId!)
      .eq("name", name)
      .maybeSingle();
    const payload = {
      description,
      image_url,
      treatment_ids,
      session_count,
      price,
      category_id: catPackages,
      active: true,
    };
    if (existing?.id) {
      await admin.from("packages").update(payload).eq("id", existing.id);
      return;
    }
    const { error } = await admin
      .from("packages")
      .insert({ profile_id: profileId!, name, ...payload });
    if (error) throw error;
  }
  await ensurePackage(
    "Glow package — 3 facials",
    240,
    3,
    [t8],
    "Three signature facials, spaced 4–6 weeks apart. Save £45 vs booking individually.",
    IMG.t2,
  );
  await ensurePackage(
    "Bridal radiance",
    720,
    4,
    [t6, t8],
    "Two Profhilo sessions plus two signature facials — timed for a 12-week glow build up to the day.",
    IMG.gallery1,
  );

  // Model slots — reduced-rate model appointments a week or two out
  const nowForSlots = new Date();
  const slotDate1 = new Date(nowForSlots.getTime() + 5 * 24 * 60 * 60 * 1000);
  const slotDate2 = new Date(nowForSlots.getTime() + 9 * 24 * 60 * 60 * 1000);
  const slotYmd = (d: Date) => d.toISOString().slice(0, 10);
  async function ensureModelSlot(
    treatment_id: string,
    date: string,
    start: string,
    end: string,
    price_value: number,
  ) {
    const { data: existing } = await admin
      .from("model_slots")
      .select("id")
      .eq("profile_id", profileId!)
      .eq("treatment_id", treatment_id)
      .eq("slot_date", date)
      .eq("start_time", start)
      .maybeSingle();
    if (existing?.id) return;
    const { error } = await admin.from("model_slots").insert({
      profile_id: profileId!,
      location_id: locationId!,
      treatment_id,
      slot_date: date,
      start_time: start,
      end_time: end,
      price_mode: "fixed",
      price_value,
      is_flexible: false,
      active: true,
      notes: "Model appointment — reduced rate in exchange for photography & a short case study.",
    });
    if (error) throw error;
  }
  await ensureModelSlot(t2, slotYmd(slotDate1), "14:00:00", "14:45:00", 15000);
  await ensureModelSlot(t6, slotYmd(slotDate2), "10:30:00", "11:10:00", 30000);


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
    logo_url: IMG.logo,
    header_logo_size: "medium",
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

  // Rewards & referrals — enabled + publicly visible on the booking page
  await admin
    .from("clinic_referral_settings")
    .upsert(
      {
        clinic_profile_id: practitionerUserId,
        enabled: true,
        show_on_public_page: true,
        referrer_credit_kind: "pennies",
        referrer_credit_pennies: 1500,
        referrer_credit_percent: 0,
        referrer_points: 100,
        friend_credit_kind: "pennies",
        friend_credit_pennies: 1000,
        friend_credit_percent: 0,
        points_redemption_enabled: true,
        points_per_pound_redeem: 20,
        earn_on_spend_enabled: true,
        points_per_pound_earn: 1,
        tiers_enabled: true,
        trigger_event: "completed_paid",
        max_rewarded_per_year: null,
        headline: "MODO Rewards",
        description: "Earn points every time you visit and unlock member-only perks. Refer a friend and you'll both receive credit.",
      } as never,
      { onConflict: "clinic_profile_id" },
    );

  const { count: tierCount } = await admin
    .from("clinic_reward_tiers")
    .select("id", { count: "exact", head: true })
    .eq("clinic_profile_id", practitionerUserId);
  if (!tierCount) {
    await admin.from("clinic_reward_tiers").insert([
      {
        clinic_profile_id: practitionerUserId,
        label: "£10 off your next visit",
        points_cost: 200,
        reward_kind: "credit_pennies",
        reward_value: 1000,
        description: "Redeem 200 points for £10 off any treatment.",
        enabled: true,
        sort_order: 1,
      },
      {
        clinic_profile_id: practitionerUserId,
        label: "Complimentary skin booster add-on",
        points_cost: 500,
        reward_kind: "free_addon",
        reward_value: 0,
        description: "A little extra glow, on us.",
        enabled: true,
        sort_order: 2,
      },
      {
        clinic_profile_id: practitionerUserId,
        label: "£40 loyalty credit",
        points_cost: 800,
        reward_kind: "credit_pennies",
        reward_value: 4000,
        description: "Our thank-you for being part of the MODO family.",
        enabled: true,
        sort_order: 3,
      },
    ] as never);
  }

  // Gift cards — value + treatment + package options
  const { count: giftCount } = await admin
    .from("gift_cards")
    .select("id", { count: "exact", head: true })
    .eq("profile_id", practitionerUserId);
  if (!giftCount) {
    await admin.from("gift_cards").insert([
      {
        profile_id: practitionerUserId,
        name: "£50 MODO gift card",
        description: "A thoughtful gift towards any treatment at the clinic.",
        kind: "value",
        amount: 50,
        image_url: IMG.gallery1,
        expires_months: 12,
        active: true,
        sort_order: 1,
      },
      {
        profile_id: practitionerUserId,
        name: "£100 MODO gift card",
        description: "The perfect present — redeemable against any service.",
        kind: "value",
        amount: 100,
        image_url: IMG.t1,
        expires_months: 12,
        active: true,
        sort_order: 2,
      },
      {
        profile_id: practitionerUserId,
        name: "Lip filler — 1ml gift",
        description: "A full 1ml lip filler treatment with our lead clinician.",
        kind: "treatment",
        treatment_id: t2,
        image_url: IMG.t2,
        expires_months: 12,
        active: true,
        sort_order: 3,
      },
    ] as never);
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

  // Appointments — a past one and an upcoming one.
  // NOTE: times must be deterministic (fixed clock times, local date parts) or
  // every seed run creates a fresh "duplicate" booking at the current time.
  const now = new Date();
  const upcoming = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 3, 10, 0, 0);
  const past = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 14, 14, 0, 0);

  function pad(n: number) {
    return String(n).padStart(2, "0");
  }
  function ymd(d: Date) {
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }
  function hms(d: Date) {
    return `${pad(d.getHours())}:${pad(d.getMinutes())}:00`;
  }

  async function ensureAppointment(
    when: Date,
    treatmentId: string,
    treatmentName: string,
    status: string,
    totalAmount: number,
    patientName: string = DEMO_PATIENT_NAME,
    patientEmail: string = DEMO_PATIENT_EMAIL,
    linkPatientUser: boolean = true,
  ) {
    const date = ymd(when);
    const start = hms(when);
    // Dedupe per patient per day — one seeded booking per patient per date,
    // regardless of the time it was originally created at.
    const { data: existingSame } = await admin
      .from("appointments")
      .select("id, total_amount, start_time")
      .eq("profile_id", profileId!)
      .eq("scheduled_date", date)
      .eq("patient_email", patientEmail)
      .eq("is_demo", true)
      .order("start_time", { ascending: true });
    if (existingSame && existingSame.length > 0) {
      const keep = existingSame[0];
      const extras = existingSame.slice(1).map((r: any) => r.id);
      if (extras.length > 0) {
        await admin.from("appointments").delete().in("id", extras);
      }
      const patch: Record<string, unknown> = { start_time: start };
      if (keep.total_amount == null || Number(keep.total_amount) === 0) {
        patch.total_amount = totalAmount;
        patch.base_amount = totalAmount;
        patch.payment_status = status === "completed" ? "paid" : "pending";
      }
      await admin.from("appointments").update(patch).eq("id", keep.id);
      return keep.id;
    }
    const end = hms(new Date(when.getTime() + 30 * 60 * 1000));
    const { error } = await admin.from("appointments").insert({
      profile_id: profileId!,
      patient_user_id: linkPatientUser ? patientUserId : null,
      patient_name: patientName,
      patient_email: patientEmail,
      location_id: locationId!,
      treatment_id: treatmentId,
      treatment_name_snapshot: treatmentName,
      scheduled_date: date,
      start_time: start,
      end_time: end,
      status,
      base_amount: totalAmount,
      total_amount: totalAmount,
      payment_status: status === "completed" ? "paid" : "pending",
      is_demo: true,
    });
    if (error) throw error;
    return null;
  }
  await ensureAppointment(past, t1, "Anti-wrinkle consultation", "completed", 25);
  await ensureAppointment(upcoming, t2, "Lip filler — 1ml", "confirmed", 220);


  // Historical revenue — spread completed appointments across the current
  // month so the Sales dashboard has realistic figures to display.
  const historyPatients: Array<{ name: string; email: string }> = [
    { name: "Ava Thompson", email: "ava.thompson+demo@modobook.uk" },
    { name: "Chloe Baxter", email: "chloe.baxter+demo@modobook.uk" },
    { name: "Isla Ferguson", email: "isla.ferguson+demo@modobook.uk" },
    { name: "Sophie Nair", email: "sophie.nair+demo@modobook.uk" },
    { name: "Grace Lin", email: "grace.lin+demo@modobook.uk" },
    { name: "Ruby Ahmed", email: "ruby.ahmed+demo@modobook.uk" },
    { name: "Ella Doyle", email: "ella.doyle+demo@modobook.uk" },
    { name: "Nina Park", email: "nina.park+demo@modobook.uk" },
  ];
  const historyMenu: Array<{ id: string; name: string; price: number }> = [
    { id: t2, name: "Lip filler — 1ml", price: 220 },
    { id: t8, name: "Signature facial", price: 95 },
    { id: t6, name: "Profhilo® — course of 2", price: 480 },
    { id: t3, name: "Skin booster review", price: 85 },
    { id: t1, name: "Anti-wrinkle consultation", price: 25 },
  ];
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const todayDay = now.getDate();
  // Two per week for the past ~4 weeks up to yesterday, at varied times.
  const dayOffsets = [1, 3, 5, 7, 10, 12, 14, 17, 20, 23, 26, 28];
  let idx = 0;
  for (const offset of dayOffsets) {
    const d = new Date(now.getFullYear(), now.getMonth(), Math.max(1, todayDay - offset), 10 + ((idx * 2) % 7), (idx % 2) * 30, 0);
    if (d < startOfMonth || d >= now) {
      idx++;
      continue;
    }
    const item = historyMenu[idx % historyMenu.length];
    const patient = historyPatients[idx % historyPatients.length];
    await ensureAppointment(d, item.id, item.name, "completed", item.price, patient.name, patient.email, false);
    idx++;
  }

  // Reward points — seed the demo patient with a 1000-point balance so the
  // Rewards tab and referral-code redemption flow have something to show.
  {
    const { data: existingSeed } = await admin
      .from("patient_points_ledger")
      .select("id")
      .eq("patient_user_id", patientUserId)
      .eq("clinic_profile_id", practitionerUserId)
      .eq("reason", "demo_seed")
      .maybeSingle();
    if (!existingSeed?.id) {
      // Zero out any prior balance so we always land on exactly 1000.
      const { data: prior } = await admin
        .from("patient_points_ledger")
        .select("delta")
        .eq("patient_user_id", patientUserId)
        .eq("clinic_profile_id", practitionerUserId);
      const currentBalance = (prior ?? []).reduce((s, r: any) => s + Number(r.delta ?? 0), 0);
      const delta = 1000 - currentBalance;
      if (delta !== 0) {
        await admin.from("patient_points_ledger").insert({
          patient_user_id: patientUserId,
          clinic_profile_id: practitionerUserId,
          delta,
          reason: "demo_seed",
          note: "Demo starter balance",
        });
      }
    }
  }


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
