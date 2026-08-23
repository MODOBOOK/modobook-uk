import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function __activeProfileId(supabase: any, userId: string) {
  const { activeProfileId } = await import("./clinic-context.server");
  return (await activeProfileId(supabase, userId)) ?? "00000000-0000-0000-0000-000000000000";
}

async function getProfileId(supabase: any, userId: string) {
  const { data } = await supabase.from("profiles").select("id").eq("id", await __activeProfileId(supabase, userId)).maybeSingle();
  return data?.id ?? null;
}

async function assertOwnClient(supabase: any, clientId: string, profileId: string) {
  const { data, error } = await supabase
    .from("clinic_clients").select("id, profile_id").eq("id", clientId).maybeSingle();
  if (error) throw error;
  if (!data || data.profile_id !== profileId) throw new Error("Not found");
  return true;
}

// ---------- Timeline ----------

export type TimelineEvent = {
  id: string;
  kind: "appointment" | "consultation" | "note" | "consent" | "medical_form" | "prescription" | "payment" | "communication" | "manual" | "file" | "review";
  title: string;
  description?: string | null;
  occurred_at: string;
  meta?: Record<string, any>;
  link?: { to: string; params?: Record<string, string> };
};

export const getPatientTimeline = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { clientId: string }) => input)
  .handler(async ({ data, context }): Promise<TimelineEvent[]> => {
    const profileId = await getProfileId(context.supabase, context.userId);
    if (!profileId) return [];
    await assertOwnClient(context.supabase, data.clientId, profileId);

    const { data: client } = await context.supabase
      .from("clinic_clients").select("full_name, email").eq("id", data.clientId).maybeSingle();
    if (!client) return [];

    const events: TimelineEvent[] = [];

    // Appointments (match by email/name — appointments has no client_id fk)
    const orParts = [
      client.email ? `patient_email.eq.${client.email}` : null,
      `patient_name.eq.${client.full_name}`,
    ].filter(Boolean).join(",");
    const { data: appts } = await context.supabase
      .from("appointments").select("id, scheduled_date, start_time, end_time, status, treatment_name_snapshot, total_amount")
      .or(orParts)
      .eq("profile_id", profileId)
      .order("scheduled_date", { ascending: false })
      .limit(200);
    for (const a of (appts as any[]) ?? []) {
      const dt = new Date(`${a.scheduled_date}T${a.start_time || "00:00"}`);
      events.push({
        id: `appt:${a.id}`,
        kind: "appointment",
        title: a.treatment_name_snapshot || "Appointment",
        description: a.status,
        occurred_at: isNaN(dt.getTime()) ? new Date().toISOString() : dt.toISOString(),
        meta: {
          status: a.status,
          total_amount: a.total_amount,
          appointment_id: a.id,
          scheduled_date: a.scheduled_date,
          start_time: a.start_time,
          end_time: a.end_time,
        },
      });
    }


    // Consultations
    const { data: consults } = await context.supabase
      .from("consultations").select("id, created_at, status, current_step, patient_email, patient_name")
      .or(orParts)
      .eq("profile_id", profileId)
      .order("created_at", { ascending: false })
      .limit(50);
    for (const c of (consults as any[]) ?? []) {
      events.push({
        id: `consult:${c.id}`,
        kind: "consultation",
        title: "Consultation",
        description: c.status,
        occurred_at: c.created_at,
        link: { to: "/dashboard/consultations/$id", params: { id: c.id } },
      });
    }

    // Notes
    const { data: notes } = await context.supabase
      .from("client_notes").select("id, body, created_at, visible_to_patient")
      .eq("client_id", data.clientId).order("created_at", { ascending: false }).limit(100);
    for (const n of (notes as any[]) ?? []) {
      events.push({
        id: `note:${n.id}`,
        kind: "note",
        title: "Practitioner note",
        description: n.body,
        occurred_at: n.created_at,
        meta: { shared: n.visible_to_patient },
      });
    }

    // Consents
    const { data: consents } = await context.supabase
      .from("appointment_consents").select("id, signed_at, status, created_at")
      .eq("client_id", data.clientId).order("created_at", { ascending: false }).limit(100);
    for (const c of (consents as any[]) ?? []) {
      events.push({
        id: `consent:${c.id}`,
        kind: "consent",
        title: "Consent form",
        description: c.status,
        occurred_at: c.signed_at || c.created_at,
      });
    }

    // Medical forms
    const { data: forms } = await context.supabase
      .from("appointment_medical_forms").select("id, status, created_at, submitted_at")
      .eq("client_id", data.clientId).order("created_at", { ascending: false }).limit(100);
    for (const f of (forms as any[]) ?? []) {
      events.push({
        id: `form:${f.id}`,
        kind: "medical_form",
        title: "Medical form",
        description: f.status,
        occurred_at: f.submitted_at || f.created_at,
      });
    }

    // Prescriptions
    const { data: rx } = await context.supabase
      .from("client_prescriptions").select("id, product, created_at, prescribed_on")
      .eq("client_id", data.clientId).order("created_at", { ascending: false }).limit(100);
    for (const r of (rx as any[]) ?? []) {
      events.push({
        id: `rx:${r.id}`,
        kind: "prescription",
        title: r.product || "Prescription",
        occurred_at: r.prescribed_on || r.created_at,
      });
    }

    // Communications
    const { data: comms } = await context.supabase
      .from("client_communications").select("id, channel, subject, body, created_at, direction")
      .eq("client_id", data.clientId).order("created_at", { ascending: false }).limit(100);
    for (const c of (comms as any[]) ?? []) {
      events.push({
        id: `comm:${c.id}`,
        kind: "communication",
        title: `${c.direction === "in" ? "Received" : "Sent"} ${c.channel}${c.subject ? `: ${c.subject}` : ""}`,
        description: c.body,
        occurred_at: c.created_at,
      });
    }

    // Files
    const { data: files } = await context.supabase
      .from("client_files").select("id, kind, filename, created_at")
      .eq("client_id", data.clientId).order("created_at", { ascending: false }).limit(100);
    for (const f of (files as any[]) ?? []) {
      events.push({
        id: `file:${f.id}`,
        kind: "file",
        title: f.filename || `${f.kind} uploaded`,
        occurred_at: f.created_at,
        meta: { kind: f.kind },
      });
    }


    // Manual timeline events
    const { data: manual } = await context.supabase
      .from("patient_timeline_manual_events").select("id, title, body, kind, occurred_at, shared_with_patient")
      .eq("client_id", data.clientId).order("occurred_at", { ascending: false }).limit(100);
    for (const m of manual ?? []) {
      events.push({
        id: `manual:${m.id}`,
        kind: "manual",
        title: m.title,
        description: m.body,
        occurred_at: m.occurred_at,
        meta: { shared: m.shared_with_patient, kind: m.kind },
      });
    }

    events.sort((a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime());
    return events;
  });

// ---------- Manual events ----------

export const addManualEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { clientId: string; title: string; body?: string; occurred_at?: string; kind?: string; shared_with_patient?: boolean }) => input)
  .handler(async ({ data, context }) => {
    const profileId = await getProfileId(context.supabase, context.userId);
    if (!profileId) throw new Error("No profile");
    await assertOwnClient(context.supabase, data.clientId, profileId);
    const { error } = await context.supabase.from("patient_timeline_manual_events").insert({
      client_id: data.clientId,
      profile_id: profileId,
      title: data.title,
      body: data.body ?? null,
      kind: data.kind ?? "note",
      occurred_at: data.occurred_at ?? new Date().toISOString(),
      shared_with_patient: data.shared_with_patient ?? false,
    });
    if (error) throw error;
    return { ok: true };
  });

export const deleteManualEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data, context }) => {
    const profileId = await getProfileId(context.supabase, context.userId);
    if (!profileId) throw new Error("No profile");
    const { error } = await context.supabase
      .from("patient_timeline_manual_events").delete().eq("id", data.id).eq("profile_id", profileId);
    if (error) throw error;
    return { ok: true };
  });

// ---------- Medications ----------

export type Medication = {
  id: string; drug: string; dose?: string | null; route?: string | null;
  frequency?: string | null; prescriber?: string | null;
  started_on?: string | null; stopped_on?: string | null;
  is_current: boolean; notes?: string | null;
};

export const listMedications = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { clientId: string }) => input)
  .handler(async ({ data, context }): Promise<Medication[]> => {
    const profileId = await getProfileId(context.supabase, context.userId);
    if (!profileId) return [];
    await assertOwnClient(context.supabase, data.clientId, profileId);
    const { data: rows, error } = await context.supabase
      .from("client_medications").select("*").eq("client_id", data.clientId)
      .order("is_current", { ascending: false }).order("started_on", { ascending: false, nullsFirst: false });
    if (error) throw error;
    return rows ?? [];
  });

export const upsertMedication = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: {
    id?: string; clientId: string; drug: string;
    dose?: string | null; route?: string | null; frequency?: string | null;
    prescriber?: string | null; started_on?: string | null; stopped_on?: string | null;
    is_current?: boolean; notes?: string | null;
  }) => input)
  .handler(async ({ data, context }) => {
    const profileId = await getProfileId(context.supabase, context.userId);
    if (!profileId) throw new Error("No profile");
    await assertOwnClient(context.supabase, data.clientId, profileId);
    const payload = {
      client_id: data.clientId,
      profile_id: profileId,
      drug: data.drug,
      dose: data.dose ?? null,
      route: data.route ?? null,
      frequency: data.frequency ?? null,
      prescriber: data.prescriber ?? null,
      started_on: data.started_on ?? null,
      stopped_on: data.stopped_on ?? null,
      is_current: data.is_current ?? true,
      notes: data.notes ?? null,
    };
    if (data.id) {
      const { error } = await context.supabase.from("client_medications").update(payload).eq("id", data.id).eq("profile_id", profileId);
      if (error) throw error;
      return { ok: true, id: data.id };
    }
    const { data: row, error } = await context.supabase.from("client_medications").insert(payload).select("id").single();
    if (error) throw error;
    return { ok: true, id: row.id };
  });

export const deleteMedication = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data, context }) => {
    const profileId = await getProfileId(context.supabase, context.userId);
    if (!profileId) throw new Error("No profile");
    const { error } = await context.supabase.from("client_medications").delete().eq("id", data.id).eq("profile_id", profileId);
    if (error) throw error;
    return { ok: true };
  });

// ---------- AI Brief ----------

export const getLatestBrief = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { clientId: string }) => input)
  .handler(async ({ data, context }) => {
    const profileId = await getProfileId(context.supabase, context.userId);
    if (!profileId) return null;
    await assertOwnClient(context.supabase, data.clientId, profileId);
    const { data: row } = await context.supabase
      .from("patient_ai_briefs").select("*")
      .eq("client_id", data.clientId).order("generated_at", { ascending: false }).limit(1).maybeSingle();
    return row ?? null;
  });

export const generatePatientBrief = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { clientId: string }) => input)
  .handler(async ({ data, context }) => {
    const profileId = await getProfileId(context.supabase, context.userId);
    if (!profileId) throw new Error("No profile");
    await assertOwnClient(context.supabase, data.clientId, profileId);

    const { data: client } = await context.supabase
      .from("clinic_clients").select("full_name, email, dob, gender, has_allergies, allergies, notes, safeguarding_flag, safeguarding_note")
      .eq("id", data.clientId).maybeSingle();

    const orParts = [
      client?.email ? `patient_email.eq.${client.email}` : null,
      client?.full_name ? `patient_name.eq.${client.full_name}` : null,
    ].filter(Boolean).join(",");
    const { data: recentAppts } = orParts
      ? await context.supabase
          .from("appointments").select("scheduled_date, treatment_name_snapshot, status, notes")
          .or(orParts).eq("profile_id", profileId)
          .order("scheduled_date", { ascending: false }).limit(10)
      : { data: [] as any[] };

    const { data: meds } = await context.supabase
      .from("client_medications").select("drug, dose, is_current").eq("client_id", data.clientId).limit(20);

    const { data: notesRows } = await context.supabase
      .from("client_notes").select("body, created_at").eq("client_id", data.clientId)
      .order("created_at", { ascending: false }).limit(10);


    const context_summary = {
      client,
      recent_appointments: recentAppts,
      medications: meds,
      recent_notes: notesRows,
    };

    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("AI is not configured");

    const prompt = `You are an aesthetics clinical assistant. Produce a concise pre-appointment brief for the practitioner in JSON with keys: "summary" (2-3 sentence overview), "highlights" (array of important flags: allergies, safeguarding, recent adverse reactions), "recent_history" (array of short bullet strings of the last 3-5 relevant events), and "suggested_focus" (array of 2-4 short bullets suggesting things to discuss next visit). Keep clinical and factual — no marketing tone. Data: ${JSON.stringify(context_summary)}`;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": apiKey,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
      }),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`AI brief failed (${res.status}): ${text.slice(0, 200)}`);
    }
    const json = await res.json();
    let brief: any = {};
    try { brief = JSON.parse(json.choices?.[0]?.message?.content ?? "{}"); } catch { brief = { summary: json.choices?.[0]?.message?.content ?? "" }; }

    const { data: saved, error } = await context.supabase.from("patient_ai_briefs").insert({
      client_id: data.clientId,
      profile_id: profileId,
      brief,
    }).select("*").single();
    if (error) throw error;
    return saved;
  });
