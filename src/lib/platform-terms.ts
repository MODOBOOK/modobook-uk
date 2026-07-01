import { supabase } from "@/integrations/supabase/client";

export type ActiveTerms = {
  id: string;
  version: number;
  title: string;
  body_markdown: string;
  effective_at: string;
};

export async function fetchActiveTerms(): Promise<ActiveTerms | null> {
  const { data, error } = await supabase
    .from("platform_terms")
    .select("id, version, title, body_markdown, effective_at")
    .eq("is_active", true)
    .maybeSingle();
  if (error) throw error;
  return (data as ActiveTerms | null) ?? null;
}

export async function hasAcceptedCurrentTerms(): Promise<boolean> {
  const { data, error } = await supabase.rpc("has_accepted_current_terms");
  if (error) throw error;
  return Boolean(data);
}

async function hashIp(): Promise<string | null> {
  // We don't have a client-side IP; leave to server logs. Return null.
  return null;
}

export async function recordTermsAcceptance(termsId: string, context: string): Promise<void> {
  const userAgent =
    typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 500) : undefined;
  const ipHash = (await hashIp()) ?? undefined;
  const { error } = await supabase.rpc("record_platform_terms_acceptance", {
    p_terms_id: termsId,
    p_user_agent: userAgent,
    p_ip_hash: ipHash,
    p_context: context,
  });
  if (error) throw error;
}
