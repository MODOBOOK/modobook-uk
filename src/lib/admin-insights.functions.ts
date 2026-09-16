// Admin insights: platform-wide activity feed, per-clinic health overview and
// usage trends. GDPR-safe by design — no patient names, emails or phone
// numbers are ever selected here; only counts and clinic-level information.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data, error } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (error) throw error;
  if (!data) throw new Error("Forbidden");
}

function num(v: unknown): number {
  if (v == null) return 0;
  const n = parseFloat(String(v).replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

export type ActivityEvent = {
  kind: "booking" | "payment" | "signup" | "membership";
  at: string;
  clinic: string;
  text: string;
  amount: number | null;
};

export type ClinicHealth = {
  profile_id: string;
  clinic_name: string;
  slug: string | null;
  bookings_7d: number;
  bookings_prev_7d: number;
  upcoming: number;
  upcoming_no_price: number;
  last_booking_at: string | null;
  flags: string[];
};

export type TrendDay = {
  day: string; // yyyy-mm-dd
  bookings: number;
  revenue: number;
  signups: number;
};

export const adminInsights = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const now = Date.now();
    const day = 24 * 60 * 60 * 1000;
    const iso = (t: number) => new Date(t).toISOString();

    const [profilesRes, recentBookings, recentPayments, membershipsRes, upcomingRes] = await Promise.all([
      supabaseAdmin
        .from("profiles")
        .select("id, clinic_name, slug, created_at, active")
        .order("created_at", { ascending: false })
        .limit(500),
      supabaseAdmin
        .from("appointments")
        .select("id, profile_id, created_at, start_time, status, treatment_name_snapshot, total_amount")
        .gte("created_at", iso(now - 30 * day))
        .order("created_at", { ascending: false })
        .limit(1500),
      supabaseAdmin
        .from("payments")
        .select("id, profile_id, amount, status, created_at")
        .gte("created_at", iso(now - 30 * day))
        .order("created_at", { ascending: false })
        .limit(1500),
      supabaseAdmin
        .from("patient_memberships")
        .select("id, profile_id, status, created_at")
        .gte("created_at", iso(now - 30 * day))
        .order("created_at", { ascending: false })
        .limit(200),
      supabaseAdmin
        .from("appointments")
        .select("id, profile_id, start_time, status, total_amount")
        .gte("start_time", iso(now))
        .lte("start_time", iso(now + 60 * day))
        .limit(2000),
    ]);

    const profiles = (profilesRes.data ?? []) as Array<{
      id: string;
      clinic_name: string | null;
      slug: string | null;
      created_at: string;
      active: boolean | null;
    }>;
    const clinicName = new Map(profiles.map((p) => [p.id, p.clinic_name || "Unknown clinic"]));

    // ---- Activity feed (no patient data) ----
    const activity: ActivityEvent[] = [];
    for (const b of (recentBookings.data ?? []) as any[]) {
      if (new Date(b.created_at).getTime() < now - 14 * day) continue;
      activity.push({
        kind: "booking",
        at: b.created_at,
        clinic: clinicName.get(b.profile_id) ?? "Unknown clinic",
        text: `New booking${b.treatment_name_snapshot ? ` — ${b.treatment_name_snapshot}` : ""}`,
        amount: num(b.total_amount) || null,
      });
    }
    for (const p of (recentPayments.data ?? []) as any[]) {
      if (new Date(p.created_at).getTime() < now - 14 * day) continue;
      if (p.status !== "succeeded" && p.status !== "paid") continue;
      activity.push({
        kind: "payment",
        at: p.created_at,
        clinic: clinicName.get(p.profile_id) ?? "Unknown clinic",
        text: "Payment received",
        amount: num(p.amount) || null,
      });
    }
    for (const pr of profiles) {
      if (new Date(pr.created_at).getTime() < now - 30 * day) continue;
      activity.push({
        kind: "signup",
        at: pr.created_at,
        clinic: pr.clinic_name || "New clinic",
        text: "Joined Modo",
        amount: null,
      });
    }
    for (const m of (membershipsRes.data ?? []) as any[]) {
      activity.push({
        kind: "membership",
        at: m.created_at,
        clinic: clinicName.get(m.profile_id) ?? "Unknown clinic",
        text: `Membership ${m.status === "active" ? "started" : "created"}`,
        amount: null,
      });
    }
    activity.sort((a, b) => (a.at < b.at ? 1 : -1));

    // ---- Per-clinic health (counts only) ----
    const byClinic = new Map<string, ClinicHealth>();
    for (const p of profiles) {
      byClinic.set(p.id, {
        profile_id: p.id,
        clinic_name: p.clinic_name || "Unnamed clinic",
        slug: p.slug,
        bookings_7d: 0,
        bookings_prev_7d: 0,
        upcoming: 0,
        upcoming_no_price: 0,
        last_booking_at: null,
        flags: [],
      });
    }
    for (const b of (recentBookings.data ?? []) as any[]) {
      const c = byClinic.get(b.profile_id);
      if (!c) continue;
      const t = new Date(b.created_at).getTime();
      if (t >= now - 7 * day) c.bookings_7d++;
      else if (t >= now - 14 * day) c.bookings_prev_7d++;
      if (!c.last_booking_at || b.created_at > c.last_booking_at) c.last_booking_at = b.created_at;
    }
    for (const b of (upcomingRes.data ?? []) as any[]) {
      if (b.status === "cancelled") continue;
      const c = byClinic.get(b.profile_id);
      if (!c) continue;
      c.upcoming++;
      if (!num(b.total_amount)) c.upcoming_no_price++;
    }

    // Clinics with no bookings at all in the 30-day window need a separate
    // check for their last ever booking, otherwise they'd look "quiet" forever.
    const clinics = [...byClinic.values()].filter((c) => c.bookings_7d + c.bookings_prev_7d > 0 || c.upcoming > 0 || c.last_booking_at);
    for (const c of clinics) {
      const quietDays = c.last_booking_at ? Math.floor((now - new Date(c.last_booking_at).getTime()) / day) : 999;
      if (quietDays >= 14) c.flags.push("No new bookings for 2+ weeks");
      else if (c.bookings_7d === 0 && c.bookings_prev_7d > 0) c.flags.push("Bookings stopped this week");
      if (c.upcoming_no_price >= 3) c.flags.push(`${c.upcoming_no_price} upcoming bookings missing a price`);
      if (c.upcoming === 0) c.flags.push("No upcoming bookings in the next 60 days");
      if (c.bookings_prev_7d > 0 && c.bookings_7d < c.bookings_prev_7d / 2) c.flags.push("Bookings dropped sharply this week");
    }
    clinics.sort((a, b) => b.flags.length - a.flags.length || b.bookings_7d - a.bookings_7d);

    // ---- Usage trends: per-day buckets for the last 30 days ----
    const buckets = new Map<string, TrendDay>();
    for (let i = 29; i >= 0; i--) {
      const d = iso(now - i * day).slice(0, 10);
      buckets.set(d, { day: d, bookings: 0, revenue: 0, signups: 0 });
    }
    for (const b of (recentBookings.data ?? []) as any[]) {
      const k = String(b.created_at).slice(0, 10);
      const bk = buckets.get(k);
      if (bk) bk.bookings++;
    }
    for (const p of (recentPayments.data ?? []) as any[]) {
      if (p.status !== "succeeded" && p.status !== "paid") continue;
      const k = String(p.created_at).slice(0, 10);
      const bk = buckets.get(k);
      if (bk) bk.revenue += num(p.amount);
    }
    for (const pr of profiles) {
      const k = String(pr.created_at).slice(0, 10);
      const bk = buckets.get(k);
      if (bk) bk.signups++;
    }

    return {
      activity: activity.slice(0, 60),
      clinics,
      trends: [...buckets.values()],
      totals: {
        clinics: profiles.length,
        bookings_30d: (recentBookings.data ?? []).length,
        revenue_30d: (recentPayments.data ?? [])
          .filter((p: any) => p.status === "succeeded" || p.status === "paid")
          .reduce((s: number, p: any) => s + num(p.amount), 0),
      },
    };
  });
