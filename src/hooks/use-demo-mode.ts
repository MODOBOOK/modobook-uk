import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { getMyProfile } from "@/lib/profiles.functions";

/**
 * True when the signed-in practitioner is the shared MODO demo account.
 * Uses the same query key as the authenticated layout so it's cached.
 */
export function useIsDemo(): boolean {
  const fetchProfile = useServerFn(getMyProfile);
  const q = useQuery({
    queryKey: ["my-profile-demo-check"],
    queryFn: () => fetchProfile(),
    staleTime: 60_000,
  });
  return Boolean((q.data as { is_demo?: boolean } | undefined)?.is_demo);
}

export const DEMO_BLOCK_MESSAGE =
  "Uploads are disabled in the demo account. Please don't add any real patient files or photos.";

/**
 * Returns a guard: call it before an upload/write. Returns true when the
 * action is blocked (and shows a toast).
 */
export function useDemoGuard() {
  const isDemo = useIsDemo();
  return {
    isDemo,
    blocked: (message: string = DEMO_BLOCK_MESSAGE) => {
      if (!isDemo) return false;
      toast.error(message);
      return true;
    },
  };
}
