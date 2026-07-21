import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data, error } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (error) throw error;
  if (!data) throw new Error("Forbidden");
}

/**
 * Idempotently create the demo practitioner + patient auth users, the demo
 * profile, and a small seeded set of content so admins can run a live demo.
 * Safe to call repeatedly.
 */
export const ensureDemoSetup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { seedDemoClinic } = await import("./demo-seed.server");
    const result = await seedDemoClinic(supabaseAdmin);
    return result;
  });

/**
 * Generate a magic sign-in link for a demo account.
 * Returns a URL the admin can open in an incognito window / on a Zoom share.
 */
export const launchDemoSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { role: "practitioner" | "patient"; origin?: string }) => i)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { seedDemoClinic } = await import("./demo-seed.server");
    // Ensure accounts exist before minting a link.
    await seedDemoClinic(supabaseAdmin);
    const { DEMO_PRACTITIONER_EMAIL, DEMO_PATIENT_EMAIL, DEMO_SLUG } = await import("./demo.server");
    const email = data.role === "practitioner" ? DEMO_PRACTITIONER_EMAIL : DEMO_PATIENT_EMAIL;
    const origin = (data.origin || "https://modobook.uk").replace(/\/$/, "");
    const path = data.role === "practitioner" ? "/dashboard" : `/m/${DEMO_SLUG}/account`;
    const redirectTo = `${origin}${path}`;

    const { data: link, error } = await (supabaseAdmin as any).auth.admin.generateLink({
      type: "magiclink",
      email,
      options: { redirectTo },
    });
    if (error) throw new Error(`Auth: ${error.message}`);
    const url = (link as any)?.properties?.action_link as string | undefined;
    if (!url) throw new Error("Failed to generate demo link");
    return { url, email, role: data.role };
  });

/**
 * Wipe transient demo data (appointments/consultations/notes) and re-seed to
 * the baseline. Also used by the nightly cron.
 */
export const resetDemoNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { resetDemoClinic } = await import("./demo-seed.server");
    return await resetDemoClinic(supabaseAdmin);
  });
