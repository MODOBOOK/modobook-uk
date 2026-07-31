import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type PackageInput = {
  name: string;
  description: string | null;
  treatment_id: string | null;
  treatment_ids: string[];
  session_count: number;
  price: number;
  duration_minutes: number | null;
  expiry_days: number | null;
  image_url: string | null;
  active: boolean;
  category_id: string | null;
  allow_split_payment?: boolean;
};

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
  .inputValidator((d: PackageInput) => d)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: profile } = await supabase
      .from("profiles").select("id").eq("user_id", userId).single();
    if (!profile) throw new Error("No profile");
    const { error } = await supabase.from("packages").insert({
      profile_id: profile.id,
      name: data.name,
      description: data.description,
      treatment_id: data.treatment_id,
      treatment_ids: data.treatment_ids,
      session_count: data.session_count,
      price: data.price,
      duration_minutes: data.duration_minutes,
      expiry_days: data.expiry_days,
      image_url: data.image_url,
      active: data.active,
      category_id: data.category_id,
      allow_split_payment: data.allow_split_payment ?? false,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const updatePackage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: PackageInput & { id: string }) => d)
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase.from("packages").update({
      name: data.name,
      description: data.description,
      treatment_id: data.treatment_id,
      treatment_ids: data.treatment_ids,
      session_count: data.session_count,
      price: data.price,
      duration_minutes: data.duration_minutes,
      expiry_days: data.expiry_days,
      image_url: data.image_url,
      active: data.active,
      category_id: data.category_id,
      allow_split_payment: data.allow_split_payment ?? false,
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
