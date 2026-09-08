import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function __activeProfileId(supabase: any, userId: string) {
  const { activeProfileId } = await import("./clinic-context.server");
  return (await activeProfileId(supabase, userId)) ?? "00000000-0000-0000-0000-000000000000";
}

export const listMyPractitioners = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: profile } = await supabase
      .from("profiles").select("id").eq("id", await __activeProfileId(supabase, userId)).maybeSingle();
    if (!profile) return { practitioners: [], links: [], treatmentLinks: [] };
    const [{ data: practitioners }, { data: links }, { data: treatmentLinks }] = await Promise.all([
      supabase.from("practitioners").select("*").eq("profile_id", profile.id)
        .order("display_order").order("created_at"),
      supabase.from("location_practitioners").select("*"),
      supabase.from("practitioner_treatments").select("practitioner_id, treatment_id")
        .eq("profile_id", profile.id),
    ]);
    const ids = new Set((practitioners ?? []).map((p) => p.id));
    return {
      practitioners: practitioners ?? [],
      links: (links ?? []).filter((l) => ids.has(l.practitioner_id)),
      treatmentLinks: treatmentLinks ?? [],
    };
  });

type PractitionerInput = {
  id?: string;
  name: string;
  professional_title?: string | null;
  photo_url?: string | null;
  bio?: string | null;
  active?: boolean;
  display_order?: number;
  location_ids?: string[];
  treatment_ids?: string[] | null;
};

export const upsertPractitioner = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: PractitionerInput) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: profile } = await supabase
      .from("profiles").select("id").eq("id", await __activeProfileId(supabase, userId)).maybeSingle();
    if (!profile) throw new Error("Profile not found");

    const payload = {
      profile_id: profile.id,
      name: data.name,
      professional_title: data.professional_title ?? null,
      photo_url: data.photo_url ?? null,
      bio: data.bio ?? null,
      active: data.active ?? true,
      display_order: data.display_order ?? 0,
    };

    let row;
    if (data.id) {
      const { data: r, error } = await supabase.from("practitioners")
        .update(payload).eq("id", data.id).eq("profile_id", profile.id)
        .select().single();
      if (error) throw error;
      row = r;
    } else {
      const { assertSeatAvailable } = await import("./practitioner-billing.functions");
      await assertSeatAvailable(supabase, profile.id, "practitioner");
      const { data: r, error } = await supabase.from("practitioners")
        .insert(payload).select().single();
      if (error) throw error;
      row = r;
      try {
        const { syncSubscriptionSeats } = await import("./billing-sync.server");
        await syncSubscriptionSeats(supabase, profile.id);
      } catch (err) {
        console.error("[savePractitioner] seat sync failed", err);
      }
    }

    if (data.location_ids) {
      await supabase.from("location_practitioners")
        .delete().eq("practitioner_id", row.id);
      if (data.location_ids.length > 0) {
        await supabase.from("location_practitioners").insert(
          data.location_ids.map((lid, i) => ({
            practitioner_id: row.id,
            location_id: lid,
            display_order: i,
          })),
        );
      }
    }
    if (data.treatment_ids !== undefined) {
      await supabase.from("practitioner_treatments").delete().eq("practitioner_id", row.id);
      const ids = data.treatment_ids ?? [];
      if (ids.length > 0) {
        await supabase.from("practitioner_treatments").insert(
          ids.map((tid) => ({ profile_id: profile.id, practitioner_id: row.id, treatment_id: tid })),
        );
      }
    }
    return row;
  });

export const deletePractitioner = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: profile } = await supabase
      .from("profiles").select("id").eq("id", await __activeProfileId(supabase, userId)).maybeSingle();
    if (!profile) throw new Error("Profile not found");
    const { error } = await supabase.from("practitioners")
      .delete().eq("id", data.id).eq("profile_id", profile.id);
    if (error) throw error;
    return { ok: true };
  });

/** Which team members / practitioners can perform a given service. */
export const getTreatmentPractitioners = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { treatment_id: string }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const profileId = await __activeProfileId(supabase, userId);
    const { data: rows } = await supabase
      .from("practitioner_treatments")
      .select("practitioner_id")
      .eq("profile_id", profileId)
      .eq("treatment_id", data.treatment_id);
    return (rows ?? []).map((r) => r.practitioner_id as string);
  });

export const setTreatmentPractitioners = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { treatment_id: string; practitioner_ids: string[] }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const profileId = await __activeProfileId(supabase, userId);

    // Ownership check — the service must belong to this clinic.
    const { data: treat } = await supabase
      .from("treatments")
      .select("id")
      .eq("id", data.treatment_id)
      .eq("profile_id", profileId)
      .maybeSingle();
    if (!treat) throw new Error("Service not found");

    await supabase
      .from("practitioner_treatments")
      .delete()
      .eq("profile_id", profileId)
      .eq("treatment_id", data.treatment_id);

    if (data.practitioner_ids.length > 0) {
      const { data: valid } = await supabase
        .from("practitioners")
        .select("id")
        .eq("profile_id", profileId)
        .in("id", data.practitioner_ids);
      const ids = (valid ?? []).map((p) => p.id as string);
      if (ids.length > 0) {
        const { error } = await supabase.from("practitioner_treatments").insert(
          ids.map((practitioner_id) => ({
            profile_id: profileId,
            practitioner_id,
            treatment_id: data.treatment_id,
          })),
        );
        if (error) throw error;
      }
    }
    return { ok: true };
  });
