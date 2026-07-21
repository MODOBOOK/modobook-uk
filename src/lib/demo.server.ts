// Server-only demo mode helpers. Do NOT import from routes or *.functions.ts
// at module scope — load inside handlers with await import(...).

export const DEMO_PRACTITIONER_EMAIL = "demo-clinic@modo.demo";
export const DEMO_PATIENT_EMAIL = "demo-patient@modo.demo";
export const DEMO_SLUG = "demo-clinic";
export const DEMO_CLINIC_NAME = "MODO Demo Clinic";
export const DEMO_PRACTITIONER_NAME = "Dr Demo Practitioner";
export const DEMO_PATIENT_NAME = "Alex Demo";

/**
 * Returns true if the given profileId belongs to a demo clinic.
 * Cached per-invocation via a simple Map on globalThis so batched sends don't
 * hammer the DB.
 */
export async function isDemoProfile(profileId: string | null | undefined): Promise<boolean> {
  if (!profileId) return false;
  const g = globalThis as unknown as { __demoProfileCache?: Map<string, boolean> };
  if (!g.__demoProfileCache) g.__demoProfileCache = new Map();
  const cached = g.__demoProfileCache.get(profileId);
  if (cached !== undefined) return cached;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("profiles")
    .select("is_demo")
    .eq("id", profileId)
    .maybeSingle();
  const isDemo = Boolean(data?.is_demo);
  g.__demoProfileCache.set(profileId, isDemo);
  return isDemo;
}

/** True when the email is one of the reserved demo emails. */
export function isDemoEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const e = email.toLowerCase();
  return e === DEMO_PRACTITIONER_EMAIL || e === DEMO_PATIENT_EMAIL || e.endsWith("@modo.demo");
}
