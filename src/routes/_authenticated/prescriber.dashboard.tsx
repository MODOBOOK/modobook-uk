import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  FileText,
  Inbox,
  KeyRound,
  MessageSquareText,
  Network,
  Pill,
  PoundSterling,
  ShieldCheck,
  Stethoscope,
} from "lucide-react";
import { getPrescriberHome } from "@/lib/prescriber-analytics.functions";
import { saveMyPrescriberFees, setSignoffPin } from "@/lib/prescriber.functions";
import { getMyDirectoryListing } from "@/lib/prescriber-directory.functions";
import { WalkInDialog } from "@/components/prescriber/WalkInDialog";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/prescriber/dashboard")({
  ssr: false,
  component: PrescriberDashboard,
});

type Home = Awaited<ReturnType<typeof getPrescriberHome>>;

function gbp(pence: number | null) {
  return pence == null ? null : `£${(pence / 100).toFixed(pence % 100 ? 2 : 0)}`;
}

function PrescriberDashboard() {
  const fetchHome = useServerFn(getPrescriberHome);
  const q = useQuery({ queryKey: ["prescriber-home"], queryFn: () => fetchHome(), refetchInterval: 60_000 });
  const d = q.data;

  const rxPending = d?.board.rxPending ?? [];
  const refsPending = d?.board.referralsPending ?? [];
  const awaitingInfo = d?.board.awaitingInfo ?? [];
  const visitsPending = d?.board.visitsPending ?? [];
  const walkInsClose = d?.board.walkInsAwaitingClose ?? [];

  const redCount = rxPending.length + refsPending.length;
  const amberCount = awaitingInfo.length + visitsPending.length + walkInsClose.length;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-serif text-2xl sm:text-3xl">Home</h2>
          <p className="text-sm text-muted-foreground">
            {redCount > 0
              ? `${redCount} thing${redCount === 1 ? "" : "s"} need your decision now.`
              : amberCount > 0
                ? "Nothing urgent — a few items are in progress."
                : "All clear. Nothing needs your attention."}
          </p>
        </div>
        <WalkInDialog trigger={<Button className="h-11 rounded-xl">+ New walk-in consult</Button>} />
      </div>

      {/* ACTION-NEEDED BOARD */}
      <div className="grid gap-3 md:grid-cols-2">
        <ActionCard
          tone="red"
          icon={<MessageSquareText className="h-5 w-5" />}
          title="Prescriptions awaiting your decision"
          items={rxPending.map((r) => ({ id: r.id, title: r.title, subtitle: r.subtitle, href: `/prescriber/requests/${r.id}` }))}
          empty="No prescriptions waiting."
          viewAll={{ href: "/prescriber/requests", label: "Open requests" }}
        />
        <ActionCard
          tone="red"
          icon={<Inbox className="h-5 w-5" />}
          title="New referrals to accept"
          items={refsPending.map((r) => ({ id: r.id, title: r.title, subtitle: r.subtitle, href: "/prescriber" }))}
          empty="No new referrals."
          viewAll={{ href: "/prescriber", label: "Open referrals" }}
        />
        <ActionCard
          tone="amber"
          icon={<ClipboardList className="h-5 w-5" />}
          title="Waiting on practitioners"
          items={awaitingInfo.map((r) => ({ id: r.id, title: r.title, subtitle: r.subtitle, href: `/prescriber/requests/${r.id}` }))}
          empty="Nothing waiting on replies."
        />
        <ActionCard
          tone="amber"
          icon={<CalendarDays className="h-5 w-5" />}
          title="Visits & walk-ins to close"
          items={[
            ...visitsPending.map((v) => ({ id: v.id, title: v.title, subtitle: v.subtitle, href: "/prescriber/visits" })),
            ...walkInsClose.map((w) => ({ id: w.id, title: w.title, subtitle: w.subtitle, href: "/prescriber" })),
          ]}
          empty="No visits or walk-ins pending."
        />
      </div>

      {/* STATS */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile icon={<Pill className="h-4 w-4" />} label="Signed this month" value={d?.stats.scriptsSignedThisMonth ?? "—"} href="/prescriber/library" />
        <StatTile icon={<CheckCircle2 className="h-4 w-4" />} label="Active cases" value={d?.stats.activeCases ?? "—"} href="/prescriber" />
        <StatTile icon={<ClipboardList className="h-4 w-4" />} label="Directions" value="Manage" href="/prescriber/directions" />
        <StatTile icon={<FileText className="h-4 w-4" />} label="Invoices" value="View" href="/prescriber/invoices" />
      </div>

      {/* FEES + PIN */}
      <div className="grid gap-3 md:grid-cols-2">
        <FeesCard home={d} onSaved={() => q.refetch()} />
        <PinCard home={d} onSaved={() => q.refetch()} />
      </div>

      {/* AUDIT: recent sign-offs */}
      <Card className="rounded-2xl">
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldCheck className="h-4 w-4 text-primary" /> Recent sign-offs (audit trail)
          </CardTitle>
          <Link to="/prescriber/library" className="text-xs font-medium text-primary hover:underline">
            Full prescription library
          </Link>
        </CardHeader>
        <CardContent className="space-y-2">
          {!d?.signoffs.length ? (
            <p className="text-sm text-muted-foreground">
              Nothing signed yet. Every approval you make — including quick sign-offs — is recorded
              here with the date and time.
            </p>
          ) : (
            d.signoffs.map((s) => (
              <Link
                key={s.id}
                to="/prescriber/requests/$id"
                params={{ id: s.requestId }}
                className="flex items-center justify-between gap-3 rounded-xl border bg-muted/30 px-3 py-2.5 text-sm transition hover:bg-muted/60"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{s.summary || "Decision recorded"}</p>
                  <p className="text-xs text-muted-foreground">{new Date(s.at).toLocaleString()}</p>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                    s.kind === "approved" ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"
                  }`}
                >
                  {s.kind}
                </span>
              </Link>
            ))
          )}
        </CardContent>
      </Card>
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
      <Card className="rounded-2xl transition hover:shadow-luxe">
        <CardContent className="space-y-1 p-4">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">{icon}{label}</div>
          <div className="font-serif text-2xl">{value}</div>
        </CardContent>
      </Card>
    </Link>
  );
}

function FeesCard({ home, onSaved }: { home: Home | undefined; onSaved: () => void }) {
  const save = useServerFn(saveMyPrescriberFees);
  const [feeRx, setFeeRx] = useState<string | null>(null);
  const [feeConsult, setFeeConsult] = useState<string | null>(null);
  const [notes, setNotes] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const curRx = feeRx ?? (home?.settings.feeRx != null ? String(home.settings.feeRx / 100) : "");
  const curConsult = feeConsult ?? (home?.settings.feeConsult != null ? String(home.settings.feeConsult / 100) : "");
  const curNotes = notes ?? home?.settings.feeNotes ?? "";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await save({
        data: {
          fee_per_prescription: curRx.trim() ? Number(curRx) : null,
          fee_per_consult: curConsult.trim() ? Number(curConsult) : null,
          fee_notes: curNotes,
        },
      });
      toast.success("Fees saved", { description: "Practitioners now see these before connecting." });
      setFeeRx(null); setFeeConsult(null); setNotes(null);
      onSaved();
    } catch (err) {
      toast.error("Could not save", { description: (err as Error).message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="rounded-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <PoundSterling className="h-4 w-4 text-primary" /> Your fees
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Shown to practitioners up front so there are no surprises. Leave blank if you prefer to
          discuss per clinic.
        </p>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="fee-rx" className="text-xs">Per prescription (£)</Label>
              <Input id="fee-rx" inputMode="decimal" placeholder="e.g. 25" value={curRx} onChange={(e) => setFeeRx(e.target.value.replace(/[^\d.]/g, ""))} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="fee-consult" className="text-xs">Per consult (£)</Label>
              <Input id="fee-consult" inputMode="decimal" placeholder="e.g. 50" value={curConsult} onChange={(e) => setFeeConsult(e.target.value.replace(/[^\d.]/g, ""))} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="fee-notes" className="text-xs">Notes (optional)</Label>
            <Textarea id="fee-notes" rows={2} placeholder="e.g. Clinic days £250, includes all scripts" value={curNotes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          <Button type="submit" size="sm" disabled={busy}>Save fees</Button>
        </form>
      </CardContent>
    </Card>
  );
}

function PinCard({ home, onSaved }: { home: Home | undefined; onSaved: () => void }) {
  const setPinFn = useServerFn(setSignoffPin);
  const [pin, setPin] = useState("");
  const [current, setCurrent] = useState("");
  const [busy, setBusy] = useState(false);
  const hasPin = home?.settings.hasPin ?? false;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!/^\d{4,6}$/.test(pin)) {
      toast.error("PIN must be 4–6 digits");
      return;
    }
    setBusy(true);
    try {
      await setPinFn({ data: { pin, current_pin: current || undefined } });
      toast.success(hasPin ? "PIN updated" : "PIN set", {
        description: "You can now quick sign-off prescriptions from the requests list.",
      });
      setPin(""); setCurrent("");
      onSaved();
    } catch (err) {
      toast.error("Could not save PIN", { description: (err as Error).message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="rounded-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <KeyRound className="h-4 w-4 text-primary" /> Quick sign-off PIN
          {hasPin && <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-800">Active</span>}
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Approve a prescription in two taps from the requests list. Every quick sign-off is recorded
          in the audit trail.
        </p>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-3">
          {hasPin && (
            <div className="space-y-1.5">
              <Label htmlFor="pin-current" className="text-xs">Current PIN</Label>
              <Input id="pin-current" type="password" inputMode="numeric" maxLength={6} value={current} onChange={(e) => setCurrent(e.target.value.replace(/\D/g, ""))} className="tracking-[0.4em]" />
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="pin-new" className="text-xs">{hasPin ? "New PIN" : "Choose a PIN (4–6 digits)"}</Label>
            <Input id="pin-new" type="password" inputMode="numeric" maxLength={6} value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))} className="tracking-[0.4em]" />
          </div>
          <Button type="submit" size="sm" disabled={busy}>{hasPin ? "Update PIN" : "Set PIN"}</Button>
        </form>
      </CardContent>
    </Card>
  );
}
