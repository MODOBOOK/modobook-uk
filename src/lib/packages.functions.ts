import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const listMyPackages = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: profile } = await supabase
      .from("profiles").select("id").eq("user_id", userId).single();
    if (!profile) return [];
    const { data, error } = await supabase
      .from("packages").select("*").eq("profile_id", profile.id)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const createPackage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    name: string;
    treatment_id: string | null;
    session_count: number;
    price: number;
    expiry_days: number | null;
    active: boolean;
  }) => d)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: profile } = await supabase
      .from("profiles").select("id").eq("user_id", userId).single();
    if (!profile) throw new Error("No profile");
    const { error } = await supabase.from("packages").insert({
      profile_id: profile.id,
      name: data.name,
      treatment_id: data.treatment_id,
      session_count: data.session_count,
      price: data.price,
      expiry_days: data.expiry_days,
      active: data.active,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const updatePackage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    id: string;
    name: string;
    treatment_id: string | null;
    session_count: number;
    price: number;
    expiry_days: number | null;
    active: boolean;
  }) => d)
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase.from("packages").update({
      name: data.name,
      treatment_id: data.treatment_id,
      session_count: data.session_count,
      price: data.price,
      expiry_days: data.expiry_days,
      active: data.active,
    }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deletePackage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("packages").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
