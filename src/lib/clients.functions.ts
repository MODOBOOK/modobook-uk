import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function getProfileId(supabase: any, userId: string) {
  const { data } = await supabase
    .from("profiles")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();
  return data?.id ?? null;
}

export const listClients = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const profileId = await getProfileId(context.supabase, context.userId);
    if (!profileId) return [];
    const { data, error } = await context.supabase
      .from("clinic_clients")
      .select("*")
      .eq("profile_id", profileId)
      .order("full_name");
    if (error) throw error;
    return data ?? [];
  });

export const upsertClient = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: {
    id?: string;
    full_name: string;
    email?: string | null;
    phone?: string | null;
    dob?: string | null;
    gender?: string | null;
    address?: string | null;
    group_name?: string | null;
    notes?: string | null;
    avatar_url?: string | null;
    has_allergies?: boolean;
    allergies?: string | null;
  }) => input)
  .handler(async ({ data, context }) => {
    const profileId = await getProfileId(context.supabase, context.userId);
    if (!profileId) throw new Error("Profile not found");
    const payload = {
      profile_id: profileId,
      full_name: data.full_name.trim(),
      email: data.email?.trim() || null,
      phone: data.phone?.trim() || null,
      dob: data.dob || null,
      gender: data.gender || null,
      address: data.address || null,
      group_name: data.group_name || null,
      notes: data.notes || null,
      avatar_url: data.avatar_url || null,
      has_allergies: !!data.has_allergies,
      allergies: data.allergies || null,
    };
    if (data.id) {
      const { data: row, error } = await context.supabase
        .from("clinic_clients")
        .update(payload)
        .eq("id", data.id)
        .eq("profile_id", profileId)
        .select()
        .single();
      if (error) throw error;
      return row;
    }
    const { data: row, error } = await context.supabase
      .from("clinic_clients")
      .insert(payload)
      .select()
      .single();
    if (error) throw error;
    return row;
  });

export const deleteClient = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("clinic_clients")
      .delete()
      .eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });
