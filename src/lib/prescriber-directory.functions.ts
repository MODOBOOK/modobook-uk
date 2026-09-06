import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

// ============================================================================
// Prescriber Discovery — opt-in directory where approved prescribers can be
// found by practitioners, who then send a request to connect with a message.
// Contact details are only shared once the prescriber accepts.
// ============================================================================

const SERVICES = [
  "Botulinum toxin",
  "Dermal fillers",
  "Weight management",
  "IV therapy",
  "Skin boosters",
  "Vitamin injections",
  "Other",
] as const;

export const PRESCRIBER_SERVICE_OPTIONS = SERVICES;

const ListingSchema = z.object({
  display_name: z.string().trim().min(2).max(80),
  bio: z.string().trim().max(600).optional(),
  town: z.string().trim().min(2).max(80),
  postcode_area: z.string().trim().max(8).optional(),
  travel_radius_miles: z.number().int().min(1).max(500),
  services: z.array(z.string().trim().min(1).max(60)).max(10),
  availability: z.string().trim().max(200).optional(),
  day_rate: z.number().min(0).max(100000).nullable(),
  rates_on_request: z.boolean(),
  contact_email: z.string().trim().email().max(255).nullable(),
  contact_phone: z.string().trim().max(30).nullable(),
  is_listed: z.boolean(),
});

// ---- Prescriber: read my own listing (and whether I can list) ----
export const getMyDirectoryListing = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const [{ data: presc }, { data: listing }] = await Promise.all([
      supabase.from("prescriber_profiles").select("status, full_name").eq("user_id", userId).maybeSingle(),
      supabase.from("prescriber_directory_listings").select("*").eq("user_id", userId).maybeSingle() as unknown as Promise<{ data: Record<string, unknown> | null }>,
    ]);
    const l = listing as Record<string, unknown> | null;
    return {
      approved: presc?.status === "approved",
      defaultName: presc?.full_name ?? "",
      listing: l
        ? {
            display_name: l.display_name as string,
            bio: (l.bio as string | null) ?? "",
            town: l.town as string,
            postcode_area: (l.postcode_area as string | null) ?? "",
            travel_radius_miles: l.travel_radius_miles as number,
            services: (l.services as string[]) ?? [],
            availability: (l.availability as string | null) ?? "",
            day_rate: l.day_rate_pence != null ? (l.day_rate_pence as number) / 100 : null,
            rates_on_request: l.rates_on_request as boolean,
            contact_email: (l.contact_email as string | null) ?? "",
            contact_phone: (l.contact_phone as string | null) ?? "",
            is_listed: l.is_listed as boolean,
          }
        : null,
    };
  });

// ---- Prescriber: save my listing (approved prescribers only) ----
export const saveMyDirectoryListing = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: z.infer<typeof ListingSchema>) => ListingSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: presc } = await supabase
      .from("prescriber_profiles")
      .select("status")
      .eq("user_id", userId)
      .maybeSingle();
    if (presc?.status !== "approved") throw new Error("Only approved prescribers can appear in the directory");
    const row = {
      user_id: userId,
      display_name: data.display_name,
      bio: data.bio?.trim() || null,
      town: data.town,
      postcode_area: data.postcode_area?.trim().toUpperCase() || null,
      travel_radius_miles: data.travel_radius_miles,
      services: data.services,
      availability: data.availability?.trim() || null,
      day_rate_pence: data.day_rate == null ? null : Math.round(data.day_rate * 100),
      rates_on_request: data.rates_on_request,
      contact_email: data.contact_email || null,
      contact_phone: data.contact_phone || null,
      is_listed: data.is_listed,
    };
    const { error } = await supabase
      .from("prescriber_directory_listings")
      .upsert(row as never, { onConflict: "user_id" });
    if (error) throw error;
    return { ok: true };
  });

// ---- Practitioner: browse the directory ----
export const searchDirectory = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    // Must be a practitioner (has a clinic profile) to browse.
    const { data: myProfile } = await supabase.from("profiles").select("id").eq("user_id", userId).maybeSingle();
    if (!myProfile) return { isPractitioner: false as const, listings: [] as never[], sent: [] as never[] };

    const { data: rows, error } = (await supabase
      .from("prescriber_directory_listings")
      .select("user_id, display_name, bio, town, postcode_area, travel_radius_miles, services, availability, day_rate_pence, rates_on_request")
      .eq("is_listed", true)) as unknown as { data: Record<string, unknown>[] | null; error: unknown };
    if (error) throw error;

    // Only show prescribers whose account is approved.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const ids = (rows ?? []).map((r) => r.user_id as string);
    const { data: presc } = ids.length
      ? await supabaseAdmin.from("prescriber_profiles").select("user_id, status, regulatory_body").in("user_id", ids)
      : { data: [] as { user_id: string; status: string; regulatory_body: string | null }[] };
    const approved = new Map((presc ?? []).filter((p) => p.status === "approved").map((p) => [p.user_id, p]));

    // Requests I've already sent (for button state).
    const { data: sent } = (await supabase
      .from("prescriber_connect_requests")
      .select("prescriber_user_id, status")
      .eq("practitioner_user_id", userId)) as unknown as { data: { prescriber_user_id: string; status: string }[] | null };

    const listings = (rows ?? [])
      .filter((r) => approved.has(r.user_id as string) && (r.user_id as string) !== userId)
      .map((r) => ({
        user_id: r.user_id as string,
        display_name: r.display_name as string,
        bio: (r.bio as string | null) ?? null,
        town: r.town as string,
        postcode_area: (r.postcode_area as string | null) ?? null,
        travel_radius_miles: r.travel_radius_miles as number,
        services: (r.services as string[]) ?? [],
        availability: (r.availability as string | null) ?? null,
        day_rate: r.day_rate_pence != null ? (r.day_rate_pence as number) / 100 : null,
        rates_on_request: r.rates_on_request as boolean,
        regulatory_body: approved.get(r.user_id as string)?.regulatory_body ?? null,
      }))
      .sort((a, b) => a.town.localeCompare(b.town));

    return { isPractitioner: true as const, listings, sent: sent ?? [] };
  });

// ---- Practitioner: send a connect request with a message ----
const ConnectSchema = z.object({
  prescriber_user_id: z.string().uuid(),
  message: z.string().trim().min(10, "Tell the prescriber a little about what you need").max(1000),
});
export const sendConnectRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: z.infer<typeof ConnectSchema>) => ConnectSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (data.prescriber_user_id === userId) throw new Error("You can't connect with yourself");
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, clinic_name, full_name, email, phone")
      .eq("user_id", userId)
      .maybeSingle();
    if (!profile) throw new Error("Only practitioners with a clinic profile can connect");

    // Target must be a live listing.
    const { data: listing } = (await supabase
      .from("prescriber_directory_listings")
      .select("user_id, is_listed")
      .eq("user_id", data.prescriber_user_id)
      .maybeSingle()) as unknown as { data: { user_id: string; is_listed: boolean } | null };
    if (!listing?.is_listed) throw new Error("This prescriber is no longer listed");

    const { data: existing } = (await supabase
      .from("prescriber_connect_requests")
      .select("id, status")
      .eq("prescriber_user_id", data.prescriber_user_id)
      .eq("practitioner_user_id", userId)
      .eq("status", "pending")
      .maybeSingle()) as unknown as { data: { id: string } | null };
    if (existing) throw new Error("You already have a request waiting with this prescriber");

    const { error } = await supabase.from("prescriber_connect_requests").insert({
      prescriber_user_id: data.prescriber_user_id,
      practitioner_user_id: userId,
      clinic_name: profile.clinic_name ?? null,
      practitioner_name: profile.full_name ?? null,
      practitioner_email: (profile as { email?: string | null }).email ?? null,
      practitioner_phone: (profile as { phone?: string | null }).phone ?? null,
      message: data.message,
    } as never);
    if (error) throw error;

    // In-app notification for the prescriber (only possible if they also have
    // a clinic profile row, since notifications key off profiles).
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: prescProfile } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("user_id", data.prescriber_user_id)
      .maybeSingle();
    if (prescProfile) {
      await supabaseAdmin.rpc("create_notification", {
        p_profile_id: prescProfile.id,
        p_type: "prescriber_connect",
        p_title: "New connection request",
        p_body: `${profile.clinic_name ?? profile.full_name ?? "A clinic"} wants to connect with you.`,
        p_emoji: "🤝",
        p_link: "/prescriber/directory",
        p_entity_id: null as unknown as string,
        p_entity_type: "prescriber_connect_request",
      });
    }
    return { ok: true };
  });

// ---- Both sides: list connect requests ----
export const listConnectRequests = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: rows, error } = (await supabase
      .from("prescriber_connect_requests")
      .select("id, prescriber_user_id, practitioner_user_id, clinic_name, practitioner_name, practitioner_email, practitioner_phone, message, status, created_at")
      .or(`prescriber_user_id.eq.${userId},practitioner_user_id.eq.${userId}`)
      .order("created_at", { ascending: false })
      .limit(100)) as unknown as { data: Record<string, unknown>[] | null; error: unknown };
    if (error) throw error;

    const prescIds = Array.from(new Set((rows ?? []).map((r) => r.prescriber_user_id as string).filter((id) => id !== userId)));
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data: presc }, { data: listings }] = prescIds.length
      ? await Promise.all([
          supabaseAdmin.from("prescriber_profiles").select("user_id, full_name").in("user_id", prescIds),
          supabaseAdmin.from("prescriber_directory_listings").select("user_id, display_name, town").in("user_id", prescIds),
        ])
      : [{ data: [] as { user_id: string; full_name: string | null }[] }, { data: [] as { user_id: string; display_name: string | null; town: string | null }[] }];
    const pmap = new Map((presc ?? []).map((p) => [p.user_id, p]));
    const lmap = new Map((listings ?? []).map((l) => [l.user_id, l]));

    // Accepted requests share the prescriber's preferred contact details with the practitioner.
    const acceptedPrescIds = (rows ?? [])
      .filter((r) => r.status === "accepted" && r.practitioner_user_id === userId)
      .map((r) => r.prescriber_user_id as string);
    const { data: contactRows } = acceptedPrescIds.length
      ? ((await supabaseAdmin
          .from("prescriber_directory_listings")
          .select("user_id, contact_email, contact_phone")
          .in("user_id", acceptedPrescIds)) as unknown as { data: { user_id: string; contact_email: string | null; contact_phone: string | null }[] | null })
      : { data: [] as { user_id: string; contact_email: string | null; contact_phone: string | null }[] };
    const contactMap = new Map((contactRows ?? []).map((c) => [c.user_id, c]));

    return (rows ?? []).map((r) => {
      const pid = r.prescriber_user_id as string;
      const isMine = r.practitioner_user_id === userId;
      const contact = r.status === "accepted" ? contactMap.get(pid) : null;
      return {
        id: r.id as string,
        direction: isMine ? ("sent" as const) : ("received" as const),
        status: r.status as "pending" | "accepted" | "declined",
        created_at: r.created_at as string,
        message: r.message as string,
        clinic_name: (r.clinic_name as string | null) ?? null,
        practitioner_name: (r.practitioner_name as string | null) ?? null,
        practitioner_email: isMine ? null : ((r.practitioner_email as string | null) ?? null),
        practitioner_phone: isMine ? null : ((r.practitioner_phone as string | null) ?? null),
        prescriber_name: pmap.get(pid)?.full_name ?? lmap.get(pid)?.display_name ?? "Prescriber",
        prescriber_town: lmap.get(pid)?.town ?? null,
        prescriber_contact_email: contact?.contact_email ?? null,
        prescriber_contact_phone: contact?.contact_phone ?? null,
      };
    });
  });

// ---- Prescriber: accept / decline a request ----
export const respondToConnectRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { id: string; action: "accept" | "decline" }) => i)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row, error } = (await supabase
      .from("prescriber_connect_requests")
      .update({ status: data.action === "accept" ? "accepted" : "declined" } as never)
      .eq("id", data.id)
      .eq("prescriber_user_id", userId)
      .eq("status", "pending")
      .select("id, practitioner_user_id")) as unknown as { data: { id: string; practitioner_user_id: string }[] | null; error: unknown };
    if (error) throw error;
    if (!row || row.length === 0) throw new Error("Request not found or already answered");

    // Let the practitioner know.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: practProfile } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("user_id", row[0].practitioner_user_id)
      .maybeSingle();
    const { data: presc } = await supabaseAdmin
      .from("prescriber_profiles")
      .select("full_name")
      .eq("user_id", userId)
      .maybeSingle();
    if (practProfile) {
      await supabaseAdmin.rpc("create_notification", {
        p_profile_id: practProfile.id,
        p_type: "prescriber_connect",
        p_title: data.action === "accept" ? "Connection accepted" : "Connection declined",
        p_body:
          data.action === "accept"
            ? `${presc?.full_name ?? "The prescriber"} accepted your request — their contact details are now available.`
            : `${presc?.full_name ?? "The prescriber"} isn't able to connect right now.`,
        p_emoji: data.action === "accept" ? "🤝" : "ℹ️",
        p_link: "/dashboard/find-prescriber",
        p_entity_id: null as unknown as string,
        p_entity_type: "prescriber_connect_request",
      });
    }
    return { ok: true };
  });
