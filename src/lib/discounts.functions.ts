import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

async function __activeProfileId(supabase: any, userId: string) {
  const { activeProfileId } = await import("./clinic-context.server");
  return (await activeProfileId(supabase, userId)) ?? "00000000-0000-0000-0000-000000000000";
}

function publicClient() {
  return createClient<Database>(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
  );
}

async function ownProfileId(supabase: any, userId: string) {
  const { data, error } = await supabase
    .from("profiles").select("id").eq("id", await __activeProfileId(supabase, userId)).single();
  if (error) throw error;
  return data.id as string;
}

// ---- Treatment menu discount (always-visible) ----
export const setTreatmentDiscount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: {
    id: string;
    discount_percent: number | null;
    discount_starts_at?: string | null;
    discount_ends_at?: string | null;
    discount_days_of_week?: number[] | null;
  }) => i)
  .handler(async ({ data, context }) => {
    const pid = await ownProfileId(context.supabase, context.userId);
    const { error } = await context.supabase
      .from("treatments")
      .update({
        discount_percent: data.discount_percent,
        discount_starts_at: data.discount_starts_at ?? null,
        discount_ends_at: data.discount_ends_at ?? null,
        discount_days_of_week: data.discount_days_of_week ?? null,
      } as any)
      .eq("id", data.id)
      .eq("profile_id", pid);
    if (error) throw error;
    return { ok: true };
  });

// ---- Discount codes ----
export const listDiscountCodes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const pid = await ownProfileId(context.supabase, context.userId);
    const { data, error } = await (context.supabase as any)
      .from("discount_codes").select("*").eq("profile_id", pid)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data;
  });

export const upsertDiscountCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: {
    id?: string;
    code: string;
    label?: string | null;
    kind: "percent" | "fixed";
    amount: number;
    treatment_ids?: string[];
    starts_at?: string | null;
    ends_at?: string | null;
    days_of_week?: number[] | null;
    max_uses?: number | null;
    active?: boolean;
  }) => i)
  .handler(async ({ data, context }) => {
    const pid = await ownProfileId(context.supabase, context.userId);
    const row = {
      profile_id: pid,
      code: data.code.trim(),
      label: data.label ?? null,
      kind: data.kind,
      amount: data.amount,
      treatment_ids: data.treatment_ids ?? [],
      starts_at: data.starts_at ?? null,
      ends_at: data.ends_at ?? null,
      days_of_week: data.days_of_week ?? null,
      max_uses: data.max_uses ?? null,
      active: data.active ?? true,
    };
    if (data.id) {
      const { error } = await (context.supabase as any)
        .from("discount_codes").update(row).eq("id", data.id).eq("profile_id", pid);
      if (error) throw error;
      return { id: data.id };
    }
    const { data: ins, error } = await (context.supabase as any)
      .from("discount_codes").insert(row).select("id").single();
    if (error) throw error;
    return { id: ins.id };
  });

export const deleteDiscountCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { id: string }) => i)
  .handler(async ({ data, context }) => {
    const pid = await ownProfileId(context.supabase, context.userId);
    const { error } = await (context.supabase as any)
      .from("discount_codes").delete().eq("id", data.id).eq("profile_id", pid);
    if (error) throw error;
    return { ok: true };
  });

export const validateDiscountCode = createServerFn({ method: "POST" })
  .inputValidator((i: { slug: string; code: string; treatment_ids: string[] }) => i)
  .handler(async ({ data }) => {
    const sb = publicClient();
    const { data: rows, error } = await (sb as any).rpc("validate_discount_code", {
      p_slug: data.slug.toLowerCase(),
      p_code: data.code,
      p_treatment_ids: data.treatment_ids,
    });
    if (error) throw error;
    return (rows && rows[0]) ?? null;
  });

// ---- Model slots ----
export const listMyModelSlots = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const pid = await ownProfileId(context.supabase, context.userId);
    const { data, error } = await (context.supabase as any)
      .from("model_slots").select("*").eq("profile_id", pid)
      .order("slot_date", { ascending: true })
      .order("start_time", { ascending: true });
    if (error) throw error;
    return data;
  });

export const upsertModelSlot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: {
    id?: string;
    treatment_id: string;
    location_id?: string | null;
    slot_date?: string | null;
    start_time?: string | null;
    end_time?: string | null;
    is_flexible?: boolean;
    price_mode: "fixed" | "percent";
    price_value: number;
    notes?: string | null;
    active?: boolean;
    category?: string | null;
  }) => i)
  .handler(async ({ data, context }) => {
    const pid = await ownProfileId(context.supabase, context.userId);
    const flexible = !!data.is_flexible;
    const row = {
      profile_id: pid,
      treatment_id: data.treatment_id,
      location_id: data.location_id ?? null,
      slot_date: flexible ? null : data.slot_date,
      start_time: flexible ? null : data.start_time,
      end_time: flexible ? null : data.end_time,
      is_flexible: flexible,
      price_mode: data.price_mode,
      price_value: data.price_value,
      notes: data.notes ?? null,
      active: data.active ?? true,
      category: data.category ?? null,
    };
    if (data.id) {
      const { error } = await (context.supabase as any)
        .from("model_slots").update(row).eq("id", data.id).eq("profile_id", pid);
      if (error) throw error;
      return { id: data.id };
    }
    const { data: ins, error } = await (context.supabase as any)
      .from("model_slots").insert(row).select("id").single();
    if (error) throw error;
    return { id: ins.id };
  });


export const deleteModelSlot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { id: string }) => i)
  .handler(async ({ data, context }) => {
    const pid = await ownProfileId(context.supabase, context.userId);
    const { error } = await (context.supabase as any)
      .from("model_slots").delete().eq("id", data.id).eq("profile_id", pid);
    if (error) throw error;
    return { ok: true };
  });

export const getPublicModelSlots = createServerFn({ method: "GET" })
  .inputValidator((i: { slug: string }) => i)
  .handler(async ({ data: input }) => {
    const sb = publicClient();
    const { data: profile, error: pErr } = await (sb as any)
      .rpc("get_public_profile_by_slug", { p_slug: input.slug.toLowerCase() }).single();
    if (pErr) throw pErr;
    const today = new Date().toISOString().slice(0, 10);
    const { data: rows, error } = await (sb as any)
      .from("model_slots").select("*")
      .eq("profile_id", profile.id)
      .or(`is_flexible.eq.true,slot_date.gte.${today}`)
      .order("is_flexible", { ascending: false })
      .order("slot_date", { ascending: true })
      .order("start_time", { ascending: true });
    if (error) throw error;
    return rows ?? [];
  });


