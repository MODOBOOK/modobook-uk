import { useEffect, useState } from "react";
import { BellRing, BellOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  enablePush,
  disablePush,
  getPushState,
  pushSupported,
} from "@/lib/push-client";

/** Compact inline "Enable booking alerts" toggle. */
export function PushToggle({ className = "" }: { className?: string }) {
  const [state, setState] = useState<"unsupported" | "denied" | "granted" | "prompt" | "loading">("loading");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!pushSupported()) {
      setState("unsupported");
      return;
    }
    getPushState().then(setState);
  }, []);

  if (state === "loading") return null;
  if (state === "unsupported") {
    return (
      <div className={`text-[11px] text-muted-foreground ${className}`}>
        Device alerts aren't supported in this browser. On iPhone, install MODO to your home screen first.
      </div>
    );
  }

  async function handleEnable() {
    setBusy(true);
    const r = await enablePush();
    setBusy(false);
    if (r.ok) {
      setState("granted");
      toast.success("Device alerts enabled — you'll be notified for new bookings.");
    } else {
      toast.error(r.reason || "Couldn't enable alerts");
      setState(await getPushState());
    }
  }

  async function handleDisable() {
    setBusy(true);
    await disablePush();
    setBusy(false);
    setState("prompt");
    toast.success("Device alerts turned off");
  }

  const enabled = state === "granted";
  return (
    <div className={`flex items-center justify-between gap-2 ${className}`}>
      <div className="min-w-0">
        <div className="text-xs font-semibold">Device alerts</div>
        <div className="text-[10px] text-muted-foreground">
          {enabled
            ? "You'll get a push notification for new bookings on this device."
            : state === "denied"
              ? "Blocked. Allow notifications in your browser settings."
              : "Get a push notification the moment a booking comes in."}
        </div>
      </div>
      {enabled ? (
        <Button size="sm" variant="ghost" className="h-8 gap-1 text-xs" onClick={handleDisable} disabled={busy}>
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <BellOff className="h-3.5 w-3.5" />}
          Off
        </Button>
      ) : (
        <Button
          size="sm"
          className="h-8 gap-1 text-xs"
          onClick={handleEnable}
          disabled={busy || state === "denied"}
        >
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <BellRing className="h-3.5 w-3.5" />}
          Enable
        </Button>
      )}
    </div>
  );
}
