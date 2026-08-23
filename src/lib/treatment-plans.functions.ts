import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function __activeProfileId(supabase: any, userId: string) {
  const { activeProfileId } = await import("./clinic-context.server");
  return (await activeProfileId(supabase, userId)) ?? "00000000-0000-0000-0000-000000000000";
}

async function getProfileId(supabase: any, userId: string) {
  const { data } = await supabase.from("profiles").select("id").eq("id", await __activeProfileId(supabase, userId)).maybeSingle();
  return data?.id as string | undefined;
}

type BookingMode = "upfront" | "rolling";
type PaymentMode = "per_session" | "course_upfront" | "deposit_then_per_session";

// =================== TEMPLATES ===================

export const listPlanTemplates = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const pid = await getProfileId(context.supabase, context.userId);
    if (!pid) return [];
    const { data, error } = await context.supabase
      .from("treatment_plan_templates")
      .select("*, items:treatment_plan_template_items(*, treatment:treatments(id,name,price,duration))")
      .eq("profile_id", pid)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data ?? [];
  });

export const upsertPlanTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    id?: string;
    name: string;
    description?: string | null;
    defaultIntervalWeeks?: number;
    bookingMode: BookingMode;
    paymentMode: PaymentMode;
    coursePriceCents?: number | null;
    depositCents?: number | null;
    isActive?: boolean;
    items: Array<{ treatmentId: string | null; sessionNumber: number; intervalWeeksFromPrevious?: number | null; notes?: string | null }>;
  }) => d)
  .handler(async ({ data, context }) => {
    const pid = await getProfileId(context.supabase, context.userId);
    if (!pid) throw new Error("No profile");
    const row = {
      id: data.id,
      profile_id: pid,
      name: data.name.trim(),
      description: data.description ?? null,
      default_interval_weeks: data.defaultIntervalWeeks ?? 4,
      booking_mode: data.bookingMode,
      payment_mode: data.paymentMode,
      course_price_cents: data.coursePriceCents ?? null,
      deposit_cents: data.depositCents ?? null,
      is_active: data.isActive ?? true,
    };
    const { data: saved, error } = await context.supabase
      .from("treatment_plan_templates")
      .upsert(row)
      .select()
      .single();
    if (error) throw error;

    // Replace items
    await context.supabase.from("treatment_plan_template_items").delete().eq("template_id", saved.id);
    if (data.items.length) {
      const items = data.items.map((it) => ({
        template_id: saved.id,
        treatment_id: it.treatmentId,
        session_number: it.sessionNumber,
        interval_weeks_from_previous: it.intervalWeeksFromPrevious ?? null,
        notes: it.notes ?? null,
      }));
      const { error: iErr } = await context.supabase.from("treatment_plan_template_items").insert(items);
      if (iErr) throw iErr;
    }
    return saved;
  });

export const deletePlanTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    const pid = await getProfileId(context.supabase, context.userId);
    if (!pid) throw new Error("No profile");
    const { error } = await context.supabase
      .from("treatment_plan_templates")
      .delete()
      .eq("id", data.id)
      .eq("profile_id", pid);
    if (error) throw error;
    return { ok: true };
  });

// =================== PLANS ===================

export const listPlansForClient = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { clientId: string }) => d)
  .handler(async ({ data, context }) => {
    const pid = await getProfileId(context.supabase, context.userId);
    if (!pid) return [];
    const { data: rows, error } = await context.supabase
      .from("treatment_plans")
      .select("*, sessions:treatment_plan_sessions(*, treatment:treatments(id,name,price,duration))")
      .eq("profile_id", pid)
      .eq("client_id", data.clientId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return rows ?? [];
  });

export const getPlan = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    const pid = await getProfileId(context.supabase, context.userId);
    if (!pid) throw new Error("No profile");
    const { data: row, error } = await context.supabase
      .from("treatment_plans")
      .select("*, sessions:treatment_plan_sessions(*, treatment:treatments(id,name,price,duration)), client:clinic_clients(id,full_name,email,phone)")
      .eq("id", data.id)
      .eq("profile_id", pid)
      .maybeSingle();
    if (error) throw error;
    return row;
  });

export const createPlanForClient = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    clientId: string;
    templateId?: string | null;
    consultationId?: string | null;
    name?: string;
  }) => d)
  .handler(async ({ data, context }) => {
    const pid = await getProfileId(context.supabase, context.userId);
    if (!pid) throw new Error("No profile");

    let planRow: any = {
      profile_id: pid,
      client_id: data.clientId,
      consultation_id: data.consultationId ?? null,
      name: data.name ?? "New treatment plan",
      booking_mode: "rolling",
      payment_mode: "per_session",
      status: "draft",
    };
    let items: Array<{ treatment_id: string | null; session_number: number; interval_weeks_from_previous: number | null; notes: string | null }> = [];

    if (data.templateId) {
      const { data: tpl } = await context.supabase
        .from("treatment_plan_templates")
        .select("*, items:treatment_plan_template_items(*)")
        .eq("id", data.templateId)
        .eq("profile_id", pid)
        .maybeSingle();
      if (tpl) {
        planRow = {
          ...planRow,
          template_id: tpl.id,
          name: data.name ?? tpl.name,
          description: tpl.description,
          booking_mode: tpl.booking_mode,
          payment_mode: tpl.payment_mode,
          course_price_cents: tpl.course_price_cents,
          deposit_cents: tpl.deposit_cents,
        };
        items = (tpl.items || [])
          .sort((a: any, b: any) => a.session_number - b.session_number)
          .map((it: any) => ({
            treatment_id: it.treatment_id,
            session_number: it.session_number,
            interval_weeks_from_previous: it.interval_weeks_from_previous,
            notes: it.notes,
          }));
      }
    }

    const { data: plan, error } = await context.supabase
      .from("treatment_plans")
      .insert(planRow)
      .select()
      .single();
    if (error) throw error;

    if (items.length) {
      const rows = items.map((it) => ({ ...it, plan_id: plan.id }));
      await context.supabase.from("treatment_plan_sessions").insert(rows);
    }
    return plan;
  });

export const updatePlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    id: string;
    name?: string;
    description?: string | null;
    bookingMode?: BookingMode;
    paymentMode?: PaymentMode;
    coursePriceCents?: number | null;
    depositCents?: number | null;
    discountCents?: number | null;
    discountPercent?: number | null;
    status?: string;
    sessions?: Array<{
      id?: string;
      treatmentId: string | null;
      sessionNumber: number;
      intervalWeeksFromPrevious?: number | null;
      suggestedDate?: string | null;
      notes?: string | null;
      priceCentsOverride?: number | null;
      expectedResults?: string | null;
      downtime?: string | null;
      sessionPurpose?: string | null;
    }>;
  }) => d)
  .handler(async ({ data, context }) => {
    const pid = await getProfileId(context.supabase, context.userId);
    if (!pid) throw new Error("No profile");

    const patch: any = {};
    if (data.name !== undefined) patch.name = data.name;
    if (data.description !== undefined) patch.description = data.description;
    if (data.bookingMode !== undefined) patch.booking_mode = data.bookingMode;
    if (data.paymentMode !== undefined) patch.payment_mode = data.paymentMode;
    if (data.coursePriceCents !== undefined) patch.course_price_cents = data.coursePriceCents;
    if (data.depositCents !== undefined) patch.deposit_cents = data.depositCents;
    if (data.discountCents !== undefined) patch.discount_cents = data.discountCents;
    if (data.discountPercent !== undefined) patch.discount_percent = data.discountPercent;
    if (data.status !== undefined) patch.status = data.status;

    if (Object.keys(patch).length) {
      const { error } = await context.supabase
        .from("treatment_plans")
        .update(patch)
        .eq("id", data.id)
        .eq("profile_id", pid);
      if (error) throw error;
    }

    if (data.sessions) {
      await context.supabase
        .from("treatment_plan_sessions")
        .delete()
        .eq("plan_id", data.id)
        .is("appointment_id", null);
      const rows = data.sessions.map((s) => ({
        plan_id: data.id,
        treatment_id: s.treatmentId,
        session_number: s.sessionNumber,
        interval_weeks_from_previous: s.intervalWeeksFromPrevious ?? null,
        suggested_date: s.suggestedDate ?? null,
        notes: s.notes ?? null,
        price_cents_override: s.priceCentsOverride ?? null,
        expected_results: s.expectedResults ?? null,
        downtime: s.downtime ?? null,
        session_purpose: s.sessionPurpose ?? null,
      }));
      if (rows.length) {
        const { error } = await context.supabase.from("treatment_plan_sessions").insert(rows);
        if (error) throw error;
      }
    }
    return { ok: true };
  });

export const sendPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    const pid = await getProfileId(context.supabase, context.userId);
    if (!pid) throw new Error("No profile");

    const { data: plan, error: planErr } = await context.supabase
      .from("treatment_plans")
      .select("id, name, description, patient_token, client:clinic_clients(full_name, email), profile:profiles(clinic_name, slug)")
      .eq("id", data.id)
      .eq("profile_id", pid)
      .maybeSingle();
    if (planErr) throw planErr;
    if (!plan) throw new Error("Plan not found");

    const clientEmail = (plan as any).client?.email as string | undefined;
    const clientName = ((plan as any).client?.full_name as string | undefined) || "there";
    const clinicName = ((plan as any).profile?.clinic_name as string | undefined) || "your clinic";
    const token = (plan as any).patient_token as string | undefined;

    const { error } = await context.supabase
      .from("treatment_plans")
      .update({ status: "sent", sent_at: new Date().toISOString() })
      .eq("id", data.id)
      .eq("profile_id", pid);
    if (error) throw error;

    let emailed = false;
    if (clientEmail && token) {
      try {
        const origin = process.env.PUBLIC_APP_URL || process.env.APP_URL || "https://modobook.uk";
        const planUrl = `${origin}/plan/${token}`;
        const { tryEnqueueAppEmail, getPractitionerBranding } = await import("@/lib/email/send.server");
        const branding = await getPractitionerBranding(pid);
        const firstName = String(clientName).split(" ")[0] || "there";
        const res = await tryEnqueueAppEmail({
          templateName: "patient-message",
          recipientEmail: clientEmail,
          messageId: `plan-sent-${data.id}-${Date.now()}`,
          templateData: {
            profileId: pid,
            subject: `Your treatment plan from ${clinicName}`,
            body: `Hi ${firstName},\n\n${clinicName} has prepared a personalised treatment plan for you: "${(plan as any).name}".\n\nTap the button below to review the sessions, pricing and next steps, and to accept the plan when you're ready.\n\nSpeak soon,\n${clinicName}`,
            clinicName,
            logoUrl: branding.logoUrl,
            brandColor: branding.brandColor,
            actions: [{ label: "View your treatment plan", url: planUrl, variant: "primary" }],
          },
        });
        emailed = !!res.ok;
      } catch (e) {
        console.error("[sendPlan] email enqueue failed", e);
      }
    }

    return { ok: true, emailed };
  });

export const cancelPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    const pid = await getProfileId(context.supabase, context.userId);
    if (!pid) throw new Error("No profile");
    const { error } = await context.supabase
      .from("treatment_plans")
      .update({ status: "cancelled" })
      .eq("id", data.id)
      .eq("profile_id", pid);
    if (error) throw error;
    return { ok: true };
  });

export const deletePlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    const pid = await getProfileId(context.supabase, context.userId);
    if (!pid) throw new Error("No profile");
    const { error } = await context.supabase
      .from("treatment_plans")
      .delete()
      .eq("id", data.id)
      .eq("profile_id", pid);
    if (error) throw error;
    return { ok: true };
  });

// =================== PATIENT-FACING ===================

export const listMyPlansForPractitioner = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { slug: string }) => d)
  .handler(async ({ data, context }) => {
    // Find practitioner profile by slug
    const { data: prof } = await context.supabase
      .from("profiles")
      .select("id")
      .eq("slug", data.slug)
      .maybeSingle();
    if (!prof) return [];

    // Find clinic_client rows for this user (matching by user's email/phone in profile)
    const { data: userData } = await context.supabase.auth.getUser();
    const email = userData.user?.email;
    if (!email) return [];

    const { data: client } = await context.supabase
      .from("clinic_clients")
      .select("id")
      .eq("profile_id", prof.id)
      .ilike("email", email)
      .maybeSingle();
    if (!client) return [];

    const { data: plans, error } = await context.supabase
      .from("treatment_plans")
      .select("*, sessions:treatment_plan_sessions(*, treatment:treatments(id,name,price,duration))")
      .eq("profile_id", prof.id)
      .eq("client_id", client.id)
      .neq("status", "draft")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return plans ?? [];
  });

export const acceptPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    // patient can update their own plan status via RLS SELECT + explicit update via service role? RLS lets patient SELECT but not UPDATE.
    // Use admin update after verifying identity via SELECT policy.
    const { data: plan } = await context.supabase
      .from("treatment_plans")
      .select("id, status")
      .eq("id", data.id)
      .maybeSingle();
    if (!plan) throw new Error("Plan not found");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("treatment_plans")
      .update({ status: "accepted", accepted_at: new Date().toISOString() })
      .eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

// =================== AI SUGGEST ===================

export const suggestPlanForClient = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { clientId: string; consultationId?: string | null; extraContext?: string | null }) => d)
  .handler(async ({ data, context }) => {
    const pid = await getProfileId(context.supabase, context.userId);
    if (!pid) throw new Error("No profile");

    const [{ data: client }, { data: concerns }, { data: treatments }] = await Promise.all([
      context.supabase.from("clinic_clients").select("id, full_name, notes").eq("id", data.clientId).maybeSingle(),
      context.supabase.from("client_concerns").select("label, severity, notes, resolved").eq("client_id", data.clientId).eq("resolved", false),
      context.supabase.from("treatments").select("id, name, price, duration, description").eq("profile_id", pid).eq("active", true),
    ]);
    if (!client) throw new Error("Client not found");
    let consultation: any = null;
    if (data.consultationId) {
      const { data: c } = await context.supabase
        .from("consultations")
        .select("concerns, assessment, treatment_plan, notes")
        .eq("id", data.consultationId)
        .maybeSingle();
      consultation = c;
    }

    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY not configured");

    const treatmentList = (treatments || []).map((t: any) => `- ${t.id} | ${t.name}${t.duration ? ` (${t.duration}min)` : ""}`).join("\n");
    const concernsText = (concerns || []).map((c: any) => `- ${c.label}${c.severity ? ` (severity ${c.severity})` : ""}${c.notes ? `: ${c.notes}` : ""}`).join("\n") || "(none logged)";
    const consultationText = consultation
      ? `Consultation concerns: ${JSON.stringify(consultation.concerns ?? {})}\nAssessment: ${JSON.stringify(consultation.assessment ?? {})}\nProposed plan: ${JSON.stringify(consultation.treatment_plan ?? {})}\nNotes: ${consultation.notes ?? ""}`
      : "(no consultation attached)";

    const system = `You are an aesthetics clinic practitioner planning a bespoke multi-session treatment course for one specific patient. Tailor sessions to their concerns. Only use treatments from the provided list (by id). Return ONLY valid JSON matching this shape:
{
  "name": string,
  "description": string,
  "bookingMode": "rolling" | "upfront",
  "paymentMode": "per_session" | "course_upfront" | "deposit_then_per_session",
  "sessions": [ {
    "treatmentId": string,
    "sessionNumber": number,
    "intervalWeeksFromPrevious": number,
    "notes": string,
    "sessionPurpose": string,
    "expectedResults": string,
    "downtime": string
  } ]
}
Rules: 2-8 sessions. Session 1 has intervalWeeksFromPrevious 0. Use realistic intervals for the treatments chosen. Notes should be short and patient-specific.
For every session also fill:
- sessionPurpose: 1-2 short sentences on why this session, what it targets.
- expectedResults: 1-2 short sentences of realistic outcomes the patient should notice after this session.
- downtime: brief expected downtime, side effects and aftercare guidance for this session (e.g. "Mild redness 24h, avoid sun 48h").
Keep the language warm, plain-English and patient-facing.`;

    const user = `Patient: ${client.full_name}
Active concerns:
${concernsText}

${consultationText}

Available treatments (use these ids only):
${treatmentList}

${data.extraContext ? `Additional context from practitioner: ${data.extraContext}` : ""}`;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Lovable-API-Key": apiKey },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        response_format: { type: "json_object" },
      }),
    });
    if (res.status === 402) throw new Error("AI credits exhausted. Add credits in workspace settings.");
    if (res.status === 429) throw new Error("AI rate limit hit. Try again shortly.");
    if (!res.ok) throw new Error(`AI request failed (${res.status})`);
    const body = (await res.json()) as any;
    const raw = body.choices?.[0]?.message?.content ?? "{}";
    let parsed: any;
    try { parsed = JSON.parse(raw); } catch { throw new Error("AI returned invalid JSON"); }

    const validIds = new Set((treatments || []).map((t: any) => t.id));
    const sessions = (parsed.sessions || [])
      .filter((s: any) => s.treatmentId && validIds.has(s.treatmentId))
      .map((s: any, i: number) => ({
        session_number: i + 1,
        treatment_id: s.treatmentId,
        interval_weeks_from_previous: i === 0 ? 0 : Number(s.intervalWeeksFromPrevious) || 4,
        notes: s.notes ?? null,
        session_purpose: s.sessionPurpose ?? null,
        expected_results: s.expectedResults ?? null,
        downtime: s.downtime ?? null,
      }));
    if (!sessions.length) throw new Error("AI could not build a plan. Add treatments and concerns and try again.");

    const bookingMode = parsed.bookingMode === "upfront" ? "upfront" : "rolling";
    const paymentMode = ["per_session", "course_upfront", "deposit_then_per_session"].includes(parsed.paymentMode) ? parsed.paymentMode : "per_session";

    const { data: plan, error } = await context.supabase
      .from("treatment_plans")
      .insert({
        profile_id: pid,
        client_id: data.clientId,
        consultation_id: data.consultationId ?? null,
        name: parsed.name?.trim() || "Personalised treatment plan",
        description: parsed.description ?? null,
        booking_mode: bookingMode,
        payment_mode: paymentMode,
        status: "draft",
      })
      .select()
      .single();
    if (error) throw error;

    const rows = sessions.map((s: any) => ({ ...s, plan_id: plan.id }));
    await context.supabase.from("treatment_plan_sessions").insert(rows);
    return plan;
  });

/**
 * Generate AI content for a single session (session purpose, expected results,
 * downtime) given the chosen treatment + client context. Does not persist —
 * caller applies the result to the in-progress edit.
 */
export const suggestPlanSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    clientId: string;
    treatmentId: string;
    sessionNumber: number;
    extraContext?: string | null;
  }) => d)
  .handler(async ({ data, context }) => {
    const pid = await getProfileId(context.supabase, context.userId);
    if (!pid) throw new Error("No profile");

    const [{ data: client }, { data: concerns }, { data: treatment }] = await Promise.all([
      context.supabase.from("clinic_clients").select("full_name, notes").eq("id", data.clientId).maybeSingle(),
      context.supabase.from("client_concerns").select("label, severity, notes, resolved").eq("client_id", data.clientId).eq("resolved", false),
      context.supabase.from("treatments").select("id, name, description, duration").eq("id", data.treatmentId).eq("profile_id", pid).maybeSingle(),
    ]);
    if (!client) throw new Error("Client not found");
    if (!treatment) throw new Error("Treatment not found");

    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY not configured");

    const concernsText = (concerns || [])
      .map((c: any) => `- ${c.label}${c.severity ? ` (severity ${c.severity})` : ""}${c.notes ? `: ${c.notes}` : ""}`)
      .join("\n") || "(none logged)";

    const system = `You are an aesthetics clinic practitioner writing patient-facing copy for a single session inside a bespoke treatment plan. Return ONLY valid JSON:
{
  "sessionPurpose": string,
  "expectedResults": string,
  "downtime": string,
  "notes": string
}
- sessionPurpose: 1-2 short sentences on why this session, what it targets for THIS patient.
- expectedResults: 1-2 short sentences of realistic outcomes to notice after this session.
- downtime: brief expected downtime, side effects and aftercare guidance.
- notes: short practitioner-facing note (optional, may be empty).
Warm, plain-English, patient-facing.`;

    const user = `Patient: ${client.full_name}
Session number in plan: ${data.sessionNumber}
Treatment: ${treatment.name}${treatment.duration ? ` (${treatment.duration} min)` : ""}
${treatment.description ? `Treatment info: ${treatment.description}` : ""}

Active concerns:
${concernsText}

${data.extraContext ? `Additional context: ${data.extraContext}` : ""}`;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Lovable-API-Key": apiKey },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        response_format: { type: "json_object" },
      }),
    });
    if (res.status === 402) throw new Error("AI credits exhausted. Add credits in workspace settings.");
    if (res.status === 429) throw new Error("AI rate limit hit. Try again shortly.");
    if (!res.ok) throw new Error(`AI request failed (${res.status})`);
    const body = (await res.json()) as any;
    const raw = body.choices?.[0]?.message?.content ?? "{}";
    let parsed: any;
    try { parsed = JSON.parse(raw); } catch { throw new Error("AI returned invalid JSON"); }
    return {
      sessionPurpose: String(parsed.sessionPurpose ?? "").trim(),
      expectedResults: String(parsed.expectedResults ?? "").trim(),
      downtime: String(parsed.downtime ?? "").trim(),
      notes: String(parsed.notes ?? "").trim(),
    };
  });

export const declinePlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    const { data: plan } = await context.supabase
      .from("treatment_plans")
      .select("id")
      .eq("id", data.id)
      .maybeSingle();
    if (!plan) throw new Error("Plan not found");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("treatment_plans")
      .update({ status: "declined" })
      .eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

// =================== PUBLIC (tokenised) ===================

export const getPlanByToken = createServerFn({ method: "GET" })
  .inputValidator((d: { token: string }) => d)
  .handler(async ({ data }) => {
    const { createClient } = await import("@supabase/supabase-js");
    const sb = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_PUBLISHABLE_KEY!,
      { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
    );
    const { data: res, error } = await sb.rpc("get_plan_by_token", { _token: data.token });
    if (error) throw error;
    return res as any;
  });

export const respondToPlanByToken = createServerFn({ method: "POST" })
  .inputValidator((d: { token: string; accept: boolean; reason?: string | null; tags?: string[] | null }) => d)
  .handler(async ({ data }) => {
    const { createClient } = await import("@supabase/supabase-js");
    const sb = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_PUBLISHABLE_KEY!,
      { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
    );
    const { data: res, error } = await sb.rpc("respond_to_plan_by_token", {
      _token: data.token,
      _accept: data.accept,
      _reason: data.reason ?? null,
      _tags: data.tags ?? null,
    });
    if (error) throw error;
    return res as any;
  });
