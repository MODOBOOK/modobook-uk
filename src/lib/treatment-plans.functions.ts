import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function getProfileId(supabase: any, userId: string) {
  const { data } = await supabase.from("profiles").select("id").eq("user_id", userId).maybeSingle();
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
    status?: string;
    sessions?: Array<{
      id?: string;
      treatmentId: string | null;
      sessionNumber: number;
      intervalWeeksFromPrevious?: number | null;
      suggestedDate?: string | null;
      notes?: string | null;
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
      // simple replace strategy: delete pending/booked-less sessions and reinsert
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
    const { error } = await context.supabase
      .from("treatment_plans")
      .update({ status: "sent", sent_at: new Date().toISOString() })
      .eq("id", data.id)
      .eq("profile_id", pid);
    if (error) throw error;
    return { ok: true };
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
