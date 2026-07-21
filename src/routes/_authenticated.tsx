import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { getMyProfile } from "@/lib/profiles.functions";
import { TermsAcceptanceGate } from "@/components/TermsAcceptanceGate";
import { FaceIdGate } from "@/components/native/FaceIdGate";
import { NativeBootstrap } from "@/components/native/NativeBootstrap";
import { FirstRunConsent } from "@/components/native/FirstRunConsent";
import { DemoBanner } from "@/components/DemoBanner";

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
  const fetchProfile = useServerFn(getMyProfile);
  const q = useQuery({ queryKey: ["my-profile-demo-check"], queryFn: () => fetchProfile(), staleTime: 60_000 });
  const isDemo = Boolean((q.data as any)?.is_demo);
  return (
    <FaceIdGate>
      {isDemo && <DemoBanner role="practitioner" />}
      <TermsAcceptanceGate />
      <FirstRunConsent />
      <NativeBootstrap />
      <Outlet />
    </FaceIdGate>
  );
}

