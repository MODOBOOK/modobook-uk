import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function getProfileId(supabase: any, userId: string): Promise<string | null> {
  const { activeProfileId } = await import("./clinic-context.server");
  const pid = await activeProfileId(supabase, userId);
  return pid ?? null;
}

export type ProductRow = {
  id: string;
  name: string;
  supplier: string | null;
  unit_cost_cents: number;
  pack_size: number;
  stock_units: number;
  low_stock_threshold: number | null;
  owner_kind: "clinic" | "practitioner";
  owner_staff_id: string | null;
  owner_name?: string | null;
  notes: string | null;
  active: boolean;
};

export type PurchaseRow = {
  id: string;
  product_id: string;
  product_name?: string;
  purchased_at: string;
  quantity: number;
  total_cost_cents: number;
  supplier: string | null;
  notes: string | null;
};

export type TreatmentProductLink = {
  id: string;
  treatment_id: string;
  product_id: string;
  cost_per_treatment_cents: number;
};

export type StaffOption = { id: string; name: string };

export const listProducts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const pid = await getProfileId(context.supabase, context.userId);
    if (!pid) return { products: [] as ProductRow[], purchases: [] as PurchaseRow[], links: [] as TreatmentProductLink[], staff: [] as StaffOption[] };
    const [{ data: products, error: pErr }, { data: purchases, error: puErr }, { data: links, error: lErr }, { data: staff }] = await Promise.all([
      context.supabase.from("products").select("*").eq("profile_id", pid).order("name"),
      context.supabase.from("product_purchases").select("*").eq("profile_id", pid).order("purchased_at", { ascending: false }).limit(200),
      context.supabase.from("treatment_products").select("*").eq("profile_id", pid),
      context.supabase.from("staff_members").select("id, name").eq("profile_id", pid).eq("status", "active"),
    ]);
    if (pErr) throw pErr;
    if (puErr) throw puErr;
    if (lErr) throw lErr;
    const staffById = new Map((staff ?? []).map((s: any) => [s.id, s.name as string]));
    const productById = new Map((products ?? []).map((p: any) => [p.id, p.name as string]));
    return {
      products: ((products ?? []) as any[]).map((p) => ({
        ...p,
        owner_name: p.owner_staff_id ? (staffById.get(p.owner_staff_id) ?? null) : null,
      })) as ProductRow[],
      purchases: ((purchases ?? []) as any[]).map((pu) => ({
        ...pu,
        product_name: productById.get(pu.product_id) ?? "Product",
      })) as PurchaseRow[],
      links: (links ?? []) as TreatmentProductLink[],
      staff: (staff ?? []) as StaffOption[],
    };
  });

export const upsertProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: {
    id?: string;
    name: string;
    supplier?: string | null;
    unit_cost_cents: number;
    pack_size?: number;
    stock_units?: number;
    low_stock_threshold?: number | null;
    owner_kind?: "clinic" | "practitioner";
    owner_staff_id?: string | null;
    notes?: string | null;
    active?: boolean;
  }) => input)
  .handler(async ({ data, context }) => {
    const pid = await getProfileId(context.supabase, context.userId);
    if (!pid) throw new Error("No profile");
    const payload: any = {
      profile_id: pid,
      name: data.name.trim(),
      supplier: data.supplier?.trim() || null,
      unit_cost_cents: Math.max(0, Math.round(data.unit_cost_cents)),
      pack_size: data.pack_size && data.pack_size > 0 ? data.pack_size : 1,
      stock_units: data.stock_units ?? 0,
      low_stock_threshold: data.low_stock_threshold ?? null,
      owner_kind: data.owner_kind === "practitioner" ? "practitioner" : "clinic",
      owner_staff_id: data.owner_kind === "practitioner" ? (data.owner_staff_id ?? null) : null,
      notes: data.notes?.trim() || null,
      active: data.active ?? true,
    };
    if (data.id) {
      const { error } = await context.supabase.from("products").update(payload).eq("id", data.id).eq("profile_id", pid);
      if (error) throw error;
      return { id: data.id };
    }
    const { data: row, error } = await context.supabase.from("products").insert(payload).select("id").single();
    if (error) throw error;
    return { id: row.id as string };
  });

export const deleteProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data, context }) => {
    const pid = await getProfileId(context.supabase, context.userId);
    if (!pid) throw new Error("No profile");
    const { error } = await context.supabase.from("products").delete().eq("id", data.id).eq("profile_id", pid);
    if (error) throw error;
    return { ok: true };
  });

export const logPurchase = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: {
    product_id: string;
    purchased_at?: string;
    quantity: number;
    total_cost_cents: number;
    supplier?: string | null;
    notes?: string | null;
    add_to_stock?: boolean;
  }) => input)
  .handler(async ({ data, context }) => {
    const pid = await getProfileId(context.supabase, context.userId);
    if (!pid) throw new Error("No profile");
    const { error } = await context.supabase.from("product_purchases").insert({
      profile_id: pid,
      product_id: data.product_id,
      purchased_at: data.purchased_at || new Date().toISOString().slice(0, 10),
      quantity: data.quantity,
      total_cost_cents: Math.max(0, Math.round(data.total_cost_cents)),
      supplier: data.supplier?.trim() || null,
      notes: data.notes?.trim() || null,
    });
    if (error) throw error;
    if (data.add_to_stock !== false && data.quantity > 0) {
      const { data: prod } = await context.supabase.from("products").select("stock_units, pack_size").eq("id", data.product_id).eq("profile_id", pid).single();
      if (prod) {
        const units = Number(prod.stock_units) + data.quantity * Number(prod.pack_size || 1);
        await context.supabase.from("products").update({ stock_units: units }).eq("id", data.product_id).eq("profile_id", pid);
      }
    }
    return { ok: true };
  });

export const deletePurchase = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data, context }) => {
    const pid = await getProfileId(context.supabase, context.userId);
    if (!pid) throw new Error("No profile");
    const { error } = await context.supabase.from("product_purchases").delete().eq("id", data.id).eq("profile_id", pid);
    if (error) throw error;
    return { ok: true };
  });

export const adjustStock = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { product_id: string; stock_units: number }) => input)
  .handler(async ({ data, context }) => {
    const pid = await getProfileId(context.supabase, context.userId);
    if (!pid) throw new Error("No profile");
    const { error } = await context.supabase.from("products").update({ stock_units: Math.max(0, data.stock_units) }).eq("id", data.product_id).eq("profile_id", pid);
    if (error) throw error;
    return { ok: true };
  });

export const setProductTreatmentLinks = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { product_id: string; links: { treatment_id: string; cost_per_treatment_cents: number }[] }) => input)
  .handler(async ({ data, context }) => {
    const pid = await getProfileId(context.supabase, context.userId);
    if (!pid) throw new Error("No profile");
    const { error: delErr } = await context.supabase.from("treatment_products").delete().eq("product_id", data.product_id).eq("profile_id", pid);
    if (delErr) throw delErr;
    const rows = data.links
      .filter((l) => l.cost_per_treatment_cents > 0)
      .map((l) => ({
        profile_id: pid,
        product_id: data.product_id,
        treatment_id: l.treatment_id,
        cost_per_treatment_cents: Math.round(l.cost_per_treatment_cents),
      }));
    if (rows.length) {
      const { error } = await context.supabase.from("treatment_products").insert(rows);
      if (error) throw error;
    }
    return { ok: true };
  });
