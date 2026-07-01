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
