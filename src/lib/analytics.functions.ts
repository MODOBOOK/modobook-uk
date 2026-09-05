import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function __activeProfileId(supabase: any, userId: string) {
  const { activeProfileId } = await import("./clinic-context.server");
  return (await activeProfileId(supabase, userId)) ?? "00000000-0000-0000-0000-000000000000";
}

async function getProfileId(supabase: any, userId: string) {
  const { data } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", await __activeProfileId(supabase, userId))
    .maybeSingle();
  return data?.id as string | undefined;
}

export const getDashboardAnalytics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const profileId = await getProfileId(supabase, userId);
    if (!profileId) {
      return {
        appointments: [],
        patientCount: 0,
        newPatientsThisMonth: 0,
        returningPatientsThisMonth: 0,
      };
    }

    const { data: appointments, error: apptErr } = await supabase
      .from("appointments")
      .select(
        "id, patient_name, patient_email, patient_user_id, scheduled_date, start_time, end_time, status, payment_status, total_amount, amount_paid_cents, amount_refunded_cents, checkout_discount_cents, treatments(name, color, category_id)",
      )
      .eq("profile_id", profileId)
      .order("scheduled_date", { ascending: true })
      .order("start_time", { ascending: true })
      .range(0, 9999);

    if (apptErr) throw apptErr;

    const { count: patientCount, error: patientErr } = await supabase
      .from("appointments")
      .select("patient_email", { count: "exact", head: true })
      .eq("profile_id", profileId)
      .not("patient_email", "is", null);

    if (patientErr) throw patientErr;

    return {
      appointments: appointments ?? [],
      patientCount: patientCount ?? 0,
      newPatientsThisMonth: 0,
      returningPatientsThisMonth: 0,
    };
  });

export type IncomeReportRow = {
  id: string;
  date: string;
  time: string | null;
  treatment: string;
  status: string;
  paymentStatus: string;
  method: string;
  gross: number;
  discount: number;
  refunded: number;
  net: number;
};

export const getIncomeReport = createServerFn({ method: "GET" })
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
      rows: [] as IncomeReportRow[],
      totals: { gross: 0, discounts: 0, refunds: 0, net: 0, bookings: 0, outstanding: 0 },
      byMethod: [] as { label: string; amount: number; count: number }[],
      byTreatment: [] as { label: string; amount: number; count: number }[],
      byMonth: [] as { label: string; amount: number; count: number }[],
    };
    if (!profileId) return empty;

    const { data: profile } = await supabase
      .from("profiles")
      .select("clinic_name, brand_color")
      .eq("id", profileId)
      .maybeSingle();

    const { data: appts, error } = await supabase
      .from("appointments")
      .select(
        "id, patient_name, scheduled_date, start_time, status, payment_status, payment_method, checkout_method, total_amount, amount_paid_cents, amount_refunded_cents, checkout_discount_cents, discount_amount, treatment_name_snapshot, treatments(name)",
      )
      .eq("profile_id", profileId)
      .gte("scheduled_date", data.from)
      .lte("scheduled_date", data.to)
      .order("scheduled_date", { ascending: true })
      .range(0, 9999);
    if (error) throw error;

    const rows: IncomeReportRow[] = [];
    const methodMap = new Map<string, { amount: number; count: number }>();
    const treatMap = new Map<string, { amount: number; count: number }>();
    const monthMap = new Map<string, { amount: number; count: number }>();
    let gross = 0, discounts = 0, refunds = 0, net = 0, outstanding = 0;

    for (const a of (appts ?? []) as any[]) {
      if (a.status === "cancelled" && !(a.amount_paid_cents > 0)) continue;
      const paid = (a.amount_paid_cents ?? 0) / 100;
      const refund = (a.amount_refunded_cents ?? 0) / 100;
      const discount = ((a.checkout_discount_cents ?? 0) / 100) + Number(a.discount_amount ?? 0);
      const total = Number(a.total_amount ?? 0);
      const rowNet = paid - refund;
      const treatment = a.treatments?.name ?? a.treatment_name_snapshot ?? "Treatment";
      const method = a.checkout_method ?? a.payment_method ?? "unrecorded";

      gross += paid;
      refunds += refund;
      discounts += discount;
      net += rowNet;
      if (total > paid) outstanding += total - paid;

      const m = methodMap.get(method) ?? { amount: 0, count: 0 };
      m.amount += rowNet; m.count += 1; methodMap.set(method, m);
      const t = treatMap.get(treatment) ?? { amount: 0, count: 0 };
      t.amount += rowNet; t.count += 1; treatMap.set(treatment, t);
      const key = String(a.scheduled_date).slice(0, 7);
      const mm = monthMap.get(key) ?? { amount: 0, count: 0 };
      mm.amount += rowNet; mm.count += 1; monthMap.set(key, mm);

      rows.push({
        id: a.id,
        date: a.scheduled_date,
        time: a.start_time ?? null,
        patient: a.patient_name ?? "—",
        treatment,
        status: a.status ?? "",
        paymentStatus: a.payment_status ?? "",
        method,
        gross: paid,
        discount,
        refunded: refund,
        net: rowNet,
      });
    }

    const toList = (m: Map<string, { amount: number; count: number }>) =>
      [...m.entries()].map(([label, v]) => ({ label, ...v })).sort((a, b) => b.amount - a.amount);

    return {
      clinicName: (profile?.clinic_name as string) ?? "",
      brandColor: (profile?.brand_color as string | null) ?? null,
      from: data.from,
      to: data.to,
      rows,
      totals: { gross, discounts, refunds, net, bookings: rows.length, outstanding },
      byMethod: toList(methodMap),
      byTreatment: toList(treatMap).slice(0, 20),
      byMonth: [...monthMap.entries()].map(([label, v]) => ({ label, ...v })).sort((a, b) => a.label.localeCompare(b.label)),
    };
  });
