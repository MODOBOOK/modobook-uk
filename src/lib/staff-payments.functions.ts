import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Team member payouts & commission.
//
// Every clinic decides, per team member, where their card payments land:
//   • "clinic"      – money goes into the clinic owner's Stripe account (default)
//   • "own_account" – the team member connects their own Stripe account and
//                     patient payments for their treatments are taken there.
//
// `commission_percent` is the practitioner's share of each treatment price.
// Whatever is left over is the clinic owner's commission. When money lands in
// the clinic account the owner owes the practitioner their share; when it lands
// in the practitioner's own account the practitioner owes the owner the
// commission. Both directions are shown in the commission report.

async function getProfileId(supabase: any, userId: string) {
  const { data } = await supabase.from("profiles").select("id").eq("user_id", userId).maybeSingle();
  return data?.id as string | undefined;
}

async function assertOwner(supabase: any, userId: string) {
  const profileId = await getProfileId(supabase, userId);
  if (!profileId) throw new Error("Only the clinic owner can manage payouts.");
  return profileId;
}

export const updateStaffPayout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; payout_mode?: "clinic" | "own_account"; commission_percent?: number }) => d)
  .handler(async ({ data, context }) => {
    const profileId = await assertOwner(context.supabase, context.userId);
    const patch: Record<string, unknown> = {};
    if (data.payout_mode !== undefined) patch.payout_mode = data.payout_mode;
    if (data.commission_percent !== undefined) {
      const pct = Math.max(0, Math.min(100, Number(data.commission_percent) || 0));
      patch.commission_percent = pct;
    }
    if (Object.keys(patch).length === 0) return { ok: true as const };
    const { error } = await context.supabase
      .from("staff_members").update(patch as never).eq("id", data.id).eq("profile_id", profileId);
    if (error) throw error;
    return { ok: true as const };
  });

/** Owner starts a Stripe connection on behalf of a team member (own-account payouts). */
export const startStaffStripeConnect = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    const profileId = await assertOwner(context.supabase, context.userId);
    const { data: staff } = await context.supabase
      .from("staff_members")
      .select("id, invited_email")
      .eq("id", data.id).eq("profile_id", profileId).maybeSingle();
    if (!staff) throw new Error("Team member not found");

    try {
      const { buildStripeOAuthAuthorizeUrl } = await import("./stripe.server");
      const state = "staff_" + crypto.randomUUID() + "-" + crypto.randomUUID();
      const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();
      const { error } = await context.supabase
        .from("staff_members")
        .update({ stripe_oauth_state: state, stripe_oauth_state_expires_at: expiresAt } as never)
        .eq("id", data.id).eq("profile_id", profileId);
      if (error) throw error;

      const redirectUri = "https://modobook.uk/api/public/stripe/oauth-callback";
      const url = buildStripeOAuthAuthorizeUrl({
        state,
        redirectUri,
        email: (staff as { invited_email?: string | null }).invited_email || undefined,
      });
      return { ok: true as const, url };
    } catch (e) {
      return { ok: false as const, message: e instanceof Error ? e.message : "Could not start the connection." };
    }
  });

export const disconnectStaffStripe = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    const profileId = await assertOwner(context.supabase, context.userId);
    const { data: staff } = await context.supabase
      .from("staff_members").select("stripe_account_id")
      .eq("id", data.id).eq("profile_id", profileId).maybeSingle();
    const accountId = (staff as { stripe_account_id?: string | null } | null)?.stripe_account_id;
    if (accountId) {
      try {
        const { deauthorizeStripeAccount } = await import("./stripe.server");
        await deauthorizeStripeAccount(accountId);
      } catch { /* already revoked — clear locally anyway */ }
    }
    const { error } = await context.supabase
      .from("staff_members")
      .update({ stripe_account_id: null, stripe_account_status: null, payout_mode: "clinic" } as never)
      .eq("id", data.id).eq("profile_id", profileId);
    if (error) throw error;
    return { ok: true as const };
  });

export type CommissionStaffRow = {
  staffId: string;
  name: string;
  role: string;
  payoutMode: "clinic" | "own_account";
  commissionPercent: number;
  bookings: number;
  revenue: number;
  practitionerShare: number;
  ownerShare: number;
  /** Positive: owner owes the practitioner. Negative: practitioner owes the owner. */
  owedToPractitioner: number;
};

/** Commission earned per team member over a date range. Owner-only. */
export const getCommissionReport = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { from: string; to: string }) => d)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const profileId = await getProfileId(supabase, userId);
    const empty = {
      clinicName: "",
      brandColor: null as string | null,
      from: data.from,
      to: data.to,
      staff: [] as CommissionStaffRow[],
      totals: { revenue: 0, practitionerShare: 0, ownerShare: 0, bookings: 0 },
      unassignedRevenue: 0,
    };
    if (!profileId) return empty;

    const { data: profile } = await supabase
      .from("profiles").select("clinic_name, brand_color").eq("id", profileId).maybeSingle();

    const { data: staffRows } = await supabase
      .from("staff_members")
      .select("id, name, role, practitioner_id, payout_mode, commission_percent, status")
      .eq("profile_id", profileId);

    const { data: appts, error } = await supabase
      .from("appointments")
      .select("id, practitioner_id, status, total_amount, amount_paid_cents, amount_refunded_cents")
      .eq("profile_id", profileId)
      .gte("scheduled_date", data.from)
      .lte("scheduled_date", data.to)
      .range(0, 9999);
    if (error) throw error;

    const byPractitioner = new Map<string, { revenue: number; bookings: number }>();
    let unassignedRevenue = 0;
    for (const a of (appts ?? []) as any[]) {
      if (a.status === "cancelled" && !(a.amount_paid_cents > 0)) continue;
      const total = Number(a.total_amount ?? 0) || (a.amount_paid_cents ?? 0) / 100;
      const net = total - (a.amount_refunded_cents ?? 0) / 100;
      if (!a.practitioner_id) { unassignedRevenue += net; continue; }
      const cur = byPractitioner.get(a.practitioner_id) ?? { revenue: 0, bookings: 0 };
      cur.revenue += net; cur.bookings += 1;
      byPractitioner.set(a.practitioner_id, cur);
    }

    const rows: CommissionStaffRow[] = [];
    for (const s of (staffRows ?? []) as any[]) {
      if (!s.practitioner_id) continue;
      const agg = byPractitioner.get(s.practitioner_id) ?? { revenue: 0, bookings: 0 };
      const pct = Math.max(0, Math.min(100, Number(s.commission_percent ?? 0)));
      const practitionerShare = Math.round(agg.revenue * pct) / 100;
      const ownerShare = Math.round((agg.revenue - practitionerShare) * 100) / 100;
      const mode: "clinic" | "own_account" = s.payout_mode === "own_account" ? "own_account" : "clinic";
      rows.push({
        staffId: s.id,
        name: s.name,
        role: s.role,
        payoutMode: mode,
        commissionPercent: pct,
        bookings: agg.bookings,
        revenue: Math.round(agg.revenue * 100) / 100,
        practitionerShare,
        ownerShare,
        owedToPractitioner: mode === "clinic" ? practitionerShare : -ownerShare,
      });
    }
    rows.sort((a, b) => b.revenue - a.revenue);

    const totals = rows.reduce(
      (t, r) => ({
        revenue: t.revenue + r.revenue,
        practitionerShare: t.practitionerShare + r.practitionerShare,
        ownerShare: t.ownerShare + r.ownerShare,
        bookings: t.bookings + r.bookings,
      }),
      { revenue: 0, practitionerShare: 0, ownerShare: 0, bookings: 0 },
    );

    return {
      clinicName: (profile?.clinic_name as string) ?? "",
      brandColor: (profile?.brand_color as string | null) ?? null,
      from: data.from,
      to: data.to,
      staff: rows,
      totals,
      unassignedRevenue: Math.round(unassignedRevenue * 100) / 100,
    };
  });

export type StaffPerformanceRow = {
  staffId: string;
  name: string;
  role: string;
  bookings: number;
  completed: number;
  cancelled: number;
  noShows: number;
  revenue: number;
  averageValue: number;
  uniquePatients: number;
  newPatients: number;
  returningPatients: number;
  topTreatments: { label: string; count: number; amount: number }[];
  busiestDay: string | null;
};

/** Per team member performance over a date range. Owner-only. */
export const getStaffAnalytics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { from: string; to: string }) => d)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const profileId = await getProfileId(supabase, userId);
    const empty = {
      from: data.from,
      to: data.to,
      staff: [] as StaffPerformanceRow[],
      totals: { bookings: 0, revenue: 0, completed: 0, cancelled: 0, noShows: 0 },
      unassignedBookings: 0,
    };
    if (!profileId) return empty;

    const { data: staffRows } = await supabase
      .from("staff_members")
      .select("id, name, role, practitioner_id")
      .eq("profile_id", profileId);

    const { data: appts, error } = await supabase
      .from("appointments")
      .select(
        "id, practitioner_id, status, scheduled_date, patient_email, total_amount, amount_paid_cents, amount_refunded_cents, treatment_name_snapshot, treatments(name)",
      )
      .eq("profile_id", profileId)
      .gte("scheduled_date", data.from)
      .lte("scheduled_date", data.to)
      .range(0, 9999);
    if (error) throw error;

    // First-ever booking date per patient, to split new vs returning.
    const { data: history } = await supabase
      .from("appointments")
      .select("patient_email, scheduled_date")
      .eq("profile_id", profileId)
      .not("patient_email", "is", null)
      .range(0, 9999);
    const firstSeen = new Map<string, string>();
    for (const h of (history ?? []) as any[]) {
      const email = String(h.patient_email).toLowerCase();
      const cur = firstSeen.get(email);
      if (!cur || String(h.scheduled_date) < cur) firstSeen.set(email, String(h.scheduled_date));
    }

    type Agg = {
      bookings: number; completed: number; cancelled: number; noShows: number;
      revenue: number; patients: Set<string>; newPatients: Set<string>;
      treatments: Map<string, { count: number; amount: number }>;
      days: Map<string, number>;
    };
    const mk = (): Agg => ({
      bookings: 0, completed: 0, cancelled: 0, noShows: 0, revenue: 0,
      patients: new Set(), newPatients: new Set(), treatments: new Map(), days: new Map(),
    });
    const byPractitioner = new Map<string, Agg>();
    let unassignedBookings = 0;
    const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

    for (const a of (appts ?? []) as any[]) {
      if (!a.practitioner_id) { unassignedBookings += 1; continue; }
      const agg = byPractitioner.get(a.practitioner_id) ?? mk();
      const cancelled = a.status === "cancelled";
      const paid = (a.amount_paid_cents ?? 0) > 0;
      agg.bookings += 1;
      if (a.status === "completed") agg.completed += 1;
      if (cancelled) agg.cancelled += 1;
      if (a.status === "no_show") agg.noShows += 1;

      if (!cancelled || paid) {
        const total = Number(a.total_amount ?? 0) || (a.amount_paid_cents ?? 0) / 100;
        const net = total - (a.amount_refunded_cents ?? 0) / 100;
        agg.revenue += net;
        const label = a.treatments?.name ?? a.treatment_name_snapshot ?? "Treatment";
        const t = agg.treatments.get(label) ?? { count: 0, amount: 0 };
        t.count += 1; t.amount += net; agg.treatments.set(label, t);
      }

      const email = a.patient_email ? String(a.patient_email).toLowerCase() : null;
      if (email) {
        agg.patients.add(email);
        if (firstSeen.get(email) === String(a.scheduled_date)) agg.newPatients.add(email);
      }
      const dow = dayNames[new Date(String(a.scheduled_date) + "T00:00:00").getDay()] ?? "";
      agg.days.set(dow, (agg.days.get(dow) ?? 0) + 1);
      byPractitioner.set(a.practitioner_id, agg);
    }

    const rows: StaffPerformanceRow[] = [];
    for (const s of (staffRows ?? []) as any[]) {
      if (!s.practitioner_id) continue;
      const agg = byPractitioner.get(s.practitioner_id) ?? mk();
      const revenue = Math.round(agg.revenue * 100) / 100;
      const busiest = [...agg.days.entries()].sort((a, b) => b[1] - a[1])[0];
      rows.push({
        staffId: s.id,
        name: s.name,
        role: s.role,
        bookings: agg.bookings,
        completed: agg.completed,
        cancelled: agg.cancelled,
        noShows: agg.noShows,
        revenue,
        averageValue: agg.bookings ? Math.round((revenue / agg.bookings) * 100) / 100 : 0,
        uniquePatients: agg.patients.size,
        newPatients: agg.newPatients.size,
        returningPatients: Math.max(0, agg.patients.size - agg.newPatients.size),
        topTreatments: [...agg.treatments.entries()]
          .map(([label, v]) => ({ label, count: v.count, amount: Math.round(v.amount * 100) / 100 }))
          .sort((a, b) => b.amount - a.amount)
          .slice(0, 5),
        busiestDay: busiest ? busiest[0] : null,
      });
    }
    rows.sort((a, b) => b.revenue - a.revenue);

    const totals = rows.reduce(
      (t, r) => ({
        bookings: t.bookings + r.bookings,
        revenue: Math.round((t.revenue + r.revenue) * 100) / 100,
        completed: t.completed + r.completed,
        cancelled: t.cancelled + r.cancelled,
        noShows: t.noShows + r.noShows,
      }),
      { bookings: 0, revenue: 0, completed: 0, cancelled: 0, noShows: 0 },
    );

    return { from: data.from, to: data.to, staff: rows, totals, unassignedBookings };
  });
