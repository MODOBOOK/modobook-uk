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
