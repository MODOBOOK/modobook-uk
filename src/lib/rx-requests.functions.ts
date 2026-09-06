import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export type RxStatus =
  | "pending"
  | "awaiting_info"
  | "approved"
  | "declined"
  | "withdrawn";

// ---------- List linked partners (role-filtered) ----------
export const listLinkedPartners = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { kind: "prescriber" | "practitioner" }) => d)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: links } = await supabase
      .from("hub_links")
      .select("id, requester_user_id, recipient_user_id, status")
      .eq("status", "accepted")
      .or(`requester_user_id.eq.${userId},recipient_user_id.eq.${userId}`);
    const otherIds = Array.from(
      new Set(
        (links ?? []).map((l) =>
          l.requester_user_id === userId ? l.recipient_user_id : l.requester_user_id,
        ),
      ),
    );
    if (otherIds.length === 0) return [];
    const { data: codes } = await supabase.rpc("get_linked_hub_codes", {
      p_user_ids: otherIds,
    });
    const filtered = (codes ?? []).filter((c) => c.owner_kind === data.kind);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const ids = filtered.map((c) => c.user_id);
    const [{ data: profs }, { data: prescs }] = await Promise.all([
      supabaseAdmin
        .from("profiles")
        .select("user_id, full_name, clinic_name")
        .in("user_id", ids),
      supabaseAdmin
        .from("prescriber_profiles")
        .select("user_id, full_name")
        .in("user_id", ids),
    ]);
    const nameMap = new Map<string, string>();
    for (const p of profs ?? []) {
      const nm = (p.clinic_name?.trim() || p.full_name?.trim()) ?? "";
      if (nm) nameMap.set(p.user_id, nm);
    }
    for (const p of prescs ?? []) {
      if (!nameMap.has(p.user_id) && p.full_name?.trim()) {
        nameMap.set(p.user_id, p.full_name.trim());
      }
    }
    return filtered.map((c) => ({
      user_id: c.user_id,
      code: c.code,
      display_name: c.display_name?.trim() || nameMap.get(c.user_id) || "Unnamed",
    }));
  });

// ---------- Create a prescription request ----------
const createSchema = z.object({
  prescriber_id: z.string().uuid(),
  patient_id: z.string().uuid().nullable().optional(),
  consultation_id: z.string().uuid().nullable().optional(),
  appointment_id: z.string().uuid().nullable().optional(),
  consent_id: z.string().uuid().nullable().optional(),
  treatment_name: z.string().min(1).max(200),
  product_name: z.string().max(200).nullable().optional(),
  dose: z.string().max(120).nullable().optional(),
  units: z.string().max(60).nullable().optional(),
  area: z.string().max(120).nullable().optional(),
  batch_number: z.string().max(120).nullable().optional(),
  clinical_notes: z.string().max(4000).nullable().optional(),
  patient_snapshot: z.record(z.any()).optional(),
  medical_history: z.record(z.any()).optional(),
});

export const createRxRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: z.infer<typeof createSchema>) => createSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("prescription_requests")
      .insert({
        practitioner_id: userId,
        prescriber_id: data.prescriber_id,
        patient_id: data.patient_id ?? null,
        consultation_id: data.consultation_id ?? null,
        appointment_id: data.appointment_id ?? null,
        consent_id: data.consent_id ?? null,
        treatment_name: data.treatment_name,
        product_name: data.product_name ?? null,
        dose: data.dose ?? null,
        units: data.units ?? null,
        area: data.area ?? null,
        batch_number: data.batch_number ?? null,
        clinical_notes: data.clinical_notes ?? null,
        patient_snapshot: data.patient_snapshot ?? {},
        medical_history: data.medical_history ?? {},
      })
      .select("id")
      .single();
    if (error) throw error;
    return { id: row.id };
  });

// ---------- List requests ----------
export const listMyRxRequests = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { role: "prescriber" | "practitioner"; status?: RxStatus | "all" }) => d)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    let q = supabase
      .from("prescription_requests")
      .select(
        "id, practitioner_id, prescriber_id, treatment_name, product_name, area, status, created_at, decided_at, first_response_at, patient_snapshot",
      )
      .order("created_at", { ascending: false })
      .limit(200);
    q =
      data.role === "prescriber"
        ? q.eq("prescriber_id", userId)
        : q.eq("practitioner_id", userId);
    if (data.status && data.status !== "all") q = q.eq("status", data.status);
    const { data: rows, error } = await q;
    if (error) throw error;

    // partner display names
    const otherIds = Array.from(
      new Set(
        (rows ?? []).map((r) =>
          data.role === "prescriber" ? r.practitioner_id : r.prescriber_id,
        ),
      ),
    );
    const nameMap = new Map<string, string>();
    if (otherIds.length) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const [{ data: profs }, { data: prescs }] = await Promise.all([
        supabaseAdmin.from("profiles").select("user_id, full_name, clinic_name").in("user_id", otherIds),
        supabaseAdmin.from("prescriber_profiles").select("user_id, full_name").in("user_id", otherIds),
      ]);
      for (const p of profs ?? []) {
        const nm = (p.clinic_name?.trim() || p.full_name?.trim()) ?? "";
        if (nm) nameMap.set(p.user_id, nm);
      }
      for (const p of prescs ?? []) {
        if (!nameMap.has(p.user_id) && p.full_name?.trim()) nameMap.set(p.user_id, p.full_name.trim());
      }
    }
    return (rows ?? []).map((r) => ({
      ...r,
      partner_name:
        nameMap.get(data.role === "prescriber" ? r.practitioner_id : r.prescriber_id) ?? "Unknown",
    }));
  });

// ---------- Get one request (with events, attachments, thread) ----------
export const getRxRequest = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: req, error } = await supabase
      .from("prescription_requests")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw error;
    if (!req) throw new Error("Request not found");

    const [{ data: events }, { data: attachments }, { data: thread }] = await Promise.all([
      supabase
        .from("prescription_request_events")
        .select("*")
        .eq("request_id", data.id)
        .order("created_at", { ascending: true }),
      supabase
        .from("prescription_request_attachments")
        .select("*")
        .eq("request_id", data.id)
        .order("created_at", { ascending: true }),
      supabase
        .from("rx_chat_threads")
        .select("*")
        .eq("request_id", data.id)
        .maybeSingle(),
    ]);

    // signed URLs for attachments
    const withUrls = await Promise.all(
      (attachments ?? []).map(async (a) => {
        const { data: signed } = await supabase.storage
          .from("rx-request-media")
          .createSignedUrl(a.storage_path, 3600);
        return { ...a, url: signed?.signedUrl ?? null };
      }),
    );

    // partner name
    const otherId = req.practitioner_id === userId ? req.prescriber_id : req.practitioner_id;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data: prof }, { data: presc }] = await Promise.all([
      supabaseAdmin.from("profiles").select("full_name, clinic_name").eq("user_id", otherId).maybeSingle(),
      supabaseAdmin.from("prescriber_profiles").select("full_name").eq("user_id", otherId).maybeSingle(),
    ]);
    const partner_name =
      prof?.clinic_name?.trim() || prof?.full_name?.trim() || presc?.full_name?.trim() || "Unknown";

    return {
      request: req,
      events: events ?? [],
      attachments: withUrls,
      thread,
      partner_name,
      viewer_role: req.prescriber_id === userId ? ("prescriber" as const) : ("practitioner" as const),
    };
  });

// ---------- Prescriber decisions ----------
const decisionSchema = z.object({
  id: z.string().uuid(),
  action: z.enum(["approve", "decline", "request_info", "withdraw", "comment"]),
  note: z.string().max(4000).optional(),
});

export const decideRxRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: z.infer<typeof decisionSchema>) => decisionSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: req, error: rerr } = await supabase
      .from("prescription_requests")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (rerr) throw rerr;
    if (!req) throw new Error("Not found");

    const isPrescriber = req.prescriber_id === userId;
    const isPractitioner = req.practitioner_id === userId;
    if (!isPrescriber && !isPractitioner) throw new Error("Forbidden");

    const now = new Date().toISOString();
    const updates: Record<string, unknown> = {};
    let eventKind: string = "commented";
    let summary = data.note ?? "";

    if (data.action === "approve") {
      if (!isPrescriber) throw new Error("Only prescriber can approve");
      updates.status = "approved";
      updates.decided_at = now;
      if (!req.first_response_at) updates.first_response_at = now;
      if (data.note) updates.prescriber_comments = data.note;
      eventKind = "approved";
      summary = data.note || "Prescription approved";
    } else if (data.action === "decline") {
      if (!isPrescriber) throw new Error("Only prescriber can decline");
      updates.status = "declined";
      updates.decided_at = now;
      updates.decline_reason = data.note ?? null;
      if (!req.first_response_at) updates.first_response_at = now;
      eventKind = "declined";
      summary = data.note || "Prescription declined";
    } else if (data.action === "request_info") {
      if (!isPrescriber) throw new Error("Only prescriber can request info");
      updates.status = "awaiting_info";
      updates.info_request_note = data.note ?? null;
      if (!req.first_response_at) updates.first_response_at = now;
      eventKind = "info_requested";
      summary = data.note || "More information requested";
    } else if (data.action === "withdraw") {
      if (!isPractitioner) throw new Error("Only practitioner can withdraw");
      updates.status = "withdrawn";
      eventKind = "withdrawn";
      summary = data.note || "Request withdrawn";
    } else if (data.action === "comment") {
      if (isPractitioner && req.status === "awaiting_info") {
        updates.status = "pending";
        eventKind = "info_provided";
        summary = data.note || "Additional information provided";
      } else {
        eventKind = "commented";
        summary = data.note || "";
      }
    }

    if (Object.keys(updates).length > 0) {
      const { error: uerr } = await supabase
        .from("prescription_requests")
        .update(updates as never)
        .eq("id", data.id);
      if (uerr) throw uerr;
    }


    const { error: eerr } = await supabase.from("prescription_request_events").insert({
      request_id: data.id,
      actor_id: userId,
      actor_role: isPrescriber ? "prescriber" : "practitioner",
      kind: eventKind as never,
      summary,
    });
    if (eerr) throw eerr;

    return { ok: true, status: (updates.status as string) ?? req.status };
  });

// ---------- Quick sign-off: approve with PIN from the list ----------
export const quickApproveRxRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { id: string; pin: string }) => i)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: prof } = await supabase
      .from("prescriber_profiles")
      .select("signoff_pin_hash")
      .eq("user_id", userId)
      .maybeSingle();
    if (!prof?.signoff_pin_hash) throw new Error("Set a sign-off PIN in the Prescriber Hub first");
    const buf = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(`${userId}::${data.pin}`),
    );
    const hash = Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
    if (hash !== prof.signoff_pin_hash) throw new Error("Incorrect PIN");

    const { data: req, error: rerr } = await supabase
      .from("prescription_requests")
      .select("id, prescriber_id, status, first_response_at")
      .eq("id", data.id)
      .maybeSingle();
    if (rerr) throw rerr;
    if (!req || req.prescriber_id !== userId) throw new Error("Not found");
    if (req.status !== "pending" && req.status !== "awaiting_info") throw new Error("Already decided");

    const now = new Date().toISOString();
    const { error: uerr } = await supabase
      .from("prescription_requests")
      .update({
        status: "approved",
        decided_at: now,
        ...(req.first_response_at ? {} : { first_response_at: now }),
      } as never)
      .eq("id", data.id);
    if (uerr) throw uerr;

    await supabase.from("prescription_request_events").insert({
      request_id: data.id,
      actor_id: userId,
      actor_role: "prescriber",
      kind: "approved" as never,
      summary: "Approved via quick sign-off (PIN verified)",
    });
    return { ok: true };
  });

// ---------- Attachments ----------
export const addRxAttachment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      request_id: string;
      kind: "clinical_photo" | "before" | "after" | "consent_pdf" | "other";
      storage_path: string;
      mime_type?: string | null;
      size_bytes?: number | null;
      caption?: string | null;
    }) => d,
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: att, error } = await supabase
      .from("prescription_request_attachments")
      .insert({
        request_id: data.request_id,
        uploaded_by: userId,
        kind: data.kind,
        storage_path: data.storage_path,
        mime_type: data.mime_type ?? null,
        size_bytes: data.size_bytes ?? null,
        caption: data.caption ?? null,
      })
      .select("id")
      .single();
    if (error) throw error;
    await supabase.from("prescription_request_events").insert({
      request_id: data.request_id,
      actor_id: userId,
      kind: "attachment_added",
      summary: `Attachment added (${data.kind})`,
    });
    return { id: att.id };
  });

// ---------- Chat ----------
export const listRxMessages = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { thread_id: string }) => d)
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: msgs, error } = await supabase
      .from("rx_chat_messages")
      .select("*")
      .eq("thread_id", data.thread_id)
      .order("created_at", { ascending: true });
    if (error) throw error;

    // sign attachment paths
    const enriched = await Promise.all(
      (msgs ?? []).map(async (m) => {
        if (!m.attachment_path) return { ...m, url: null as string | null };
        const { data: signed } = await supabase.storage
          .from("rx-chat-media")
          .createSignedUrl(m.attachment_path, 3600);
        return { ...m, url: signed?.signedUrl ?? null };
      }),
    );
    return enriched;
  });

export const sendRxMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      thread_id: string;
      request_id: string;
      kind: "text" | "image" | "pdf" | "voice";
      body?: string | null;
      attachment_path?: string | null;
      attachment_mime?: string | null;
      attachment_size?: number | null;
      duration_ms?: number | null;
    }) => d,
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: msg, error } = await supabase
      .from("rx_chat_messages")
      .insert({
        thread_id: data.thread_id,
        request_id: data.request_id,
        sender_id: userId,
        kind: data.kind,
        body: data.body ?? null,
        attachment_path: data.attachment_path ?? null,
        attachment_mime: data.attachment_mime ?? null,
        attachment_size: data.attachment_size ?? null,
        duration_ms: data.duration_ms ?? null,
      })
      .select("id")
      .single();
    if (error) throw error;
    await supabase.from("prescription_request_events").insert({
      request_id: data.request_id,
      actor_id: userId,
      kind: "message_sent",
      summary: data.kind === "text" ? (data.body ?? "").slice(0, 140) : `Sent ${data.kind}`,
    });
    return { id: msg.id };
  });

export const markRxRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { thread_id: string }) => d)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    // fetch unread ids
    const { data: msgs } = await supabase
      .from("rx_chat_messages")
      .select("id, read_by, sender_id")
      .eq("thread_id", data.thread_id);
    for (const m of msgs ?? []) {
      if (m.sender_id === userId) continue;
      const arr = Array.isArray(m.read_by) ? (m.read_by as string[]) : [];
      if (arr.includes(userId)) continue;
      await supabase
        .from("rx_chat_messages")
        .update({ read_by: [...arr, userId] })
        .eq("id", m.id);
    }
    return { ok: true };
  });

// ---------- Dashboard summary ----------
export const getPrescriberDashboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const [
      { data: outstanding },
      { data: awaiting },
      { data: recent },
      linksCountRes,
      { data: responded },
    ] = await Promise.all([
      supabase
        .from("prescription_requests")
        .select("id, treatment_name, created_at, patient_snapshot")
        .eq("prescriber_id", userId)
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(10),
      supabase
        .from("prescription_requests")
        .select("id, treatment_name, updated_at")
        .eq("prescriber_id", userId)
        .eq("status", "awaiting_info")
        .order("updated_at", { ascending: false })
        .limit(10),
      supabase
        .from("prescription_requests")
        .select("id, treatment_name, decided_at, patient_snapshot")
        .eq("prescriber_id", userId)
        .eq("status", "approved")
        .order("decided_at", { ascending: false })
        .limit(10),
      supabase
        .from("hub_links")
        .select("id", { count: "exact", head: true })
        .eq("status", "accepted")
        .or(`requester_user_id.eq.${userId},recipient_user_id.eq.${userId}`),
      supabase
        .from("prescription_requests")
        .select("created_at, first_response_at")
        .eq("prescriber_id", userId)
        .not("first_response_at", "is", null)
        .gte("created_at", new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString()),
    ]);

    const avgMs =
      (responded ?? []).length === 0
        ? null
        : (responded ?? []).reduce((sum, r) => {
            const created = new Date(r.created_at).getTime();
            const first = new Date(r.first_response_at as string).getTime();
            return sum + (first - created);
          }, 0) / (responded ?? []).length;

    return {
      outstanding: outstanding ?? [],
      awaiting: awaiting ?? [],
      recent: recent ?? [],
      linkedCount: linksCountRes.count ?? 0,
      avgResponseMs: avgMs,
    };
  });

