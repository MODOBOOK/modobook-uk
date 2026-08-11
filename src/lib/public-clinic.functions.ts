import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/integrations/supabase/types";
import { filterUnblockedModelSlots } from "@/lib/model-slot-blocks";


function getServerSupabasePublic() {
  return createClient<Database>(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    {
      auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
    },
  );
}

export const getPublicClinic = createServerFn({ method: "GET" })
  .inputValidator((input: { slug: string }) => input)
  .handler(async ({ data }) => {
    const supabase = getServerSupabasePublic();
    const { data: profile, error: profileError } = await supabase
      .rpc("get_public_profile_by_slug", { p_slug: data.slug.toLowerCase() })
      .single();
    if (profileError) throw profileError;
    if (!profile) throw new Error("Clinic not found");

    const { data: treatments, error: treatmentError } = await supabase
      .from("treatments")
      .select("*")
      .eq("profile_id", profile.id)
      .eq("active", true)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: false });
    if (treatmentError) throw treatmentError;

    const { data: packages, error: packageError } = await supabase
      .from("packages")
      .select("*")
      .eq("profile_id", profile.id)
      .eq("active", true)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: false });
    if (packageError) throw packageError;

    const { data: gallery, error: galleryError } = await supabase
      .from("clinic_gallery")
      .select("*")
      .eq("profile_id", profile.id)
      .order("display_order", { ascending: true });
    if (galleryError) throw galleryError;

    const { data: testimonials, error: testimonialError } = await supabase
      .from("clinic_testimonials")
      .select("*")
      .eq("profile_id", profile.id)
      .order("created_at", { ascending: false });
    if (testimonialError) throw testimonialError;

    const { data: locations, error: locationsError } = await supabase
      .from("locations")
      .select("id, profile_id, name, address_line1, address_line2, city, postcode, country, is_primary, display_order, active, created_at, updated_at, image_url")
      .eq("profile_id", profile.id)
      .eq("active", true)
      .eq("is_public", true)
      .order("is_primary", { ascending: false })
      .order("name", { ascending: true });
    if (locationsError) throw locationsError;

    const { data: categories } = await supabase
      .from("treatment_categories")
      .select("*")
      .eq("profile_id", profile.id)
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true });

    const treatmentIds = (treatments ?? []).map((t) => t.id);
    const { data: pricing } = treatmentIds.length
      ? await supabase
          .from("treatment_location_pricing")
          .select("*")
          .in("treatment_id", treatmentIds)
          .eq("available", true)
      : { data: [] as never[] };

    const { data: theme } = await supabase
      .from("clinic_theme")
      .select("*")
      .eq("profile_id", profile.id)
      .maybeSingle();

    const nowIso = new Date().toISOString();
    const { data: offerGroupRows } = await supabase
      .from("offer_groups")
      .select("*")
      .eq("profile_id", profile.id)
      .eq("active", true)
      .order("sort_order", { ascending: true });
    const liveOfferGroups = (offerGroupRows ?? []).filter(
      (g: any) =>
        (!g.starts_at || g.starts_at <= nowIso) && (!g.ends_at || g.ends_at > nowIso),
    );
    const { data: offerGroupItems } = liveOfferGroups.length
      ? await supabase
          .from("offer_group_items")
          .select("*")
          .in("group_id", liveOfferGroups.map((g: any) => g.id))
          .order("sort_order")
      : { data: [] as any[] };
    const offerGroups = liveOfferGroups.map((g: any) => ({
      ...g,
      items: (offerGroupItems ?? []).filter((i: any) => i.group_id === g.id),
    }));

    const { data: reviews } = await supabase
      .from("patient_reviews")
      .select("id, rating")
      .eq("profile_id", profile.id)
      .eq("approved", true);

    const reviewsCombined = [
      ...(reviews ?? []),
      ...((testimonials ?? []) as { id: string; rating: number | null }[]).map((t) => ({
        id: t.id,
        rating: t.rating ?? 5,
      })),
    ];


    const [concernAreas, concerns, concernLinks, modelSlots, addonLinks, practitioners, locationPractitioners, aboutRpc, careGuides, pretreatment, bookingCounts] = await Promise.all([
      supabase.from("concern_areas").select("*").eq("profile_id", profile.id).order("sort_order"),
      supabase.from("concerns").select("*").eq("profile_id", profile.id).order("sort_order"),
      supabase.from("concern_treatments").select("concern_id, treatment_id, sort_order").eq("profile_id", profile.id),
      supabase.from("model_slots")
        .select("id, treatment_id, location_id, slot_date, start_time, end_time, price_mode, price_value, notes, booked_appointment_id, active, is_flexible")
        .eq("profile_id", profile.id).eq("active", true).is("booked_appointment_id", null)
        .or(`is_flexible.eq.true,slot_date.gte.${new Date().toISOString().slice(0, 10)}`)
        .order("slot_date", { ascending: true }),

      treatmentIds.length
        ? supabase.from("treatment_addons").select("treatment_id, addon_id, discount_percent, discount_amount").in("treatment_id", treatmentIds)
        : Promise.resolve({ data: [] as { treatment_id: string; addon_id: string; discount_percent: number | null; discount_amount: number | null }[] }),
      supabase.from("practitioners").select("id, name, professional_title, photo_url, bio, display_order").eq("profile_id", profile.id).eq("active", true).order("display_order"),
      supabase.from("location_practitioners").select("location_id, practitioner_id, display_order"),
      supabase.rpc("get_about_page_by_slug", { p_slug: data.slug.toLowerCase() }),
      supabase.from("aftercare_templates")
        .select("id, name, body_html, summary, category")
        .eq("profile_id", profile.id)
        .eq("show_on_public", true)
        .order("name"),
      supabase.from("pretreatment_templates")
        .select("id, name, body_html, summary, sort_order, category, bullets")
        .eq("profile_id", profile.id)
        .eq("show_on_public", true)
        .eq("active", true)
        .order("sort_order"),
      (supabase as any).rpc("get_public_treatment_booking_counts", { p_profile_id: profile.id }),
    ]);

    const todayIso = new Date().toISOString().slice(0, 10);
    const [blockedDates, blockedTimes] = await Promise.all([
      supabase.from("blocked_dates").select("date, location_id").eq("profile_id", profile.id).gte("date", todayIso),
      supabase.from("blocked_times").select("date, start_time, end_time, location_id").eq("profile_id", profile.id).gte("date", todayIso),
    ]);


    return {
      profile,
      treatments: treatments ?? [],
      packages: packages ?? [],
      gallery: gallery ?? [],
      testimonials: testimonials ?? [],
      locations: locations ?? [],
      categories: categories ?? [],
      pricing: pricing ?? [],
      theme: theme ?? null,
      reviews: reviewsCombined,
      concernAreas: concernAreas.data ?? [],
      concerns: concerns.data ?? [],
      concernLinks: concernLinks.data ?? [],
      modelSlots: (() => {
        const now = new Date();
        const todayStr = now.toISOString().slice(0, 10);
        const live = (modelSlots.data ?? []).filter((s: any) => {
          if (s.is_flexible) return true;
          if (!s.slot_date) return true;
          if (s.slot_date > todayStr) return true;
          if (s.slot_date < todayStr) return false;
          // same day — compare end_time (fallback start_time) to now
          const timeStr = s.end_time || s.start_time;
          if (!timeStr) return true;
          const slotEnd = new Date(`${s.slot_date}T${timeStr}`);
          return slotEnd.getTime() > now.getTime();
        });
        return filterUnblockedModelSlots(
          live,
          (blockedDates.data ?? []) as any,
          (blockedTimes.data ?? []) as any,
        );
      })(),

      addonLinks: addonLinks.data ?? [],
      practitioners: practitioners.data ?? [],
      locationPractitioners: locationPractitioners.data ?? [],
      aboutPage: (aboutRpc.data as Json) ?? ({} as Json),
      careGuides: careGuides.data ?? [],
      pretreatment: pretreatment.data ?? [],
      bookingCounts: (bookingCounts.data ?? []) as { treatment_id: string; booked_count: number }[],
    };
  });




