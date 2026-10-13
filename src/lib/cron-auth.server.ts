/**
 * Verifies scheduled-job requests to /api/public/hooks/*. The scheduler sends
 * a private `x-cron-secret` header held only in the database; the public
 * publishable key is NOT accepted.
 */
export async function isAuthorizedCron(request: Request): Promise<boolean> {
  const provided = request.headers.get("x-cron-secret");
  if (!provided || provided.length < 32) return false;
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await (supabaseAdmin as any).rpc("verify_cron_secret", { p_secret: provided });
    if (error) {
      console.error("cron auth check failed", error);
      return false;
    }
    return data === true;
  } catch (e) {
    console.error("cron auth check failed", e);
    return false;
  }
}

export function unauthorizedCron(): Response {
  return new Response("Unauthorized", { status: 401 });
}
