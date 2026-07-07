import { useEffect, useRef, useState } from "react";
import { authenticateBiometric, isNativeAppSync } from "@/lib/native";
import { Button } from "@/components/ui/button";
import { Lock } from "lucide-react";

const STORAGE_KEY = "modo:faceid:required";
const LAST_ACTIVE_KEY = "modo:lastActive";
const RELOCK_MS = 5 * 60 * 1000; // re-prompt after 5 min in background

export function faceIdRequired(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(STORAGE_KEY) === "1";
}

export function setFaceIdRequired(v: boolean) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, v ? "1" : "0");
}

/**
 * On native, prompts Face ID on cold start and after >5 min in background.
 * Renders children immediately on web (no-op).
 */
export function FaceIdGate({ children }: { children: React.ReactNode }) {
  const [unlocked, setUnlocked] = useState(!isNativeAppSync() || !faceIdRequired());
  const [failed, setFailed] = useState(false);
  const attempting = useRef(false);

  async function tryUnlock() {
    if (attempting.current) return;
    attempting.current = true;
    setFailed(false);
    const ok = await authenticateBiometric("Unlock Modo Practitioner");
    attempting.current = false;
    if (ok) {
      setUnlocked(true);
      localStorage.setItem(LAST_ACTIVE_KEY, String(Date.now()));
    } else {
      setFailed(true);
    }
  }

  useEffect(() => {
    if (!isNativeAppSync() || !faceIdRequired()) return;
    void tryUnlock();

    let lastActive = Date.now();
    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        lastActive = Date.now();
        localStorage.setItem(LAST_ACTIVE_KEY, String(lastActive));
      } else if (Date.now() - lastActive > RELOCK_MS) {
        setUnlocked(false);
        void tryUnlock();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  if (unlocked) return <>{children}</>;

  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-6 bg-[#F5EFE6] p-6 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Lock className="h-7 w-7" />
      </div>
      <div>
        <h1 className="font-serif text-2xl">Modo Practitioner</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {failed ? "Authentication cancelled. Tap unlock to try again." : "Authenticating…"}
        </p>
      </div>
      <Button onClick={tryUnlock}>Unlock with Face ID</Button>
    </div>
  );
}
