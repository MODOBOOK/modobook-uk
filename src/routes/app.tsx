import { createFileRoute, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

/**
 * Entry point for the native iOS app. Capacitor loads this URL directly,
 * so we route practitioners straight into their hub / dashboard and send
 * unauthenticated users to sign in with a return path back to /app.
 */
export const Route = createFileRoute("/app")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) {
      throw redirect({ to: "/auth", search: { next: "/app" } as never });
    }
    // Prefer the practitioner hub if the user has verified prescriber access;
    // otherwise land on the clinic dashboard. Hub layout already handles role routing.
    throw redirect({ to: "/hub" });
  },
});
