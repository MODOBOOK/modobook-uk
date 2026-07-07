import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { TermsAcceptanceGate } from "@/components/TermsAcceptanceGate";
import { FaceIdGate } from "@/components/native/FaceIdGate";
import { NativeBootstrap } from "@/components/native/NativeBootstrap";
import { FirstRunConsent } from "@/components/native/FirstRunConsent";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      throw redirect({ to: "/auth" });
    }
    return { user: data.user };
  },
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  return (
    <FaceIdGate>
      <TermsAcceptanceGate />
      <FirstRunConsent />
      <NativeBootstrap />
      <Outlet />
    </FaceIdGate>
  );
}
