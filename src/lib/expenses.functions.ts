import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function getProfileId(supabase: any, userId: string): Promise<string | null> {
  const { activeProfileId } = await import("./clinic-context.server");
  return (await activeProfileId(supabase, userId)) ?? null;
}

export type ExpenseRow = {
  id: string;
  name: string;
  category: string;
  amount_cents: number;
  frequency: "one_off" | "weekly" | "monthly" | "yearly" | "hourly" | "half_hourly";
  start_date: string;
  end_date: string | null;
  notes: string | null;
};

export const listExpenses = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const pid = await getProfileId(context.supabase, context.userId);
    if (!pid) return { expenses: [] as ExpenseRow[] };
    const { data, error } = await context.supabase
      .from("business_expenses" as any)
      .select("id, name, category, amount_cents, frequency, start_date, end_date, notes")
      .eq("profile_id", pid)
      .order("start_date", { ascending: false });
    if (error) throw error;
    return { expenses: (data ?? []) as unknown as ExpenseRow[] };
  });

export const upsertExpense = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: Omit<ExpenseRow, "id"> & { id?: string }) => input)
  .handler(async ({ data, context }) => {
    const pid = await getProfileId(context.supabase, context.userId);
    if (!pid) throw new Error("No profile");
    const freq = ["one_off", "weekly", "monthly", "yearly", "hourly", "half_hourly"].includes(data.frequency) ? data.frequency : "one_off";
    const payload = {
      profile_id: pid,
      name: data.name.trim().slice(0, 200),
      category: data.category || "other",
      amount_cents: Math.max(0, Math.round(data.amount_cents)),
      frequency: freq,
      start_date: data.start_date,
      end_date: freq === "one_off" || freq === "hourly" || freq === "half_hourly" ? null : data.end_date || null,
      notes: data.notes?.trim() || null,
    };
    const t = context.supabase.from("business_expenses" as any);
    const { error } = data.id ? await t.update(payload).eq("id", data.id).eq("profile_id", pid) : await t.insert(payload);
    if (error) throw error;
    return { ok: true };
  });

export const deleteExpense = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data, context }) => {
    const pid = await getProfileId(context.supabase, context.userId);
    if (!pid) throw new Error("No profile");
    const { error } = await context.supabase.from("business_expenses" as any).delete().eq("id", data.id).eq("profile_id", pid);
    if (error) throw error;
    return { ok: true };
  });

/** Costs data for analytics: all expenses + product purchases. */
export const getCostsForAnalytics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const pid = await getProfileId(context.supabase, context.userId);
    if (!pid) return { expenses: [] as ExpenseRow[], purchases: [] as { purchased_at: string; total_cost_cents: number }[], income: [] as ExpenseRow[], usage: [] as { date: string; cost_cents: number }[] };
    const [e, p, inc] = await Promise.all([
      context.supabase.from("business_expenses" as any).select("id, name, category, amount_cents, frequency, start_date, end_date, notes").eq("profile_id", pid),
      context.supabase.from("product_purchases").select("purchased_at, total_cost_cents").eq("profile_id", pid),
      context.supabase.from("business_income" as any).select("id, name, category, amount_cents, frequency, start_date, end_date, notes").eq("profile_id", pid),
    ]);
    // Staff without access simply get empty lists (RLS).
    return {
      expenses: (e.data ?? []) as unknown as ExpenseRow[],
      purchases: (p.data ?? []) as { purchased_at: string; total_cost_cents: number }[],
      income: (inc.data ?? []) as unknown as ExpenseRow[],
      usage: await productUsage(context.supabase, pid),
    };
  });

/** Product cost used by booked treatments: one entry per appointment date. */
async function productUsage(sb: any, pid: string): Promise<{ date: string; cost_cents: number }[]> {
  const { data: links } = await sb.from("treatment_products").select("treatment_id, cost_per_treatment_cents").eq("profile_id", pid);
  const perTreatment = new Map<string, number>();
  for (const l of links ?? []) perTreatment.set(l.treatment_id, (perTreatment.get(l.treatment_id) ?? 0) + (l.cost_per_treatment_cents ?? 0));
  if (!perTreatment.size) return [];
  const { data: appts } = await sb.from("appointments").select("scheduled_date, treatment_id, status")
    .in("treatment_id", Array.from(perTreatment.keys())).not("status", "in", "(cancelled,no_show)").limit(10000);
  return (appts ?? []).map((a: any) => ({ date: String(a.scheduled_date).slice(0, 10), cost_cents: perTreatment.get(a.treatment_id) ?? 0 })).filter((u: any) => u.cost_cents > 0);
}

// ---------- Additional business income ----------
export type IncomeRow = Omit<ExpenseRow, "frequency"> & { frequency: "one_off" | "weekly" | "monthly" | "yearly" };
const INCOME_COLS = "id, name, category, amount_cents, frequency, start_date, end_date, notes";

export const listIncome = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const pid = await getProfileId(context.supabase, context.userId);
    if (!pid) return { income: [] as IncomeRow[] };
    const { data, error } = await context.supabase.from("business_income" as any).select(INCOME_COLS).eq("profile_id", pid).order("start_date", { ascending: false });
    if (error) throw error;
    return { income: (data ?? []) as unknown as IncomeRow[] };
  });

export const upsertIncome = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: Omit<IncomeRow, "id"> & { id?: string }) => input)
  .handler(async ({ data, context }) => {
    const pid = await getProfileId(context.supabase, context.userId);
    if (!pid) throw new Error("No profile");
    const freq = ["one_off", "weekly", "monthly", "yearly"].includes(data.frequency) ? data.frequency : "one_off";
    const payload = {
      profile_id: pid,
      name: data.name.trim().slice(0, 200),
      category: data.category || "other",
      amount_cents: Math.max(0, Math.round(data.amount_cents)),
      frequency: freq,
      start_date: data.start_date,
      end_date: freq === "one_off" ? null : data.end_date || null,
      notes: data.notes?.trim() || null,
    };
    const t = context.supabase.from("business_income" as any);
    const { error } = data.id ? await t.update(payload).eq("id", data.id).eq("profile_id", pid) : await t.insert(payload);
    if (error) throw error;
    return { ok: true };
  });

export const deleteIncome = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data, context }) => {
    const pid = await getProfileId(context.supabase, context.userId);
    if (!pid) throw new Error("No profile");
    const { error } = await context.supabase.from("business_income" as any).delete().eq("id", data.id).eq("profile_id", pid);
    if (error) throw error;
    return { ok: true };
  });
