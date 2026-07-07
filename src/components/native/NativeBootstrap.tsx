import { useEffect } from "react";
import { isNativeAppSync, registerPushToken } from "@/lib/native";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { registerDevicePushToken } from "@/lib/apns.functions";

/**
 * Mounted once inside the authenticated shell. On native, it registers
 * the device for APNs push and stores the token against the current user.
 */
export function NativeBootstrap() {
  const register = useServerFn(registerDevicePushToken);

  useEffect(() => {
    if (!isNativeAppSync()) return;
    let cancelled = false;

    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user || cancelled) return;
      const token = await registerPushToken();
      if (!token || cancelled) return;
      try { await register({ data: { token, platform: "ios" } }); } catch { /* ignore */ }
    })();

    return () => { cancelled = true; };
  }, [register]);

  return null;
}
