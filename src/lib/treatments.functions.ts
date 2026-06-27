import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

function getServerSupabasePublic() {
  return createClient<Database>(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    {
      auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
    },
  );
}

export const getMyTreatments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data, error } = await supabase
      .from("profiles")
      .select("id")
      .eq("user_id", context.userId)
      .single();
    if (error) throw error;
    const { data: treatments, error: tErr } = await supabase
      .from("treatments")
      .select("*")
      .eq("profile_id", data.id)
      .order("created_at", { ascending: false });
    if (tErr) throw tErr;
    return treatments;
  });

export const createTreatment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      name: string;
      duration: number;
      price: number;
      description?: string;
      timing_notes?: string;
      consent_form_url?: string;
      picture_url?: string;
      payment_mode?: Database["public"]["Enums"]["payment_mode"];
      deposit_amount?: number;
      is_consultation?: boolean;
      deductible_against?: string[];
      deductible_window_days?: number;
    }) => input,
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: profile, error } = await supabase
      .from("profiles")
      .select("id")
      .eq("user_id", context.userId)
      .single();
    if (error) throw error;
    const { data: treatment, error: tErr } = await supabase
      .from("treatments")
      .insert({
        profile_id: profile.id,
        name: data.name,
        duration: data.duration,
        price: data.price,
        description: data.description,
        timing_notes: data.timing_notes,
        consent_form_url: data.consent_form_url,
        picture_url: data.picture_url,
        payment_mode: data.payment_mode ?? "full",
        deposit_amount: data.deposit_amount,
        is_consultation: data.is_consultation ?? false,
        deductible_against: data.deductible_against,
        deductible_window_days: data.deductible_window_days,
      })
      .select()
      .single();
    if (tErr) throw tErr;
    return treatment;
  });

export const updateTreatment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      id: string;
      name?: string;
      duration?: number;
      price?: number;
      description?: string;
      timing_notes?: string;
      consent_form_url?: string;
      picture_url?: string;
      payment_mode?: Database["public"]["Enums"]["payment_mode"];
      deposit_amount?: number;
      active?: boolean;
      is_consultation?: boolean;
      deductible_against?: string[];
      deductible_window_days?: number;
    }) => input,
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const update: Database["public"]["Tables"]["treatments"]["Update"] = {};
    if (data.name !== undefined) update.name = data.name;
    if (data.duration !== undefined) update.duration = data.duration;
    if (data.price !== undefined) update.price = data.price;
    if (data.description !== undefined) update.description = data.description;
    if (data.timing_notes !== undefined) update.timing_notes = data.timing_notes;
    if (data.consent_form_url !== undefined) update.consent_form_url = data.consent_form_url;
    if (data.picture_url !== undefined) update.picture_url = data.picture_url;
    if (data.payment_mode !== undefined) update.payment_mode = data.payment_mode;
    if (data.deposit_amount !== undefined) update.deposit_amount = data.deposit_amount;
    if (data.active !== undefined) update.active = data.active;
    if (data.is_consultation !== undefined) update.is_consultation = data.is_consultation;
    if (data.deductible_against !== undefined) update.deductible_against = data.deductible_against;
    if (data.deductible_window_days !== undefined) update.deductible_window_days = data.deductible_window_days;

    const { data: treatment, error } = await supabase
      .from("treatments")
      .update(update)
      .eq("id", data.id)
      .select()
      .single();
    if (error) throw error;
    return treatment;
  });

export const deleteTreatment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase.from("treatments").delete().eq("id", data.id);
    if (error) throw error;
    return { success: true };
  });

export const getTreatmentsBySlug = createServerFn({ method: "GET" })
  .inputValidator((input: { slug: string }) => input)
  .handler(async ({ data }) => {
    const supabase = getServerSupabasePublic();
    const { data: profile, error: pErr } = await supabase
      .rpc("get_public_profile_by_slug", { p_slug: data.slug.toLowerCase() })
      .single();
    if (pErr) throw pErr;
    const { data: treatments, error } = await supabase
      .from("treatments")
      .select("*")
      .eq("profile_id", profile.id)
      .eq("active", true)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return treatments;
  });

