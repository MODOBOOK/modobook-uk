import { createFileRoute } from "@tanstack/react-router";

/**
 * Nightly cron to reset the demo clinic. Authenticated via the Supabase
 * anon key in the `apikey` header (matches other public hooks).
 */
export const Route = createFileRoute("/api/public/hooks/demo-reset")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apikey = request.headers.get("apikey");
        if (!apikey || apikey !== process.env.SUPABASE_PUBLISHABLE_KEY) {
          return new Response("Unauthorized", { status: 401 });
        }
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { resetDemoClinic } = await import("@/lib/demo-seed.server");
        const result = await resetDemoClinic(supabaseAdmin);
        return Response.json(result);
      },
    },
  },
});
