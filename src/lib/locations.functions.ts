import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function __activeProfileId(supabase: any, userId: string) {
  const { activeProfileId } = await import("./clinic-context.server");
  return (await activeProfileId(supabase, userId)) ?? "00000000-0000-0000-0000-000000000000";
}

export const listMyLocations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", await __activeProfileId(supabase, userId))
      .maybeSingle();
    if (!profile) return [];
    const { data, error } = await supabase
      .from("locations")
      .select("*")
      .eq("profile_id", profile.id)
      .order("display_order", { ascending: true, nullsFirst: false })
      .order("is_primary", { ascending: false })
      .order("created_at");
    if (error) throw error;
    return data ?? [];
  });

type LocationInput = {
  id?: string;
  name: string;
  address_line1?: string | null;
  address_line2?: string | null;
  city?: string | null;
  postcode?: string | null;
  country?: string | null;
  phone?: string | null;
  notes?: string | null;
  is_primary?: boolean;
  active?: boolean;
  is_public?: boolean;
  image_url?: string | null;
  coming_soon?: boolean;
  coming_soon_label?: string | null;
};

/** Move a location up or down in the order shown to patients. */
export const reorderLocation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; direction: "up" | "down" }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: profile } = await supabase
      .from("profiles").select("id").eq("id", await __activeProfileId(supabase, userId)).maybeSingle();
    if (!profile) throw new Error("Profile not found");
    const { data: rows } = await supabase
      .from("locations")
      .select("id, display_order, is_primary, created_at")
      .eq("profile_id", profile.id)
      .order("display_order", { ascending: true, nullsFirst: false })
      .order("is_primary", { ascending: false })
      .order("created_at");
    const list = rows ?? [];
    const idx = list.findIndex((l) => l.id === data.id);
    if (idx < 0) throw new Error("Location not found");
    const swapWith = data.direction === "up" ? idx - 1 : idx + 1;
    if (swapWith < 0 || swapWith >= list.length) return { ok: true };
    const reordered = [...list];
    const tmp = reordered[idx]!;
    reordered[idx] = reordered[swapWith]!;
    reordered[swapWith] = tmp;
    for (let i = 0; i < reordered.length; i++) {
      await supabase
        .from("locations")
        .update({ display_order: i })
        .eq("id", reordered[i]!.id)
        .eq("profile_id", profile.id);
    }
    return { ok: true };
  });

export const upsertLocation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: LocationInput) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", await __activeProfileId(supabase, userId))
      .maybeSingle();
    if (!profile) throw new Error("Profile not found");

    if (data.is_primary) {
      await supabase
        .from("locations")
        .update({ is_primary: false })
        .eq("profile_id", profile.id);
    }

    const payload = {
      profile_id: profile.id,
      name: data.name,
      address_line1: data.address_line1 ?? null,
      address_line2: data.address_line2 ?? null,
      city: data.city ?? null,
      postcode: data.postcode ?? null,
      country: data.country ?? null,
      phone: data.phone ?? null,
      notes: data.notes ?? null,
      is_primary: data.is_primary ?? false,
      active: data.active ?? true,
      is_public: data.is_public ?? true,
      image_url: data.image_url ?? null,
      coming_soon: data.coming_soon ?? false,
      coming_soon_label: data.coming_soon_label || null,
    };

    if (data.id) {
      const { data: row, error } = await supabase
        .from("locations")
        .update(payload)
        .eq("id", data.id)
        .eq("profile_id", profile.id)
        .select()
        .single();
      if (error) throw error;
      return row;
    } else {
      const { assertSeatAvailable } = await import("./practitioner-billing.functions");
      await assertSeatAvailable(supabase, profile.id, "location");
      const { data: row, error } = await supabase
        .from("locations")
        .insert(payload)
        .select()
        .single();
      if (error) throw error;
      try {
        const { syncSubscriptionSeats } = await import("./billing-sync.server");
        await syncSubscriptionSeats(supabase, profile.id);
      } catch (err) {
        console.error("[saveLocation] seat sync failed", err);
      }
      return row;
    }
  });

export const deleteLocation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", await __activeProfileId(supabase, userId))
      .maybeSingle();
    if (!profile) throw new Error("Profile not found");
    const { error } = await supabase
      .from("locations")
      .delete()
      .eq("id", data.id)
      .eq("profile_id", profile.id);
    if (error) throw error;
    return { ok: true };
  });

export const setTreatmentLocationPricing = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      treatment_id: string;
      location_id: string;
      price_cents?: number | null;
      duration_minutes?: number | null;
      available?: boolean;
    }) => input,
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    // RLS enforces ownership
    const { data: row, error } = await supabase
      .from("treatment_location_pricing")
      .upsert(
        {
          treatment_id: data.treatment_id,
          location_id: data.location_id,
          price_cents: data.price_cents ?? null,
          duration_minutes: data.duration_minutes ?? null,
          available: data.available ?? true,
        },
        { onConflict: "treatment_id,location_id" },
      )
      .select()
      .single();
    if (error) throw error;
    return row;
  });

export const getLocationPriceList = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { location_id: string }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: profile } = await supabase
      .from("profiles").select("id").eq("id", await __activeProfileId(supabase, userId)).maybeSingle();
    if (!profile) throw new Error("Profile not found");

    const [{ data: treatments }, { data: pricing }] = await Promise.all([
      supabase
        .from("treatments")
        .select("id, name, price, duration, category_id, active")
        .eq("profile_id", profile.id)
        .order("name"),
      supabase
        .from("treatment_location_pricing")
        .select("treatment_id, price_cents, duration_minutes, available")
        .eq("location_id", data.location_id),
    ]);

    const byTreatment = new Map(
      (pricing ?? []).map((p) => [p.treatment_id, p]),
    );
    return (treatments ?? []).map((t) => {
      const p = byTreatment.get(t.id);
      return {
        treatment_id: t.id,
        name: t.name,
        active: t.active,
        base_price: Number(t.price ?? 0),
        base_duration: t.duration ?? null,
        price_cents: p?.price_cents ?? null,
        duration_minutes: p?.duration_minutes ?? null,
        available: p?.available ?? true,
      };
    });
  });

