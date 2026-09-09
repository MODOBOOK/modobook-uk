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

    const email = data.role === "practitioner" ? DEMO_PRACTITIONER_EMAIL : DEMO_PATIENT_EMAIL;

    // Seeding is best-effort: if the demo accounts already exist we can still
    // sign the visitor in, even when a single seed step fails.
    let seedError: unknown = null;
    try {
      await seedDemoClinic(supabaseAdmin);
    } catch (error) {
      seedError = error;
      console.error("Public demo seed failed", error);
    }

    const rawOrigin = (data.origin || "").replace(/\/$/, "");
    // Supabase only redirects back to allow-listed public hosts; anything else
    // (localhost, unknown preview host) silently bounces to the site root.
    const origin = /^https:\/\/[a-z0-9.-]*(lovable\.app|modobook\.uk)$/i.test(rawOrigin)
      ? rawOrigin
      : "https://modobook.uk";
    const path = data.role === "practitioner" ? "/dashboard" : `/m/${DEMO_SLUG}/account`;

    async function mintLink() {
      const { data: link, error } = await (supabaseAdmin as any).auth.admin.generateLink({
        type: "magiclink",
        email,
        options: { redirectTo: `${origin}${path}` },
      });
      if (error) throw new Error(error.message);
      const url = (link as any)?.properties?.action_link as string | undefined;
      if (!url) throw new Error("No sign-in link returned");
      return url;
    }

    try {
      return { url: await mintLink(), role: data.role };
    } catch (first) {
      console.error("Demo link attempt 1 failed", first);
      await new Promise((r) => setTimeout(r, 800));
      try {
        return { url: await mintLink(), role: data.role };
      } catch (second) {
        console.error("Demo link attempt 2 failed", second);
        throw new Error(
          seedError
            ? "The demo clinic is being rebuilt — please try again in a moment."
            : "Could not open the demo right now — please try again.",
        );
      }
    }
  });
