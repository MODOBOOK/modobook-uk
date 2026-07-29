import { createServerFn } from "@tanstack/react-start";

/**
 * PUBLIC demo launcher — no auth required.
 *
 * Mints a one-time magic sign-in link for the shared MODO demo clinic so
 * anyone can explore the practitioner dashboard or the patient account.
 * The demo clinic is sandboxed: outbound email is blocked for demo profiles
 * (see src/lib/email/send.server.ts) and the whole clinic resets nightly via
 * /api/public/hooks/demo-reset.
 */
export const startPublicDemo = createServerFn({ method: "POST" })
  .validator((i: { role: "practitioner" | "patient"; origin?: string }) => {
    if (i.role !== "practitioner" && i.role !== "patient") throw new Error("Invalid demo role");
    return { role: i.role, origin: i.origin };
  })
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { seedDemoClinic } = await import("./demo-seed.server");
    const { DEMO_PRACTITIONER_EMAIL, DEMO_PATIENT_EMAIL, DEMO_SLUG } = await import("./demo.server");

    try {
      await seedDemoClinic(supabaseAdmin);
    } catch (error) {
      console.error("Public demo seed failed", error);
      throw new Error("The demo clinic is being rebuilt — please try again in a moment.");
    }

    const email = data.role === "practitioner" ? DEMO_PRACTITIONER_EMAIL : DEMO_PATIENT_EMAIL;
    const origin = (data.origin || "https://modobook.uk").replace(/\/$/, "");
    const path = data.role === "practitioner" ? "/dashboard" : `/m/${DEMO_SLUG}/account`;

    const { data: link, error } = await (supabaseAdmin as any).auth.admin.generateLink({
      type: "magiclink",
      email,
      options: { redirectTo: `${origin}${path}` },
    });
    if (error) throw new Error(`Auth: ${error.message}`);
    const url = (link as any)?.properties?.action_link as string | undefined;
    if (!url) throw new Error("Could not open the demo right now — please try again.");
    return { url, role: data.role };
  });
