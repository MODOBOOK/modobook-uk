import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ShieldCheck, Copy, AlertTriangle, CheckCircle2, Stethoscope, ClipboardCheck } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { getHubContext, ensureHubCode } from "@/lib/hub.functions";
import { formatHubCode } from "@/lib/hub-format";

export const Route = createFileRoute("/_authenticated/hub/")({
  ssr: false,
  component: HubIndex,
});

const CHOICE_KEY = "hub-role-choice-v1";

function HubIndex() {
  const navigate = useNavigate();
  const getCtx = useServerFn(getHubContext);
  const ensure = useServerFn(ensureHubCode);
  const [ctx, setCtx] = useState<Awaited<ReturnType<typeof getHubContext>> | null>(null);
  const [code, setCode] = useState<string | null>(null);
  const [blocked, setBlocked] = useState<string | null>(null);
  const [showChooser, setShowChooser] = useState(false);

  useEffect(() => {
    (async () => {
      const c = await getCtx();
      setCtx(c);
      const r = await ensure();
      setCode(r.code);
      setBlocked(r.blockedReason);
      const chosen = typeof window !== "undefined" ? window.localStorage.getItem(CHOICE_KEY) : "1";
      if (!chosen && !c.prescriber) setShowChooser(true);
    })().catch((e) => toast.error(e.message));
  }, [getCtx, ensure]);

  if (!ctx) return <div className="p-6 text-sm text-muted-foreground">Loading…</div>;

  const status = ctx.prescriber?.status;

  const choosePractitioner = () => {
    window.localStorage.setItem(CHOICE_KEY, "practitioner");
    setShowChooser(false);
    toast.success("You're set up as a practitioner");
  };
  const choosePrescriber = () => {
    window.localStorage.setItem(CHOICE_KEY, "prescriber");
    setShowChooser(false);
    navigate({ to: "/hub/verification" });
  };

  return (
    <div className="space-y-6">
      <Dialog open={showChooser} onOpenChange={(open) => { if (open) setShowChooser(true); }}>
        <DialogContent className="sm:max-w-lg" onInteractOutside={(e) => e.preventDefault()} onEscapeKeyDown={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>Are you a practitioner or a prescriber?</DialogTitle>
            <DialogDescription>
              Choose how you'll use the Prescriber Hub. Practitioners get instant access; prescribers are verified first.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={choosePractitioner}
              className="rounded-lg border p-4 text-left transition hover:border-primary hover:bg-primary/5"
            >
              <Stethoscope className="mb-2 h-5 w-5 text-primary" />
              <div className="font-medium">I'm a practitioner</div>
              <p className="mt-1 text-xs text-muted-foreground">
                Instant access. Connect with prescribers and send referrals.
              </p>
            </button>
            <button
              type="button"
              onClick={choosePrescriber}
              className="rounded-lg border p-4 text-left transition hover:border-primary hover:bg-primary/5"
            >
              <ClipboardCheck className="mb-2 h-5 w-5 text-primary" />
              <div className="font-medium">I'm a prescriber</div>
              <p className="mt-1 text-xs text-muted-foreground">
                Verification required — upload your registration and ID.
              </p>
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {ctx.role === "none" && !showChooser && (
        <Card>
          <CardHeader>
            <CardTitle>Choose your account type</CardTitle>
            <CardDescription>Pick how you want to use the Prescriber Hub.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            <Button onClick={choosePractitioner}>I'm a practitioner</Button>
            <Button variant="outline" onClick={choosePrescriber}>I'm a prescriber</Button>
          </CardContent>
        </Card>
      )}

      {ctx.role === "prescriber" && status !== "approved" && (
        <Card className="border-amber-300/50 bg-amber-50/40 dark:bg-amber-950/20">
          <CardHeader className="flex flex-row items-start gap-3 space-y-0">
            <AlertTriangle className="mt-1 h-5 w-5 text-amber-600" />
            <div>
              <CardTitle className="text-base">
                {status === "pending" && "Verification in review"}
                {status === "more_info" && "More info requested"}
                {status === "rejected" && "Verification rejected"}
                {!status && "Verification required"}
              </CardTitle>
              <CardDescription>
                {status === "pending" && "Our team is reviewing your documents — usually 1–2 working days."}
                {status === "more_info" && (ctx.prescriber?.admin_note ?? "Please update your submission.")}
                {status === "rejected" && (ctx.prescriber?.admin_note ?? "We were unable to verify your registration.")}
                {!status && "Submit your verification to unlock the Hub."}
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <Link to="/hub/verification">
              <Button size="sm" variant="outline">
                {status ? "Update verification" : "Start verification"}
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldCheck className="h-4 w-4 text-primary" />
              Your hub code
            </CardTitle>
            <CardDescription>Share this with the person you want to connect with.</CardDescription>
          </CardHeader>
          <CardContent>
            {code ? (
              <div className="flex items-center gap-2">
                <code className="rounded-md border bg-muted/40 px-3 py-2 font-mono text-lg tracking-widest">
                  {formatHubCode(code)}
                </code>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    navigator.clipboard.writeText(formatHubCode(code));
                    toast.success("Copied");
                  }}
                >
                  <Copy className="mr-1 h-3 w-3" /> Copy
                </Button>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">{blocked ?? "Generating…"}</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Connect</CardTitle>
            <CardDescription>Enter a hub code to send a connection request.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Link to="/hub/connections"><Button className="w-full">Manage connections</Button></Link>
            {ctx.role === "prescriber" && status === "approved" && (
              <p className="flex items-start gap-2 text-xs text-muted-foreground">
                <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 text-emerald-600" />
                You are verified and visible in the Hub.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
