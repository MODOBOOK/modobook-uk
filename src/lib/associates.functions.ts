import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";


/**
 * A link is "live" for oversight when the associate accepted the invite, or
 * when the clinic has linked its own profile (self-managed / testing), where
 * there is nobody else to accept.
 */
function isLinkLive(link: { status?: string | null; associate_profile_id?: string | null }, clinicProfileId: string) {
  if (link?.status === "active") return true;
  return Boolean(link?.associate_profile_id) && link.associate_profile_id === clinicProfileId;
}

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
        // A clinic can re-invite the same email after correcting details or
        // after an earlier link has gone stale. Use a fresh id so email
        // idempotency does not suppress the replacement invitation.
        messageId: `associate-invite-${row?.id}-${crypto.randomUUID()}`,
        templateData: {
          inviteeName: data.name.trim().split(" ")[0] || "there",
          clinicName: clinic,
          role: "Self-employed associate practitioner",
          acceptUrl: `${origin.replace(/\/$/, "")}/auth?next=${encodeURIComponent("/dashboard/associates")}&email=${encodeURIComponent(email)}`,
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

/** Associate side: restrict what a host clinic can see about them. */
export const updateMyHostLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      id: string;
      patch: Partial<{ oversight_records: boolean; oversight_appointments: boolean; oversight_incidents: boolean }>;
    }) => d,
  )
  .handler(async ({ data, context }) => {
    const prof = await getProfile(context.supabase, context.userId);
    if (!prof) throw new Error("Profile not found");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin: any = supabaseAdmin;
    const { data: link } = await admin.from("clinic_associates").select("*").eq("id", data.id).maybeSingle();
    if (!link) throw new Error("Link not found");
    const mine =
      link.associate_profile_id === prof.id ||
      (prof.email && link.invited_email?.toLowerCase() === prof.email.toLowerCase());
    if (!mine) throw new Error("Not permitted");

    const patch: Record<string, boolean> = {};
    for (const k of ["oversight_records", "oversight_appointments", "oversight_incidents"] as const) {
      if (typeof data.patch[k] === "boolean") patch[k] = data.patch[k] as boolean;
    }
    if (!Object.keys(patch).length) return { ok: true };
    const { error } = await admin.from("clinic_associates").update(patch).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Associate side: leave a host clinic entirely — ends all oversight. */
export const leaveHostClinic = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    const prof = await getProfile(context.supabase, context.userId);
    if (!prof) throw new Error("Profile not found");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin: any = supabaseAdmin;
    const { data: link } = await admin.from("clinic_associates").select("*").eq("id", data.id).maybeSingle();
    if (!link) throw new Error("Link not found");
    const mine =
      link.associate_profile_id === prof.id ||
      (prof.email && link.invited_email?.toLowerCase() === prof.email.toLowerCase());
    if (!mine) throw new Error("Not permitted");

    const { error } = await admin
      .from("clinic_associates")
      .update({
        status: "revoked",
        accepted_at: null,
        oversight_records: false,
        oversight_appointments: false,
        oversight_incidents: false,
        room_allocation_enabled: false,
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
    if (!link || !link.associate_profile_id || !isLinkLive(link, prof.id)) {
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
    if (!link?.oversight_records || !isLinkLive(link, prof.id) || !link.associate_profile_id) return [];

    let q = admin
      .from("clinic_clients")
      .select(
        "id, full_name, email, phone, dob, has_allergies, allergies, safeguarding_flag, no_show_count, archived, created_at, medical_form_updated_at",
      )
      .eq("profile_id", link.associate_profile_id)
      .order("created_at", { ascending: false })
      .limit(500);
    if (data.search?.trim()) {
      const s = `%${data.search.trim()}%`;
      q = q.or(`full_name.ilike.${s},email.ilike.${s},phone.ilike.${s}`);
    }
    const { data: rows } = await q;
    const list = (rows ?? []) as any[];
    if (!list.length) return [];

    // Decorate with visit counts and last/next appointment so the clinic owner
    // sees a real patient list, not just names.
    const emails = list.map((c) => (c.email ?? "").toLowerCase()).filter(Boolean);
    const stats: Record<string, { visits: number; last: string | null; next: string | null }> = {};
    if (emails.length) {
      const today = new Date().toISOString().slice(0, 10);
      const { data: appts } = await admin
        .from("appointments")
        .select("patient_email, scheduled_date, status")
        .eq("profile_id", link.associate_profile_id)
        .in("patient_email", emails)
        .limit(3000);
      for (const a of (appts ?? []) as any[]) {
        const key = (a.patient_email ?? "").toLowerCase();
        const s = (stats[key] ??= { visits: 0, last: null, next: null });
        if (a.status !== "cancelled") s.visits += 1;
        if (a.scheduled_date <= today) {
          if (!s.last || a.scheduled_date > s.last) s.last = a.scheduled_date;
        } else if (a.status !== "cancelled") {
          if (!s.next || a.scheduled_date < s.next) s.next = a.scheduled_date;
        }
      }
    }
    return list.map((c) => ({
      ...c,
      ...(stats[(c.email ?? "").toLowerCase()] ?? { visits: 0, last: null, next: null }),
    }));

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
    if (!link?.oversight_records || !isLinkLive(link, prof.id)) throw new Error("Not permitted");

    const { data: client } = await admin
      .from("clinic_clients")
      .select("*")
      .eq("id", data.clientId)
      .eq("profile_id", link.associate_profile_id)
      .maybeSingle();
    if (!client) throw new Error("Patient not found");

    const [
      { data: notes },
      { data: appts },
      { data: consents },
      { data: forms },
      { data: meds },
      { data: concerns },
      { data: files },
    ] = await Promise.all([
      admin
        .from("client_notes")
        .select("id, body, created_at")
        .eq("client_id", data.clientId)
        .order("created_at", { ascending: false })
        .limit(100),
      client.email
        ? admin
            .from("appointments")
            .select("id, scheduled_date, start_time, status, patient_name, notes, total_price, payment_status, treatments(name)")
            .eq("profile_id", link.associate_profile_id)
            .ilike("patient_email", client.email)
            .order("scheduled_date", { ascending: false })
            .limit(100)
        : Promise.resolve({ data: [] }),
      admin
        .from("appointment_consents")
        .select("id, signed_at, consent_templates(name)")
        .eq("client_id", data.clientId)
        .limit(100),
      admin
        .from("appointment_medical_forms")
        .select("id, status, submitted_at, created_at, response, medical_form_templates(name)")
        .eq("client_id", data.clientId)
        .order("created_at", { ascending: false })
        .limit(50),
      admin
        .from("client_medications")
        .select("id, drug, dose, route, frequency, prescriber, is_current, started_on, stopped_on, notes")
        .eq("client_id", data.clientId)
        .order("created_at", { ascending: false })
        .limit(100),
      admin
        .from("client_concerns")
        .select("id, label, severity, resolved, notes, created_at")
        .eq("client_id", data.clientId)
        .order("created_at", { ascending: false })
        .limit(100),
      admin
        .from("client_files")
        .select("id, kind, url, filename, created_at")
        .eq("client_id", data.clientId)
        .order("created_at", { ascending: false })
        .limit(60),
    ]);


    // Audit trail: record that the host clinic viewed this record.
    try {
      await admin.rpc("record_phi_access", {
        p_client_id: data.clientId,
        p_reason: "associate_oversight",
      });
    } catch {
      /* logging is best-effort */
    }

    return {
      client,
      notes: notes ?? [],
      appointments: appts ?? [],
      consents: consents ?? [],
      forms: forms ?? [],
      medications: meds ?? [],
      concerns: concerns ?? [],
      files: files ?? [],
    };

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

/** Every incident visible to me — as the host clinic and as an associate. */
export const listAssociateIncidentsForMe = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const prof = await getProfile(context.supabase, context.userId);
    if (!prof) return [];
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin: any = supabaseAdmin;

    const { data: rows } = await admin
      .from("associate_incidents")
      .select("*")
      .or(`clinic_profile_id.eq.${prof.id},associate_profile_id.eq.${prof.id}`)
      .order("occurred_at", { ascending: false })
      .limit(200);

    const list = rows ?? [];
    if (!list.length) return [];

    const ids = Array.from(
      new Set(list.flatMap((r: any) => [r.clinic_profile_id, r.associate_profile_id]).filter(Boolean)),
    );
    const { data: profs } = await admin.from("profiles").select("id, clinic_name, full_name").in("id", ids);
    const nameById: Record<string, string> = Object.fromEntries(
      (profs ?? []).map((p: any) => [p.id, p.clinic_name || p.full_name || "Practitioner"]),
    );

    return list.map((r: any) => ({
      ...r,
      mine: r.clinic_profile_id === prof.id,
      clinic_name: nameById[r.clinic_profile_id] ?? null,
      associate_name: r.associate_profile_id ? nameById[r.associate_profile_id] ?? null : null,
    }));
  });

/** Mark an incident resolved / re-opened. */
export const setIncidentResolved = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; resolved: boolean }) => d)
  .handler(async ({ data, context }) => {
    const prof = await getProfile(context.supabase, context.userId);
    if (!prof) throw new Error("Profile not found");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin: any = supabaseAdmin;
    const { data: row } = await admin.from("associate_incidents").select("*").eq("id", data.id).maybeSingle();
    if (!row) throw new Error("Incident not found");
    if (row.clinic_profile_id !== prof.id && row.associate_profile_id !== prof.id) throw new Error("Not permitted");
    const { error } = await admin
      .from("associate_incidents")
      .update({ resolved_at: data.resolved ? new Date().toISOString() : null })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
