import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Public VAPID key — safe to expose. */
export const getVapidPublicKey = createServerFn({ method: "GET" }).handler(async () => {
  return { publicKey: process.env.VAPID_PUBLIC_KEY ?? "" };
});

/** Register a browser push subscription for the current user. */
export const savePushSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { endpoint: string; p256dh: string; auth: string; userAgent?: string }) => {
    if (!d.endpoint || !d.p256dh || !d.auth) throw new Error("Invalid subscription");
    return d;
  })
  .handler(async ({ data, context }) => {
    // Upsert on endpoint (unique). Ensure ownership becomes current user if endpoint moved.
    const supa = context.supabase as unknown as {
      from: (t: string) => {
        upsert: (row: Record<string, unknown>, opts: { onConflict: string }) => Promise<{ error: unknown }>;
        delete: () => { eq: (c: string, v: string) => Promise<unknown> };
      };
    };
    const { error } = await supa
      .from("push_subscriptions")
      .upsert(
        {
          user_id: context.userId,
          endpoint: data.endpoint,
          p256dh: data.p256dh,
          auth: data.auth,
          user_agent: data.userAgent ?? null,
          last_seen_at: new Date().toISOString(),
        },
        { onConflict: "endpoint" },
      );
    if (error) throw error;

    // Sync the DB-side push dispatch secret to the current env value so the DB
    // trigger can authenticate against our public /api/public/push/dispatch route.
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const secret = process.env.PUSH_DISPATCH_SECRET;
      if (secret) {
        await supabaseAdmin
          .from("push_dispatch_config")
          .update({ secret, updated_at: new Date().toISOString() })
          .eq("id", true);
      }
    } catch (_) {}

    return { ok: true };
  });

export const deletePushSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { endpoint: string }) => d)
  .handler(async ({ data, context }) => {
    await (context.supabase as unknown as { from: (t: string) => { delete: () => { eq: (c: string, v: string) => Promise<unknown> } } })
      .from("push_subscriptions").delete().eq("endpoint", data.endpoint);
    return { ok: true };
  });
