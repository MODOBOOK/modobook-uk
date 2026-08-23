import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

async function __activeProfileId(supabase: any, userId: string) {
  const { activeProfileId } = await import("./clinic-context.server");
  return (await activeProfileId(supabase, userId)) ?? "00000000-0000-0000-0000-000000000000";
}

function serverPublic() {
  return createClient<Database>(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
  );
}

export const getMyQuizConfig = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("profiles")
      .select("id, quiz_enabled, quiz_intro, quiz_outro, chooser_consultation_treatment_id")
      .eq("id", await __activeProfileId(context.supabase, context.userId))
      .single();
    if (error) throw error;
    return data;
  });

export const saveQuizConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: {
    quiz_enabled?: boolean;
    quiz_intro?: string | null;
    quiz_outro?: string | null;
  }) => input)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("profiles")
      .update(data)
      .eq("id", await __activeProfileId(context.supabase, context.userId));
    if (error) throw error;
    return { ok: true };
  });

export const saveTreatmentQuizTags = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; quiz_tags: Record<string, string[]> }) => input)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("treatments")
      .update({ quiz_tags: data.quiz_tags })
      .eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

export const getQuizBySlug = createServerFn({ method: "GET" })
  .inputValidator((input: { slug: string }) => input)
  .handler(async ({ data }) => {
    const sb = serverPublic();
    const { data: cfg, error: cErr } = await sb
      .rpc("get_quiz_config_by_slug", { p_slug: data.slug.toLowerCase() })
      .single();
    if (cErr) throw cErr;
    if (!cfg?.quiz_enabled) return { config: cfg, treatments: [] as Array<{ id: string; name: string; description: string | null; duration: number; price: number; picture_url: string | null; session_count: number | null; session_interval_days: number | null; quiz_tags: Record<string, string[]> }> };
    const { data: treatments, error: tErr } = await sb
      .from("treatments")
      .select("id, name, description, duration, price, picture_url, session_count, session_interval_days, quiz_tags")
      .eq("profile_id", cfg.profile_id)
      .eq("active", true);
    if (tErr) throw tErr;
    return { config: cfg, treatments: treatments ?? [] };
  });

export const submitQuizResponse = createServerFn({ method: "POST" })
  .inputValidator((input: {
    profile_id: string;
    answers: Record<string, string[]>;
    recommended_treatment_ids: string[];
    patient_email?: string;
    patient_name?: string;
  }) => input)
  .handler(async ({ data }) => {
    const sb = serverPublic();
    const { error } = await sb.from("quiz_responses").insert({
      profile_id: data.profile_id,
      answers: data.answers,
      recommended_treatment_ids: data.recommended_treatment_ids,
      patient_email: data.patient_email ?? null,
      patient_name: data.patient_name ?? null,
    });
    if (error) throw error;
    return { ok: true };
  });

export const listMyQuizResponses = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: profile } = await context.supabase
      .from("profiles").select("id").eq("id", await __activeProfileId(context.supabase, context.userId)).single();
    if (!profile) return [];
    const { data, error } = await context.supabase
      .from("quiz_responses")
      .select("*")
      .eq("profile_id", profile.id)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw error;
    return data ?? [];
  });
