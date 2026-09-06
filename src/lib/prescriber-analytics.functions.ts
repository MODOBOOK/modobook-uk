import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getPrescriberAnalytics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const startOfWeek = new Date(now.getTime() - 7 * 86400000).toISOString();

    const [{ data: allRefs }, { data: rxThisMonth }, { data: recent }] = await Promise.all([
      supabase
        .from("prescriber_referrals")
        .select("id, status, is_walk_in, awaiting_practitioner_close, created_at, accepted_at, closed_by_practitioner_at, patient_name")
        .eq("prescriber_user_id", userId)
        .order("created_at", { ascending: false })
        .limit(500),
      supabase
        .from("prescriptions")
        .select("id, signed_at, drug_name, patient_name, status")
        .eq("prescriber_user_id", userId)
        .eq("status", "signed")
        .gte("signed_at", startOfMonth),
      supabase
        .from("prescriptions")
        .select("id, drug_name, patient_name, signed_at, status")
        .eq("prescriber_user_id", userId)
        .order("created_at", { ascending: false })
        .limit(10),
    ]);

    const refs = allRefs ?? [];
    const pending = refs.filter((r) => r.status === "pending").length;
    const activeCases = refs.filter((r) => r.status === "accepted").length;
    const completedThisMonth = refs.filter(
      (r) => r.status === "completed" && r.accepted_at && new Date(r.accepted_at) >= new Date(startOfMonth),
    ).length;
    const walkInsThisWeek = refs.filter(
      (r) => r.is_walk_in && new Date(r.created_at) >= new Date(startOfWeek),
    ).length;
    const walkInsAwaitingClose = refs.filter((r) => r.is_walk_in && r.awaiting_practitioner_close).length;

    // Avg response time: created -> accepted (hours), across last 30 accepted
    const responded = refs
      .filter((r) => r.accepted_at)
      .slice(0, 30)
      .map((r) => (new Date(r.accepted_at!).getTime() - new Date(r.created_at).getTime()) / 3600000);
    const avgResponseHours = responded.length
      ? Math.round((responded.reduce((a, b) => a + b, 0) / responded.length) * 10) / 10
      : null;

    const activity = [
      ...refs.slice(0, 8).map((r) => ({
        kind: r.is_walk_in ? "walk_in" : "referral",
        title: r.patient_name ?? "Patient",
        detail: r.status,
        at: r.accepted_at ?? r.created_at,
      })),
      ...(recent ?? []).slice(0, 5).map((p) => ({
        kind: "rx",
        title: `${p.drug_name} — ${p.patient_name}`,
        detail: p.status,
        at: p.signed_at ?? new Date().toISOString(),
      })),
    ]
      .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
      .slice(0, 10);

    return {
      pendingReferrals: pending,
      activeCases,
      scriptsSignedThisMonth: (rxThisMonth ?? []).length,
      completedThisMonth,
      walkInsThisWeek,
      walkInsAwaitingClose,
      avgResponseHours,
      activity,
    };
  });

// ---- Prescriber Home: action-needed board + sign-off audit in one call ----
export const getPrescriberHome = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    const [
      { data: refs },
      { data: rxPending },
      { data: rxAwaiting },
      { data: visits },
      { count: signedThisMonthCount },
      { data: signoffs },
      { data: myProfile },
    ] = await Promise.all([
      supabase
        .from("prescriber_referrals")
        .select("id, status, patient_name, is_walk_in, awaiting_practitioner_close, created_at")
        .eq("prescriber_user_id", userId)
        .order("created_at", { ascending: false })
        .limit(200),
      supabase
        .from("prescription_requests")
        .select("id, treatment_name, created_at, patient_snapshot")
        .eq("prescriber_id", userId)
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(20),
      supabase
        .from("prescription_requests")
        .select("id, treatment_name, updated_at")
        .eq("prescriber_id", userId)
        .eq("status", "awaiting_info")
        .order("updated_at", { ascending: false })
        .limit(20),
      supabase
        .from("prescriber_clinic_visits")
        .select("id, status, visit_date")
        .eq("prescriber_user_id", userId)
        .eq("status", "pending_approval")
        .order("visit_date", { ascending: true })
        .limit(20),
      supabase
        .from("prescriptions")
        .select("id", { count: "exact", head: true })
        .limit(1)
        .eq("prescriber_user_id", userId)
        .eq("status", "signed")
        .gte("signed_at", startOfMonth),
      supabase
        .from("prescription_request_events")
        .select("id, request_id, kind, summary, created_at")
        .eq("actor_id", userId)
        .in("kind", ["approved", "declined"] as never[])
        .order("created_at", { ascending: false })
        .limit(10),
      supabase
        .from("prescriber_profiles")
        .select("fee_per_prescription_pence, fee_per_consult_pence, fee_notes, signoff_pin_hash")
        .eq("user_id", userId)
        .maybeSingle(),
    ]);

    const allRefs = refs ?? [];
    const pendingRefs = allRefs.filter((r) => r.status === "pending");
    const walkInsAwaitingClose = allRefs.filter((r) => r.is_walk_in && r.awaiting_practitioner_close);

    return {
      board: {
        rxPending: (rxPending ?? []).map((r) => ({
          id: r.id,
          title: r.treatment_name,
          subtitle: ((r.patient_snapshot as { full_name?: string } | null)?.full_name ?? "Patient") as string,
          at: r.created_at,
        })),
        referralsPending: pendingRefs.map((r) => ({
          id: r.id,
          title: r.patient_name ?? "Patient",
          subtitle: r.is_walk_in ? "Walk-in consult" : "Referral",
          at: r.created_at,
        })),
        awaitingInfo: (rxAwaiting ?? []).map((r) => ({
          id: r.id,
          title: r.treatment_name,
          subtitle: "Waiting on practitioner",
          at: r.updated_at,
        })),
        visitsPending: (visits ?? []).map((v) => ({
          id: v.id,
          title: "Clinic visit request",
          subtitle: v.visit_date ? new Date(v.visit_date).toLocaleDateString() : "",
          at: v.visit_date,
        })),
        walkInsAwaitingClose: walkInsAwaitingClose.map((r) => ({
          id: r.id,
          title: r.patient_name ?? "Walk-in",
          subtitle: "Awaiting practitioner sign-off",
          at: r.created_at,
        })),
      },
      stats: {
        scriptsSignedThisMonth: signedThisMonth.length ?? 0,
        activeCases: allRefs.filter((r) => r.status === "accepted").length,
      },
      signoffs: (signoffs ?? []).map((e) => ({
        id: e.id,
        requestId: e.request_id,
        kind: e.kind as string,
        summary: (e.summary as string | null) ?? "",
        at: e.created_at,
      })),
      settings: {
        hasPin: !!myProfile?.signoff_pin_hash,
        feeRx: myProfile?.fee_per_prescription_pence ?? null,
        feeConsult: myProfile?.fee_per_consult_pence ?? null,
        feeNotes: myProfile?.fee_notes ?? null,
      },
    };
  });
