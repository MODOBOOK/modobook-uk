import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import {
  ShieldCheck,
  Copy,
  AlertTriangle,
  CheckCircle2,
  Stethoscope,
  ClipboardCheck,
  CalendarDays,
  Send,
  Network,
  Pill,
  ArrowRight,
} from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { getHubContext, ensureHubCode } from "@/lib/hub.functions";
import { listMyClinicVisits } from "@/lib/clinic-visits.functions";
import { listSentReferrals, listMyConnectedPrescribers } from "@/lib/prescriber.functions";
import { formatHubCode } from "@/lib/hub-format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/hub/")({
  ssr: false,
  component: HubIndex,
});

const CHOICE_KEY = "hub-role-choice-v1";

function HubIndex() {
  const navigate = useNavigate();
  const getCtx = useServerFn(getHubContext);
  const ensure = useServerFn(ensureHubCode);
  const fetchVisits = useServerFn(listMyClinicVisits);
  const fetchRefs = useServerFn(listSentReferrals);
  const fetchPrescribers = useServerFn(listMyConnectedPrescribers);

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

  const visitsQ = useQuery({ queryKey: ["hub-overview-visits"], queryFn: () => fetchVisits() });
  const refsQ = useQuery({ queryKey: ["hub-overview-refs"], queryFn: () => fetchRefs() });
  const prescQ = useQuery({ queryKey: ["hub-overview-presc"], queryFn: () => fetchPrescribers() });

  if (!ctx) return <div className="p-6 text-sm text-muted-foreground">Loading…</div>;

  const status = ctx.prescriber?.status;
  const visits = visitsQ.data ?? [];
  const refs = refsQ.data ?? [];
  const prescribers = prescQ.data ?? [];

  const upcoming = visits
    .filter((v) => v.status !== "cancelled" && v.visit_date >= new Date().toISOString().slice(0, 10))
    .sort((a, b) => (a.visit_date + a.start_time).localeCompare(b.visit_date + b.start_time));
  const awaitingConfirm = upcoming.filter((v) => !v.confirmed_by_prescriber && v.status !== "pending_approval").length;
  const pendingRefs = refs.filter((r) => r.status === "pending").length;

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

  const actions: Array<{
    to: string;
    icon: typeof CalendarDays;
    title: string;
    desc: string;
    accent: string;
    disabled?: boolean;
    disabledHint?: string;
  }> = [
    {
      to: "/hub/visits",
      icon: CalendarDays,
      title: "Request prescriber days",
      desc: "Pick dates for a prescriber to be in your clinic. They confirm from their end.",
      accent: "from-amber-100 to-amber-50 text-amber-900",
      disabled: prescribers.length === 0,
      disabledHint: "Connect a prescriber first",
    },
    {
      to: "/hub/referrals",
      icon: Send,
      title: "Send a referral",
      desc: "Route a patient to a prescriber for POM sign-off — with medical & consent history.",
      accent: "from-rose-100 to-rose-50 text-rose-900",
      disabled: prescribers.length === 0,
      disabledHint: "Connect a prescriber first",
    },
    {
      to: "/hub/connections",
      icon: Network,
      title: "Manage prescribers",
      desc: "Add a prescriber with their PR code, or share your RX code with a new one.",
      accent: "from-sky-100 to-sky-50 text-sky-900",
    },
    {
      to: "/hub/prescribing",
      icon: Pill,
      title: "Prescribing rules",
      desc: "Set which treatments need a prescriber and how patients are routed.",
      accent: "from-emerald-100 to-emerald-50 text-emerald-900",
    },
  ] as const;

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

      {/* Hero: hub code + stats */}
      <Card className="overflow-hidden border-primary/20 bg-gradient-to-br from-primary/5 via-background to-background">
        <CardContent className="grid gap-6 p-5 sm:p-6 lg:grid-cols-[1.2fr_1fr] lg:gap-10">
          <div className="space-y-4">
            <div>
              <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
                <ShieldCheck className="h-3 w-3" /> Your hub code
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                Share this with a prescriber so they can connect to your clinic.
              </p>
            </div>
            {code ? (
              <div className="flex flex-wrap items-center gap-2">
                <code className="rounded-lg border bg-background px-4 py-3 font-mono text-xl tracking-[0.3em] shadow-sm">
                  {formatHubCode(code)}
                </code>
                <Button
                  variant="outline"
                  onClick={() => {
                    navigator.clipboard.writeText(formatHubCode(code));
                    toast.success("Copied");
                  }}
                >
                  <Copy className="mr-2 h-4 w-4" /> Copy
                </Button>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">{blocked ?? "Generating…"}</p>
            )}
            {ctx.role === "prescriber" && status === "approved" && (
              <p className="flex items-start gap-2 text-xs text-muted-foreground">
                <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 text-emerald-600" />
                You are verified and visible in the Hub.
              </p>
            )}
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Stat label="Prescribers" value={prescribers.length} />
            <Stat label="Upcoming days" value={upcoming.length} accent={awaitingConfirm > 0} />
            <Stat label="Open referrals" value={pendingRefs} accent={pendingRefs > 0} />
          </div>
        </CardContent>
      </Card>

      {/* Quick actions */}
      <section>
        <h2 className="mb-3 font-serif text-lg">What would you like to do?</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {actions.map((a) => {
            const body = (
              <Card
                className={cn(
                  "group h-full overflow-hidden border transition-all",
                  a.disabled ? "opacity-60" : "hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md",
                )}
              >
                <CardContent className="flex h-full gap-4 p-4 sm:p-5">
                  <div className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br", a.accent)}>
                    <a.icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="font-semibold">{a.title}</h3>
                      <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-foreground" />
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{a.desc}</p>
                    {a.disabled && (
                      <p className="mt-2 text-[11px] font-medium text-amber-700">{a.disabledHint}</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
            return a.disabled ? (
              <div key={a.to}>{body}</div>
            ) : (
              <Link key={a.to} to={a.to} className="block">
                {body}
              </Link>
            );
          })}
        </div>
      </section>

      {/* Upcoming clinic days */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-serif text-lg">Upcoming clinic days</h2>
          <Link to="/hub/visits" className="text-xs font-medium text-primary hover:underline">
            View all
          </Link>
        </div>
        {upcoming.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-center text-sm text-muted-foreground">
              <CalendarDays className="mx-auto mb-2 h-8 w-8 opacity-60" />
              No clinic days scheduled yet.
              {prescribers.length > 0 && (
                <>
                  <br />
                  <Link to="/hub/visits" className="mt-2 inline-block font-medium text-primary hover:underline">
                    Request a prescriber day →
                  </Link>
                </>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {upcoming.slice(0, 3).map((v) => (
              <Card key={v.id}>
                <CardContent className="flex items-center justify-between gap-3 p-4">
                  <div className="min-w-0">
                    <p className="font-medium">
                      {formatDate(v.visit_date)} · {v.start_time.slice(0, 5)}–{v.end_time.slice(0, 5)}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {v.prescriber_name}
                      {v.location_name ? ` · ${v.location_name}` : ""}
                    </p>
                  </div>
                  {v.status === "pending_approval" ? (
                    <Badge variant="outline" className="border-amber-400 text-amber-700">Pending</Badge>
                  ) : v.confirmed_by_prescriber ? (
                    <Badge className="bg-emerald-600">Confirmed</Badge>
                  ) : (
                    <Badge variant="outline">Awaiting prescriber</Badge>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value, accent = false }: { label: string; value: number; accent?: boolean }) {
  return (
    <div
      className={cn(
        "rounded-xl border bg-background/60 p-3 text-center backdrop-blur",
        accent && "border-primary/40",
      )}
    >
      <div className={cn("font-serif text-2xl", accent && "text-primary")}>{value}</div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
    </div>
  );
}

function formatDate(s: string) {
  return new Date(s + "T00:00:00").toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}
