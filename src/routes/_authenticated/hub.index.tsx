import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  ChevronRight,
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

  if (!ctx) {
    return (
      <div className="space-y-4">
        <div className="h-40 animate-pulse rounded-3xl bg-muted" />
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="h-24 animate-pulse rounded-3xl bg-muted" />
          <div className="h-24 animate-pulse rounded-3xl bg-muted" />
        </div>
      </div>
    );
  }

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
    disabled?: boolean;
    disabledHint?: string;
  }> = [
    {
      to: "/hub/visits",
      icon: CalendarDays,
      title: "Request prescriber days",
      desc: "Pick dates for a prescriber to be in your clinic.",
      disabled: prescribers.length === 0,
      disabledHint: "Connect a prescriber first",
    },
    {
      to: "/hub/referrals",
      icon: Send,
      title: "Send a referral",
      desc: "Route a patient for POM sign-off with full history.",
      disabled: prescribers.length === 0,
      disabledHint: "Connect a prescriber first",
    },
    {
      to: "/hub/connections",
      icon: Network,
      title: "Manage prescribers",
      desc: "Add a prescriber with their code, or share yours.",
    },
    {
      to: "/hub/prescribing",
      icon: Pill,
      title: "Prescribing rules",
      desc: "Choose which treatments need a prescriber.",
    },
  ];

  const pendingRefItems = refs.filter((r) => r.status === "pending");
  const awaitingVisits = upcoming.filter((v) => !v.confirmed_by_prescriber && v.status !== "pending_approval");
  const attentionCount = pendingRefItems.length + awaitingVisits.length;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
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
              className="rounded-2xl border p-4 text-left transition hover:border-primary hover:bg-primary/5"
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
              className="rounded-2xl border p-4 text-left transition hover:border-primary hover:bg-primary/5"
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

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-serif text-2xl sm:text-3xl">Overview</h2>
          <p className="text-sm text-muted-foreground">
            {attentionCount > 0
              ? `${attentionCount} thing${attentionCount === 1 ? "" : "s"} need your attention.`
              : "All clear. Nothing needs your attention."}
          </p>
        </div>
        <Link to="/hub/visits">
          <Button className="h-11 rounded-xl">+ Request prescriber day</Button>
        </Link>
      </div>

      {ctx.isPrescriber && status !== "approved" && (
        <div className="rounded-2xl border border-amber-300/60 bg-amber-50/70 p-4 dark:bg-amber-950/20 sm:p-5">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-amber-100 text-amber-700 dark:bg-amber-900/40">
              <AlertTriangle className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-semibold">
                {status === "pending" && "Verification in review"}
                {status === "more_info" && "More info requested"}
                {status === "rejected" && "Verification rejected"}
                {!status && "Verification required"}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {status === "pending" && "Our team is reviewing your documents — usually 1–2 working days."}
                {status === "more_info" && (ctx.prescriber?.admin_note ?? "Please update your submission.")}
                {status === "rejected" && (ctx.prescriber?.admin_note ?? "We were unable to verify your registration.")}
                {!status && "Submit your verification to unlock the Hub."}
              </p>
              <Link to="/hub/verification" className="mt-3 inline-block">
                <Button size="sm" variant="outline" className="rounded-full">
                  {status ? "Update verification" : "Start verification"}
                </Button>
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Hero: hub code */}
      <div className="overflow-hidden rounded-2xl bg-primary p-5 text-primary-foreground shadow-lg sm:p-7">
        <div className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.2em] opacity-80">
          <ShieldCheck className="h-3.5 w-3.5" /> Your hub code
        </div>
        <p className="mt-2 max-w-md text-sm opacity-85">
          {ctx.isPrescriber
            ? "Share this with a clinic so they can connect with you and send referrals."
            : "Share this with a prescriber so they can connect to your clinic."}
        </p>
        {code ? (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <code className="rounded-2xl bg-primary-foreground/15 px-4 py-3 font-mono text-xl tracking-[0.28em] sm:text-2xl">
              {formatHubCode(code)}
            </code>
            <Button
              variant="secondary"
              className="rounded-full"
              onClick={() => {
                navigator.clipboard.writeText(formatHubCode(code));
                toast.success("Copied");
              }}
            >
              <Copy className="mr-2 h-4 w-4" /> Copy
            </Button>
          </div>
        ) : (
          <p className="mt-4 text-sm opacity-80">{blocked ?? "Generating…"}</p>
        )}
        {ctx.isPrescriber && status === "approved" && (
          <p className="mt-3 flex items-start gap-2 text-xs opacity-85">
            <CheckCircle2 className="mt-0.5 h-3.5 w-3.5" />
            You are verified and visible in the Hub.
          </p>
        )}
      </div>

      {/* Action-needed board */}
      <div className="grid gap-3 md:grid-cols-2">
        <ActionCard
          tone="red"
          icon={<Send className="h-5 w-5" />}
          title="Referrals waiting for a response"
          items={pendingRefItems.map((r) => ({
            id: r.id,
            title: r.patient_name ?? "Patient",
            subtitle: `${r.treatment_name} · ${r.prescriber_name}`,
            href: "/hub/referrals",
          }))}
          empty="No referrals waiting."
          viewAll={{ href: "/hub/referrals", label: "Open referrals" }}
        />
        <ActionCard
          tone="amber"
          icon={<CalendarDays className="h-5 w-5" />}
          title="Clinic days awaiting confirmation"
          items={awaitingVisits.map((v) => ({
            id: v.id,
            title: `${formatDate(v.visit_date)} · ${v.start_time.slice(0, 5)}–${v.end_time.slice(0, 5)}`,
            subtitle: v.prescriber_name + (v.location_name ? ` · ${v.location_name}` : ""),
            href: "/hub/visits",
          }))}
          empty="No clinic days waiting."
          viewAll={{ href: "/hub/visits", label: "Open clinic days" }}
        />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile icon={<Network className="h-4 w-4" />} label="Prescribers" value={prescribers.length} href="/hub/connections" />
        <StatTile icon={<CalendarDays className="h-4 w-4" />} label="Clinic days" value={upcoming.length} href="/hub/visits" />
        <StatTile icon={<Send className="h-4 w-4" />} label="Referrals" value={pendingRefs} href="/hub/referrals" />
        <StatTile icon={<Pill className="h-4 w-4" />} label="Rules" value="Manage" href="/hub/prescribing" />
      </div>

      {/* Quick actions */}
      <section>
        <h2 className="mb-2.5 text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground">Quick actions</h2>
        <div className="grid gap-2.5 sm:grid-cols-2">
          {actions.map((a) => {
            const body = (
              <div
                className={cn(
                  "group flex h-full items-center gap-3.5 rounded-3xl border border-border/60 bg-card p-4 transition-all",
                  a.disabled ? "opacity-60" : "hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md",
                )}
              >
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <a.icon className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <h3 className="truncate text-[15px] font-semibold leading-tight">{a.title}</h3>
                  <p className="mt-0.5 text-xs leading-snug text-muted-foreground">{a.desc}</p>
                  {a.disabled && <p className="mt-1.5 text-[11px] font-medium text-amber-700">{a.disabledHint}</p>}
                </div>
                <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-foreground" />
              </div>
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
        <div className="mb-2.5 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Upcoming clinic days
          </h2>
          <Link to="/hub/visits" className="inline-flex items-center text-xs font-medium text-primary hover:underline">
            View all <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        </div>
        {upcoming.length === 0 ? (
          <Card className="rounded-3xl border-dashed">
            <CardContent className="p-6 text-center text-sm text-muted-foreground">
              <CalendarDays className="mx-auto mb-2 h-8 w-8 opacity-50" />
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
              <div
                key={v.id}
                className="flex items-center justify-between gap-3 rounded-3xl border border-border/60 bg-card p-4"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">
                    {formatDate(v.visit_date)} · {v.start_time.slice(0, 5)}–{v.end_time.slice(0, 5)}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {v.prescriber_name}
                    {v.location_name ? ` · ${v.location_name}` : ""}
                  </p>
                </div>
                {v.status === "pending_approval" ? (
                  <Badge variant="outline" className="shrink-0 rounded-full border-amber-400 text-amber-700">
                    Pending
                  </Badge>
                ) : v.confirmed_by_prescriber ? (
                  <Badge className="shrink-0 rounded-full bg-emerald-600">Confirmed</Badge>
                ) : (
                  <Badge variant="outline" className="shrink-0 rounded-full">
                    Awaiting
                  </Badge>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function ActionCard({
  tone,
  icon,
  title,
  items,
  empty,
  viewAll,
}: {
  tone: "red" | "amber";
  icon: React.ReactNode;
  title: string;
  items: { id: string; title: string; subtitle: string; href: string }[];
  empty: string;
  viewAll?: { href: string; label: string };
}) {
  const toneCls =
    tone === "red"
      ? "border-red-300/70 bg-red-50/60 dark:bg-red-950/20"
      : "border-amber-300/70 bg-amber-50/60 dark:bg-amber-950/20";
  const iconCls = tone === "red" ? "bg-red-600 text-white" : "bg-amber-500 text-white";
  return (
    <Card className={`rounded-2xl ${toneCls} ${items.length ? "" : "opacity-80"}`}>
      <CardHeader className="flex-row items-center gap-3 space-y-0 pb-2">
        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${iconCls}`}>{icon}</span>
        <CardTitle className="text-sm font-semibold leading-tight">{title}</CardTitle>
        {items.length > 0 && (
          <span className={`ml-auto flex h-6 min-w-6 items-center justify-center rounded-full px-2 text-xs font-bold text-white ${tone === "red" ? "bg-red-600" : "bg-amber-500"}`}>
            {items.length}
          </span>
        )}
      </CardHeader>
      <CardContent className="space-y-1.5">
        {items.length === 0 ? (
          <p className="py-1 text-sm text-muted-foreground">{empty}</p>
        ) : (
          items.slice(0, 4).map((it) => (
            <Link
              key={it.id}
              to={it.href}
              className="flex items-center justify-between gap-2 rounded-lg bg-background/70 px-3 py-2 text-sm transition hover:bg-background"
            >
              <div className="min-w-0">
                <p className="truncate font-medium">{it.title}</p>
                <p className="truncate text-xs text-muted-foreground">{it.subtitle}</p>
              </div>
              <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
            </Link>
          ))
        )}
        {viewAll && items.length > 0 && (
          <Link to={viewAll.href} className="block pt-1 text-xs font-medium text-primary hover:underline">
            {viewAll.label} →
          </Link>
        )}
      </CardContent>
    </Card>
  );
}

function StatTile({ icon, label, value, href }: { icon: React.ReactNode; label: string; value: string | number; href: string }) {
  return (
    <Link to={href}>
      <Card className="h-full rounded-2xl transition hover:shadow-luxe">
        <CardContent className="space-y-1 p-4">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">{icon}{label}</div>
          <div className="font-serif text-2xl">{value}</div>
        </CardContent>
      </Card>
    </Link>
  );
}

function formatDate(s: string) {
  return new Date(s + "T00:00:00").toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}
