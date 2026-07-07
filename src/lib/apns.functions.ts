import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Register (or refresh) a device APNs token for the current user.
 * Stored in device_push_tokens with a (user_id, token) unique constraint.
 */
export const registerDevicePushToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({
      token: z.string().min(10),
      platform: z.enum(["ios", "android"]),
    }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("device_push_tokens")
      .upsert(
        { user_id: userId, token: data.token, platform: data.platform, last_seen_at: new Date().toISOString() },
        { onConflict: "user_id,token" },
      );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Remove a token (e.g. on sign-out or permission revocation). */
export const unregisterDevicePushToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ token: z.string() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await supabase.from("device_push_tokens").delete().eq("user_id", userId).eq("token", data.token);
    return { ok: true };
  });

/**
 * Export the signed-in user's own account data as JSON (GDPR right of access).
 * Only pulls records where the user is the direct subject; patient data is
 * exported separately through the clinic export flow.
 */
export const exportMyAccountData = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const profile = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
    const tokens = await supabase
      .from("device_push_tokens")
      .select("platform,last_seen_at,created_at")
      .eq("user_id", userId);
    const acceptances = await (supabase as unknown as { from: (t: string) => { select: (c: string) => { eq: (k: string, v: string) => Promise<{ data: unknown[] | null }> } } })
      .from("terms_acceptances")
      .select("*")
      .eq("user_id", userId);
    return {
      json: JSON.stringify({
        exported_at: new Date().toISOString(),
        user_id: userId,
        profile: profile.data ?? null,
        device_tokens: tokens.data ?? [],
        terms_acceptances: acceptances.data ?? [],
      }, null, 2),
    };
  });

/**
 * Request account deletion. Marks the profile for deletion; the actual
 * purge runs on a 30-day schedule to allow recovery of accidental requests
 * (satisfies UK GDPR Art. 17 without immediate irreversible loss).
 */
export const requestAccountDeletion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ confirm: z.literal(true) }).parse(data))
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("profiles")
      .update({ deletion_requested_at: new Date().toISOString() })
      .eq("id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
