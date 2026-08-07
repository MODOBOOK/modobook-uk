import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type AssociateStatus = "invited" | "active" | "revoked" | "declined";

export type AssociateRow = {
  id: string;
  clinic_profile_id: string;
  associate_profile_id: string | null;
  invited_email: string;
  invited_name: string;
  status: AssociateStatus;
  accepted_at: string | null;
  oversight_records: boolean;
  oversight_appointments: boolean;
  oversight_incidents: boolean;
  room_allocation_enabled: boolean;
  room_id: string | null;
  location_id: string | null;
  block_when_no_room: boolean;
  charge_room_rent: boolean;
  seat_sponsored: boolean;
  notes: string | null;
  created_at: string;
  associate_slug?: string | null;
  associate_name?: string | null;
};

async function getProfile(supabase: any, userId: string) {
  const { data } = await supabase
    .from("profiles")
    .select("id, slug, clinic_name, full_name, email, associates_enabled")
    .eq("user_id", userId)
    .maybeSingle();
  return data as
    | { id: string; slug: string; clinic_name: string | null; full_name: string | null; email: string | null; associates_enabled: boolean }
    | null;
}

/** Everything the associates screen needs in one round trip. */
export const getAssociatesContext = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const prof = await getProfile(context.supabase, context.userId);
    if (!prof) return { enabled: false, profileId: null, associates: [], hostLinks: [], rooms: [], locations: [] };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin: any = supabaseAdmin;

    const [{ data: associates }, { data: hostLinks }, { data: rooms }, { data: locations }] = await Promise.all([
      admin
        .from("clinic_associates")
        .select("*")
        .eq("clinic_profile_id", prof.id)
        .order("created_at", { ascending: false }),
      admin
        .from("clinic_associates")
        .select("*")
        .or(`associate_profile_id.eq.${prof.id},invited_email.eq.${(prof.email ?? "").toLowerCase()}`)
        .neq("clinic_profile_id", prof.id),
      admin.from("rental_rooms").select("id, name, location_id, quantity").eq("profile_id", prof.id).eq("active", true),
      admin.from("locations").select("id, name").eq("profile_id", prof.id),
    ]);

    // Decorate with the associate's own booking link where they've joined.
    const ids = (associates ?? []).map((a: any) => a.associate_profile_id).filter(Boolean);
    let byId: Record<string, { slug: string; name: string | null }> = {};
    if (ids.length) {
      const { data: profs } = await admin.from("profiles").select("id, slug, clinic_name, full_name").in("id", ids);
      byId = Object.fromEntries(
        (profs ?? []).map((p: any) => [p.id, { slug: p.slug, name: p.clinic_name || p.full_name }]),
      );
    }

    const hostIds = (hostLinks ?? []).map((h: any) => h.clinic_profile_id);
    let hostsById: Record<string, { slug: string; name: string | null }> = {};
    if (hostIds.length) {
      const { data: hp } = await admin.from("profiles").select("id, slug, clinic_name, full_name").in("id", hostIds);
      hostsById = Object.fromEntries((hp ?? []).map((p: any) => [p.id, { slug: p.slug, name: p.clinic_name || p.full_name }]));
    }

    return {
      enabled: !!prof.associates_enabled,
      profileId: prof.id,
      profileEmail: prof.email ?? null,
      associates: (associates ?? []).map((a: any) => ({
        ...a,
        associate_slug: a.associate_profile_id ? byId[a.associate_profile_id]?.slug ?? null : null,
        associate_name: a.associate_profile_id ? byId[a.associate_profile_id]?.name ?? null : null,
      })) as AssociateRow[],
      hostLinks: (hostLinks ?? []).map((h: any) => ({
        ...h,
        clinic_slug: hostsById[h.clinic_profile_id]?.slug ?? null,
        clinic_name: hostsById[h.clinic_profile_id]?.name ?? null,
      })),
      rooms: (rooms ?? []) as { id: string; name: string; location_id: string | null; quantity: number }[],
      locations: (locations ?? []) as { id: string; name: string }[],
    };
  });

export const inviteAssociate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { name: string; email: string; notes?: string | null }) => d)
  .handler(async ({ data, context }) => {
    const prof = await getProfile(context.supabase, context.userId);
    if (!prof) throw new Error("Profile not found");
    if (!prof.associates_enabled) throw new Error("Associates are not enabled for this clinic");
    const email = data.email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Enter a valid email address");
    if (!data.name.trim()) throw new Error("Enter their name");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin: any = supabaseAdmin;

    // If they already have a MODO account, link it straight away.
    const { data: existingProfile } = await admin
      .from("profiles")
      .select("id")
      .ilike("email", email)
      .maybeSingle();

    const { data: row, error } = await admin
      .from("clinic_associates")
      .upsert(
        {
          clinic_profile_id: prof.id,
          invited_email: email,
          invited_name: data.name.trim(),
          associate_profile_id: existingProfile?.id ?? null,
          status: "invited",
          invite_expires_at: new Date(Date.now() + 14 * 24 * 3600 * 1000).toISOString(),
          notes: data.notes?.trim() || null,
        },
        { onConflict: "clinic_profile_id,invited_email" },
      )
      .select("*")
      .maybeSingle();
    if (error) throw new Error(error.message);

    try {
      const { tryEnqueueAppEmail, getPractitionerBranding } = await import("@/lib/email/send.server");
      const branding = await getPractitionerBranding(prof.id);
      const clinic = prof.clinic_name || prof.full_name || branding.clinicName || "a MODO clinic";
      const origin = process.env['PUBLIC_APP_URL'] || process.env['APP_URL'] || "https://modobook.uk";
      await tryEnqueueAppEmail({
        templateName: "staff-invite",
        recipientEmail: email,
        messageId: `associate-invite-${row?.id}`,
        templateData: {
          inviteeName: data.name.trim().split(" ")[0] || "there",
          clinicName: clinic,
          role: "Self-employed associate practitioner",
          acceptUrl: `${origin}/dashboard/associates`,
          logoUrl: branding.logoUrl,
          brandColor: branding.brandColor,
        },
      });
    } catch (e) {
      console.error("[associates] invite email failed", e);

    }

    return row;
  });

export const updateAssociate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      id: string;
      patch: Partial<{
        invited_name: string;
        status: AssociateStatus;
        oversight_records: boolean;
        oversight_appointments: boolean;
        oversight_incidents: boolean;
        room_allocation_enabled: boolean;
        room_id: string | null;
        location_id: string | null;
        block_when_no_room: boolean;
        charge_room_rent: boolean;
        seat_sponsored: boolean;
        notes: string | null;
      }>;
    }) => d,
  )
  .handler(async ({ data, context }) => {
    const prof = await getProfile(context.supabase, context.userId);
    if (!prof) throw new Error("Profile not found");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin as any)
      .from("clinic_associates")
      .update(data.patch)
      .eq("id", data.id)
      .eq("clinic_profile_id", prof.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const removeAssociate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    const prof = await getProfile(context.supabase, context.userId);
    if (!prof) throw new Error("Profile not found");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin as any)
      .from("clinic_associates")
      .delete()
      .eq("id", data.id)
      .eq("clinic_profile_id", prof.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Associate side: accept or decline a host clinic's oversight link. */
export const respondToAssociateInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; accept: boolean }) => d)
  .handler(async ({ data, context }) => {
    const prof = await getProfile(context.supabase, context.userId);
    if (!prof) throw new Error("Profile not found");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin: any = supabaseAdmin;
    const { data: link } = await admin.from("clinic_associates").select("*").eq("id", data.id).maybeSingle();
    if (!link) throw new Error("Invite not found");
    const mine =
      link.associate_profile_id === prof.id ||
      (prof.email && link.invited_email?.toLowerCase() === prof.email.toLowerCase());
    if (!mine) throw new Error("This invite is not for you");

    const { error } = await admin
      .from("clinic_associates")
      .update({
        associate_profile_id: prof.id,
        status: data.accept ? "active" : "declined",
        accepted_at: data.accept ? new Date().toISOString() : null,
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Oversight: the associate's appointments (clinic-visible for audit). */
export const getAssociateOversight = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; from?: string | null; to?: string | null }) => d)
  .handler(async ({ data, context }) => {
    const prof = await getProfile(context.supabase, context.userId);
    if (!prof) throw new Error("Profile not found");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin: any = supabaseAdmin;

    const { data: link } = await admin
      .from("clinic_associates")
      .select("*")
      .eq("id", data.id)
      .eq("clinic_profile_id", prof.id)
      .maybeSingle();
    if (!link || !link.associate_profile_id || link.status !== "active") {
      return { appointments: [], incidents: [], patients: 0, roomBookings: [] };
    }

    const from = data.from ?? new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10);
    const to = data.to ?? new Date(Date.now() + 60 * 86400000).toISOString().slice(0, 10);

    const appointments = link.oversight_appointments
      ? (
          await admin
            .from("appointments")
            .select("id, scheduled_date, start_time, end_time, patient_name, status, treatments(name)")
            .eq("profile_id", link.associate_profile_id)
            .gte("scheduled_date", from)
            .lte("scheduled_date", to)
            .order("scheduled_date", { ascending: false })
            .limit(300)
        ).data ?? []
      : [];

    const incidents = link.oversight_incidents
      ? (await admin.from("associate_incidents").select("*").eq("link_id", link.id).order("occurred_at", { ascending: false })).data ?? []
      : [];

    const patients = link.oversight_records
      ? (await admin.from("clinic_clients").select("id", { count: "exact", head: true }).eq("profile_id", link.associate_profile_id)).count ?? 0
      : 0;

    const roomBookings =
      (
        await admin
          .from("rental_bookings")
          .select("id, booking_date, start_time, end_time, unit_index, status, price, payment_status")
          .eq("associate_profile_id", link.associate_profile_id)
          .eq("profile_id", prof.id)
          .gte("booking_date", from)
          .order("booking_date", { ascending: false })
          .limit(200)
      ).data ?? [];

    return { appointments, incidents, patients, roomBookings };
  });

/** Clinical records for one of the associate's patients, read-only for audit. */
export const getAssociatePatients = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; search?: string | null }) => d)
  .handler(async ({ data, context }) => {
    const prof = await getProfile(context.supabase, context.userId);
    if (!prof) throw new Error("Profile not found");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin: any = supabaseAdmin;
    const { data: link } = await admin
      .from("clinic_associates")
      .select("id, associate_profile_id, status, oversight_records")
      .eq("id", data.id)
      .eq("clinic_profile_id", prof.id)
      .maybeSingle();
    if (!link?.oversight_records || link.status !== "active" || !link.associate_profile_id) return [];

    let q = admin
      .from("clinic_clients")
      .select("id, first_name, last_name, email, phone, created_at")
      .eq("profile_id", link.associate_profile_id)
      .order("created_at", { ascending: false })
      .limit(200);
    if (data.search?.trim()) {
      const s = `%${data.search.trim()}%`;
      q = q.or(`first_name.ilike.${s},last_name.ilike.${s},email.ilike.${s}`);
    }
    const { data: rows } = await q;
    return rows ?? [];
  });

export const getAssociatePatientRecord = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; clientId: string }) => d)
  .handler(async ({ data, context }) => {
    const prof = await getProfile(context.supabase, context.userId);
    if (!prof) throw new Error("Profile not found");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin: any = supabaseAdmin;
    const { data: link } = await admin
      .from("clinic_associates")
      .select("id, associate_profile_id, status, oversight_records")
      .eq("id", data.id)
      .eq("clinic_profile_id", prof.id)
      .maybeSingle();
    if (!link?.oversight_records || link.status !== "active") throw new Error("Not permitted");

    const [{ data: client }, { data: notes }, { data: appts }, { data: consents }] = await Promise.all([
      admin.from("clinic_clients").select("*").eq("id", data.clientId).eq("profile_id", link.associate_profile_id).maybeSingle(),
      admin.from("client_notes").select("id, note, created_at").eq("client_id", data.clientId).order("created_at", { ascending: false }).limit(100),
      admin
        .from("appointments")
        .select("id, scheduled_date, start_time, status, patient_name, notes, treatments(name)")
        .eq("profile_id", link.associate_profile_id)
        .eq("client_id", data.clientId)
        .order("scheduled_date", { ascending: false })
        .limit(100),
      admin
        .from("appointment_consents")
        .select("id, signed_at, consent_templates(name)")
        .eq("client_id", data.clientId)
        .limit(100),
    ]);
    if (!client) throw new Error("Patient not found");

    // Audit trail: record that the host clinic viewed this record.
    try {
      await admin.rpc("record_phi_access", {
        p_client_id: data.clientId,
        p_reason: "associate_oversight",
      });
    } catch {
      /* logging is best-effort */
    }

    return { client, notes: notes ?? [], appointments: appts ?? [], consents: consents ?? [] };
  });

export const saveAssociateIncident = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      id?: string | null;
      link_id: string;
      occurred_at: string;
      severity: string;
      title: string;
      description?: string | null;
      action_taken?: string | null;
      resolved: boolean;
    }) => d,
  )
  .handler(async ({ data, context }) => {
    const prof = await getProfile(context.supabase, context.userId);
    if (!prof) throw new Error("Profile not found");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin: any = supabaseAdmin;
    const { data: link } = await admin.from("clinic_associates").select("*").eq("id", data.link_id).maybeSingle();
    if (!link) throw new Error("Link not found");
    const allowed = link.clinic_profile_id === prof.id || link.associate_profile_id === prof.id;
    if (!allowed) throw new Error("Not permitted");

    const payload = {
      link_id: link.id,
      clinic_profile_id: link.clinic_profile_id,
      associate_profile_id: link.associate_profile_id,
      occurred_at: data.occurred_at,
      severity: data.severity,
      title: data.title.trim(),
      description: data.description?.trim() || null,
      action_taken: data.action_taken?.trim() || null,
      resolved_at: data.resolved ? new Date().toISOString() : null,
      created_by: context.userId,
    };
    if (data.id) {
      const { error } = await admin.from("associate_incidents").update(payload).eq("id", data.id);
      if (error) throw new Error(error.message);
      return { ok: true, id: data.id };
    }
    const { data: row, error } = await admin.from("associate_incidents").insert(payload).select("id").maybeSingle();
    if (error) throw new Error(error.message);
    return { ok: true, id: row?.id as string };
  });

/** Associate side: incidents they've logged for a host clinic. */
export const listMyIncidents = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { link_id: string }) => d)
  .handler(async ({ data, context }) => {
    const prof = await getProfile(context.supabase, context.userId);
    if (!prof) return [];
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin: any = supabaseAdmin;
    const { data: link } = await admin.from("clinic_associates").select("*").eq("id", data.link_id).maybeSingle();
    if (!link || (link.associate_profile_id !== prof.id && link.clinic_profile_id !== prof.id)) return [];
    const { data: rows } = await admin
      .from("associate_incidents")
      .select("*")
      .eq("link_id", link.id)
      .order("occurred_at", { ascending: false });
    return rows ?? [];
  });
