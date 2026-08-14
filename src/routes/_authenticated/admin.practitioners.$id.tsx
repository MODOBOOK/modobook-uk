import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { amIAdmin } from "@/lib/admin.functions";
import {
  adminGetPractitioner,
  adminOpenViewAs,
  adminEditPractitioner,
  adminSetActive,
  adminListAudit,
} from "@/lib/admin-console.functions";
import {
  adminGetSeatAllowance,
  adminSetSeatAllowance,
  adminSetBilling,
} from "@/lib/admin-subscriptions.functions";
import { AdminShell } from "@/components/admin/AdminShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Shield,
  ArrowLeft,
  Eye,
  Pencil,
  ScrollText,
  Power,
  ExternalLink,
  AlertTriangle,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/practitioners/$id")({
  ssr: false,
  loader: async () => {
    const me = await amIAdmin();
    if (!me.admin) throw new Error("You do not have admin access.");
    return null;
  },
  errorComponent: ({ error }) => (
    <div className="mx-auto max-w-md p-6 text-center">
      <Shield className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
      <h1 className="text-lg font-semibold">Admin only</h1>
      <p className="mt-1 text-sm text-muted-foreground">{error.message}</p>
    </div>
  ),
  component: Page,
});

type Tab = "overview" | "view" | "edit" | "audit";

function Page() {
  const { id } = Route.useParams();
  const getPract = useServerFn(adminGetPractitioner);
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["admin", "practitioner", id],
    queryFn: () => getPract({ data: { id } }),
  });
  const [tab, setTab] = useState<Tab>("overview");

  if (isLoading || !data) {
    return (
      <AdminShell>
        <p className="text-sm text-muted-foreground">Loading…</p>
      </AdminShell>
    );
  }

  const p = data.profile as any;
  const title = p.clinic_name || p.full_name || "Practitioner";

  return (
    <AdminShell>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link
            to="/admin/practitioners"
            className="mb-1 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3 w-3" /> All practitioners
          </Link>
          <h1 className="font-serif text-2xl">{title}</h1>
          <p className="text-sm text-muted-foreground">
            {p.email || "no email"} · slug{" "}
            {p.slug ? (
              <code className="rounded bg-muted px-1">{p.slug}</code>
            ) : (
              "—"
            )}{" "}
            · {p.active ? "Active" : <Badge variant="secondary">Suspended</Badge>}
          </p>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-1 border-b">
        {[
          { k: "overview" as const, label: "Overview", icon: Shield },
          { k: "view" as const, label: "View as", icon: Eye },
          { k: "edit" as const, label: "Edit", icon: Pencil },
          { k: "audit" as const, label: "Audit", icon: ScrollText },
        ].map((t) => {
          const Icon = t.icon;
          const active = tab === t.k;
          return (
            <button
              key={t.k}
              onClick={() => setTab(t.k)}
              className={
                "inline-flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm " +
                (active
                  ? "border-slate-900 font-medium text-slate-900"
                  : "border-transparent text-muted-foreground hover:text-foreground")
              }
            >
              <Icon className="h-3.5 w-3.5" />
              {t.label}
            </button>
          );
        })}
      </div>

      {tab === "overview" && <Overview data={data} onChanged={refetch} />}
      {tab === "view" && <ViewAsTab id={id} slug={p.slug} />}
      {tab === "edit" && <EditTab id={id} profile={p} onSaved={refetch} />}
      {tab === "audit" && <AuditTab id={id} />}
    </AdminShell>
  );
}

function Overview({ data, onChanged }: { data: any; onChanged: () => void }) {
  const setActive = useServerFn(adminSetActive);
  const p = data.profile;
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  async function toggle() {
    if (!reason.trim() || reason.trim().length < 3) {
      toast.error("Reason is required (min 3 chars)");
      return;
    }
    setBusy(true);
    try {
      await setActive({ data: { id: p.id, active: !p.active, reason: reason.trim() } });
      toast.success(p.active ? "Suspended" : "Reactivated");
      setReason("");
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Profile</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 text-sm">
          <Row k="Full name" v={p.full_name} />
          <Row k="Clinic" v={p.clinic_name} />
          <Row k="Email" v={p.email} />
          <Row k="Phone" v={p.phone} />
          <Row k="Tagline" v={p.tagline} />
          <Row k="Brand colour" v={p.brand_color} />
          <Row k="Created" v={new Date(p.created_at).toLocaleString()} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Public setup</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 text-sm">
          <Row k="Treatments" v={String(data.treatments.length)} />
          <Row k="Locations" v={String(data.locations.length)} />
          <Row k="Has custom theme" v={data.theme ? "Yes" : "No"} />
          {p.slug && (
            <div className="pt-2">
              <a
                href={`/m/${p.slug}`}
                target="_blank"
                rel="noopener"
                className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
              >
                Open public page <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          )}
        </CardContent>
      </Card>

      <SeatAllowanceCard profileId={p.id} />



      <Card className="md:col-span-2 border-amber-300 bg-amber-50/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Power className="h-4 w-4" />
            {p.active ? "Suspend account" : "Reactivate account"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-sm text-muted-foreground">
            {p.active
              ? "Suspending hides their public booking page and blocks new bookings. Existing data is preserved."
              : "Reactivating restores their public booking page."}
          </p>
          <Textarea
            placeholder="Reason (required, logged)"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={2}
          />
          <Button variant={p.active ? "destructive" : "default"} disabled={busy} onClick={toggle}>
            {busy ? "Working…" : p.active ? "Suspend" : "Reactivate"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function Row({ k, v }: { k: string; v: any }) {
  return (
    <div className="flex justify-between gap-3 border-b py-1 last:border-0">
      <span className="text-muted-foreground">{k}</span>
      <span className="truncate text-right">{v ?? "—"}</span>
    </div>
  );
}

function ViewAsTab({ id, slug }: { id: string; slug: string | null }) {
  const openViewAs = useServerFn(adminOpenViewAs);
  const { data } = useQuery({
    queryKey: ["admin", "viewas", id],
    queryFn: () => openViewAs({ data: { id } }),
  });

  if (!slug) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-muted-foreground">
          This practitioner has no public slug yet, so there's nothing to view.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-900">
        <AlertTriangle className="h-4 w-4" />
        <span>
          Viewing <strong>{data?.clinic_name || data?.full_name || "practitioner"}</strong> read-only. No patient data is loaded on this page.
        </span>
        <a
          href={`/m/${slug}`}
          target="_blank"
          rel="noopener"
          className="ml-auto inline-flex items-center gap-1 text-xs underline"
        >
          Open in new tab <ExternalLink className="h-3 w-3" />
        </a>
      </div>
      <div className="overflow-hidden rounded-md border bg-white">
        <iframe
          src={`/m/${slug}`}
          title="Public booking page"
          className="h-[75vh] w-full"
        />
      </div>
    </div>
  );
}

const FIELDS: Array<{ key: string; label: string; type?: "textarea" | "text" | "color" }> = [
  { key: "clinic_name", label: "Clinic name" },
  { key: "slug", label: "Slug" },
  { key: "email", label: "Contact email" },
  { key: "phone", label: "Phone" },
  { key: "tagline", label: "Tagline" },
  { key: "bio", label: "Bio", type: "textarea" },
  { key: "about", label: "About", type: "textarea" },
  { key: "brand_color", label: "Brand colour", type: "color" },
];

function EditTab({
  id,
  profile,
  onSaved,
}: {
  id: string;
  profile: any;
  onSaved: () => void;
}) {
  const edit = useServerFn(adminEditPractitioner);
  const [values, setValues] = useState<Record<string, string>>(
    Object.fromEntries(FIELDS.map((f) => [f.key, profile[f.key] ?? ""])),
  );
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const dirty = FIELDS.reduce<Record<string, unknown>>((acc, f) => {
    const cur = values[f.key] ?? "";
    const orig = profile[f.key] ?? "";
    if (String(cur) !== String(orig)) acc[f.key] = cur === "" ? null : cur;
    return acc;
  }, {});

  async function save() {
    if (Object.keys(dirty).length === 0) {
      toast.info("No changes");
      return;
    }
    if (reason.trim().length < 3) {
      toast.error("Reason is required (min 3 chars)");
      return;
    }
    setBusy(true);
    try {
      await edit({ data: { id, patch: dirty, reason: reason.trim() } });
      toast.success("Saved");
      setReason("");
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Edit on behalf of practitioner</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Only branding / public profile fields can be edited here. Patient records, appointments, prescriptions and forms are never editable from admin.
        </p>
        <div className="grid gap-3 md:grid-cols-2">
          {FIELDS.map((f) => (
            <div key={f.key} className="space-y-1">
              <Label>{f.label}</Label>
              {f.type === "textarea" ? (
                <Textarea
                  rows={3}
                  value={values[f.key] ?? ""}
                  onChange={(e) => setValues({ ...values, [f.key]: e.target.value })}
                />
              ) : (
                <Input
                  type={f.type === "color" ? "color" : "text"}
                  value={values[f.key] ?? ""}
                  onChange={(e) => setValues({ ...values, [f.key]: e.target.value })}
                />
              )}
            </div>
          ))}
        </div>

        <div className="space-y-1">
          <Label>Reason for change (required, logged)</Label>
          <Textarea
            rows={2}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. practitioner asked support to update slug from 'x' to 'y'"
          />
        </div>

        <div className="flex items-center gap-2">
          <Button onClick={save} disabled={busy || Object.keys(dirty).length === 0}>
            {busy ? "Saving…" : `Save ${Object.keys(dirty).length || ""} change${Object.keys(dirty).length === 1 ? "" : "s"}`}
          </Button>
          {Object.keys(dirty).length > 0 && (
            <span className="text-xs text-muted-foreground">
              Editing: {Object.keys(dirty).join(", ")}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function AuditTab({ id }: { id: string }) {
  const listAudit = useServerFn(adminListAudit);
  const { data, isLoading } = useQuery({
    queryKey: ["admin", "audit", id],
    queryFn: () => listAudit({ data: { target_id: id, limit: 200 } }),
  });
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Audit log for this practitioner</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {isLoading ? (
          <p className="p-4 text-sm text-muted-foreground">Loading…</p>
        ) : !data?.length ? (
          <p className="p-4 text-sm text-muted-foreground">No actions logged yet.</p>
        ) : (
          <div className="divide-y">
            {data.map((r: any) => (
              <AuditRow key={r.id} row={r} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function AuditRow({ row }: { row: any }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="p-3 text-sm">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <Badge variant="outline" className="mr-2 font-mono text-[10px]">
            {row.action}
          </Badge>
          <span className="text-muted-foreground">by </span>
          <span className="font-medium">{row.actor_email || row.actor_user_id}</span>
          {row.target_name && (
            <>
              <span className="text-muted-foreground"> → </span>
              <span>{row.target_name}</span>
            </>
          )}
        </div>
        <span className="text-xs text-muted-foreground">
          {new Date(row.created_at).toLocaleString()}
        </span>
      </div>
      {row.reason && <p className="mt-1 text-xs text-muted-foreground">Reason: {row.reason}</p>}
      {row.diff && (
        <button
          className="mt-1 text-xs text-primary hover:underline"
          onClick={() => setOpen((o) => !o)}
        >
          {open ? "Hide" : "Show"} diff
        </button>
      )}
      {open && row.diff && (
        <pre className="mt-2 overflow-x-auto rounded bg-slate-950 p-2 text-[11px] text-slate-100">
          {JSON.stringify(row.diff, null, 2)}
        </pre>
      )}
    </div>
  );
}

function SeatAllowanceCard({ profileId }: { profileId: string }) {
  const getSeats = useServerFn(adminGetSeatAllowance);
  const setSeats = useServerFn(adminSetSeatAllowance);
  const setBilling = useServerFn(adminSetBilling);
  const { data, refetch, isLoading, error } = useQuery({
    queryKey: ["admin", "seats", profileId],
    queryFn: () => getSeats({ data: { profileId } }),
    retry: false,
  });
  const [loc, setLoc] = useState<string>("");
  const [prac, setPrac] = useState<string>("");
  const [assoc, setAssoc] = useState<string>("");
  const [pct, setPct] = useState<string>("");
  const [amt, setAmt] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [trialDays, setTrialDays] = useState("30");

  const freeLoc = loc === "" ? String(data?.free_locations ?? 0) : loc;
  const freePrac = prac === "" ? String(data?.free_practitioners ?? 0) : prac;
  const freeAssoc = assoc === "" ? String(data?.free_associates ?? 0) : assoc;
  const pctVal = pct === "" ? String(data?.discount_percent ?? 0) : pct;
  const amtVal = amt === "" ? ((data?.discount_amount_cents ?? 0) / 100).toFixed(2) : amt;

  async function save() {
    setBusy(true);
    try {
      await setSeats({
        data: {
          profileId,
          freeLocations: Number(freeLoc) || 0,
          freePractitioners: Number(freePrac) || 0,
          freeAssociates: Number(freeAssoc) || 0,
        },
      });
      toast.success("Free seats updated");
      setLoc(""); setPrac(""); setAssoc("");
      refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  async function saveDiscount() {
    await applyBilling(
      {
        discountPercent: Number(pctVal) || 0,
        discountAmountCents: Math.round((Number(amtVal) || 0) * 100),
      },
      "Monthly discount updated",
    );
    setPct(""); setAmt("");
  }


  async function applyBilling(patch: Record<string, unknown>, msg: string) {
    setBusy(true);
    try {
      await setBilling({ data: { profileId, ...patch } as never });
      toast.success(msg);
      refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="md:col-span-2">
      <CardHeader>
        <CardTitle className="text-base">Billing, free accounts &amp; seats</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5 text-sm">
        {isLoading ? (
          <p className="text-muted-foreground">Loading…</p>
        ) : error ? (
          <p className="text-destructive">
            Couldn&apos;t load billing: {error instanceof Error ? error.message : "unknown error"}
          </p>
        ) : (
          <>
            {/* Free account */}
            <div className="rounded-md border p-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-medium">Free subscription</p>
                  <p className="text-xs text-muted-foreground">
                    Nothing is ever charged and access is never blocked. Cancels any live direct debit.
                  </p>
                </div>
                {data?.comped ? (
                  <div className="flex items-center gap-2">
                    <Badge>Free account</Badge>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy}
                      onClick={() => applyBilling({ comped: false }, "Free account removed")}
                    >
                      Remove
                    </Button>
                  </div>
                ) : (
                  <Button
                    size="sm"
                    disabled={busy}
                    onClick={() => applyBilling({ comped: true }, "Account is now free")}
                  >
                    Make this account free
                  </Button>
                )}
              </div>
            </div>

            {/* Discount */}
            <div className="rounded-md border p-3 space-y-2">
              <p className="font-medium">Discount code</p>
              <p className="text-xs text-muted-foreground">
                Applies to their platform subscription — instantly if they&apos;re already on direct debit,
                otherwise at checkout. Create codes on the Admin home page.
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <select
                  className="h-9 rounded-md border bg-background px-2 text-sm"
                  value={data?.discount_code_id ?? ""}
                  disabled={busy}
                  onChange={(e) =>
                    applyBilling(
                      { discountCodeId: e.target.value || null },
                      e.target.value ? "Discount applied" : "Discount removed",
                    )
                  }
                >
                  <option value="">No discount</option>
                  {(data?.discount_codes ?? []).map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.code}
                      {c.percent_off ? ` — ${c.percent_off}% off` : ""}
                      {c.amount_off_cents ? ` — £${(c.amount_off_cents / 100).toFixed(2)} off` : ""}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Trial */}
            <div className="rounded-md border p-3 space-y-2">
              <p className="font-medium">Extend free trial</p>
              <p className="text-xs text-muted-foreground">
                Current trial ends{" "}
                {data?.trial_end ? new Date(data.trial_end).toLocaleDateString() : "—"}.
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  type="number"
                  min={1}
                  className="w-24"
                  value={trialDays}
                  onChange={(e) => setTrialDays(e.target.value)}
                />
                <span className="text-xs text-muted-foreground">days from today</span>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  onClick={() => applyBilling({ trialDays: Number(trialDays) || 30 }, "Trial extended")}
                >
                  Extend
                </Button>
              </div>
            </div>

            {/* Seats */}
            <div className="rounded-md border p-3 space-y-3">
              <p className="font-medium">Complimentary extra seats</p>
              <p className="text-xs text-muted-foreground">
                Every clinic includes 1 location and 1 practitioner. Anything set here is granted free
                of charge on top of that.
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label className="text-xs">Free extra locations</Label>
                  <Input type="number" min={0} value={freeLoc} onChange={(e) => setLoc(e.target.value)} />
                  <p className="mt-1 text-xs text-muted-foreground">
                    Using {data?.location_count ?? 0} · free allowance {1 + (data?.free_locations ?? 0)}
                  </p>
                </div>
                <div>
                  <Label className="text-xs">Free extra practitioners</Label>
                  <Input type="number" min={0} value={freePrac} onChange={(e) => setPrac(e.target.value)} />
                  <p className="mt-1 text-xs text-muted-foreground">
                    Using {data?.practitioner_count ?? 0} · free allowance {1 + (data?.free_practitioners ?? 0)}
                  </p>
                </div>
              </div>
              <Button size="sm" disabled={busy} onClick={save}>
                {busy ? "Saving…" : "Save free seats"}
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
