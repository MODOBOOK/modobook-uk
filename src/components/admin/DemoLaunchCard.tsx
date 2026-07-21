import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { PlayCircle, RefreshCw, Sparkles, User, Users } from "lucide-react";
import { ensureDemoSetup, launchDemoSession, resetDemoNow } from "@/lib/demo.functions";

export function DemoLaunchCard() {
  const ensure = useServerFn(ensureDemoSetup);
  const launch = useServerFn(launchDemoSession);
  const reset = useServerFn(resetDemoNow);
  const [busy, setBusy] = useState<string | null>(null);

  async function launchAs(role: "practitioner" | "patient") {
    setBusy(role);
    try {
      const r = await launch({ data: { role } });
      window.open(r.url, "_blank", "noopener");
      toast.success(`Demo ${role} session opened in a new tab`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to launch demo");
    } finally {
      setBusy(null);
    }
  }

  async function doEnsure() {
    setBusy("ensure");
    try {
      await ensure();
      toast.success("Demo clinic ready");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Setup failed");
    } finally {
      setBusy(null);
    }
  }

  async function doReset() {
    if (!confirm("Reset the demo clinic to its baseline? All demo activity will be cleared.")) return;
    setBusy("reset");
    try {
      await reset();
      toast.success("Demo clinic reset");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Reset failed");
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-amber-500" /> Live demo clinic
          <Badge variant="secondary" className="ml-2">Zoom-ready</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          One-click sign-in to a fully seeded practitioner or patient account.
          Real emails, SMS and Stripe charges are blocked for demo profiles.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => launchAs("practitioner")} disabled={busy !== null}>
            <PlayCircle className="mr-1 h-4 w-4" />
            Launch as practitioner
          </Button>
          <Button variant="outline" onClick={() => launchAs("patient")} disabled={busy !== null}>
            <User className="mr-1 h-4 w-4" /> Launch as patient
          </Button>
          <Button variant="ghost" onClick={doEnsure} disabled={busy !== null}>
            <Users className="mr-1 h-4 w-4" /> Ensure setup
          </Button>
          <Button variant="ghost" onClick={doReset} disabled={busy !== null}>
            <RefreshCw className="mr-1 h-4 w-4" /> Reset now
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          The demo resets automatically each night. Manual reset restores the baseline immediately.
        </p>
      </CardContent>
    </Card>
  );
}
