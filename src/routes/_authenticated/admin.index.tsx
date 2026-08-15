import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  adminOverview,
  adminGrantByEmail,
  adminRevoke,
  adminDeleteInvite,
  amIAdmin,
  adminLookupByEmail,
  adminSendPasswordReset,
  adminSetUserPassword,
  adminSetProfileActive,
  adminDeleteClient,
  adminCreatePractitioner,
  adminInvitePractitioner,
  adminListWaitlist,
  adminDeleteWaitlistEntry,
} from "@/lib/admin.functions";
import {
  listSubscriptionPlans,
  listPractitionerSubscriptions,
  createSubscriptionPlan,
  updateSubscriptionPlan,
  createSubscriptionCheckout,
  recordManualSubscription,
  cancelPractitionerSubscription,
} from "@/lib/admin-subscriptions.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Shield, Trash2, UserPlus, ExternalLink, CreditCard, Plus, Link as LinkIcon, Search, KeyRound, Power, Mail, Rocket } from "lucide-react";
import { AdminShell } from "@/components/admin/AdminShell";
import { DemoLaunchCard } from "@/components/admin/DemoLaunchCard";




export const Route = createFileRoute("/_authenticated/admin/")({
  ssr: false,
  loader: async () => {
    const me = await amIAdmin();
    if (!me.admin) throw new Error("You do not have admin access.");
    return adminOverview();
  },
  errorComponent: ({ error }) => (
    <div className="mx-auto max-w-md p-6 text-center">
      <Shield className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
      <h1 className="text-lg font-semibold">Admin only</h1>
      <p className="mt-1 text-sm text-muted-foreground">{error.message}</p>
    </div>
  ),
  component: AdminPage,
});

type Practitioner = {
  profile_id: string;
  user_id: string;
  email: string | null;
  full_name: string | null;
  clinic_name: string | null;
  slug: string | null;
  active: boolean;
  created_at: string;
  appointments_count: number;
  treatments_count: number;
};
type Admin = { user_id: string; email: string | null; created_at: string };
type Invite = { id: string; email: string; accepted_at: string | null; created_at: string };

function AdminPage() {
  const router = useRouter();
  const data = Route.useLoaderData();
  const practitioners = data.practitioners as Practitioner[];
  const admins = data.admins as Admin[];
  const invites = data.invites as Invite[];

  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);

  async function invite() {
    if (!email.trim()) return;
    setBusy(true);
    try {
      const r = await adminGrantByEmail({ data: { email: email.trim() } });
      toast.success(
        r.status === "granted"
          ? "Admin access granted."
          : "User not found yet — they'll become admin when they sign up.",
      );
      setEmail("");
      router.invalidate();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  async function revoke(user_id: string, label: string) {
    if (!confirm(`Remove admin access for ${label}?`)) return;
    try {
      await adminRevoke({ data: { user_id } });
      toast.success("Removed");
      router.invalidate();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  }

  async function dropInvite(id: string) {
    try {
      await adminDeleteInvite({ data: { id } });
      router.invalidate();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  }

  return (
    <AdminShell>
    <div className="mx-auto max-w-5xl space-y-6 pb-24">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Platform admin</h1>
          <p className="text-sm text-muted-foreground">
            Monitor practitioners using MODO and manage admin access.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/admin/practitioners">
            <Button variant="default" size="sm">
              <Shield className="mr-2 h-4 w-4" /> Manage practitioners
            </Button>
          </Link>
          <Link to="/admin/audit">
            <Button variant="outline" size="sm">
              <Shield className="mr-2 h-4 w-4" /> Audit log
            </Button>
          </Link>
          <Link to="/admin/emails">
            <Button variant="outline" size="sm">
              <Mail className="mr-2 h-4 w-4" /> Emails & broadcasts
            </Button>
          </Link>
          <Link to="/admin/emails">
            <Button variant="default" size="sm">
              <Rocket className="mr-2 h-4 w-4" /> Launch waitlist
            </Button>
          </Link>
          <Link to="/admin-prescribers">
            <Button variant="outline" size="sm">
              <Shield className="mr-2 h-4 w-4" /> Prescriber verifications
            </Button>
          </Link>
          <Link to="/admin/competition">
            <Button variant="outline" size="sm">
              <Shield className="mr-2 h-4 w-4" /> TLAs competition
            </Button>
          </Link>
          <Link to="/admin/hair-beauty">
            <Button variant="outline" size="sm">
              <Shield className="mr-2 h-4 w-4" /> Hair & beauty waitlist
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Practitioners" value={practitioners.length} />
        <Stat
          label="Active"
          value={practitioners.filter((p) => p.active).length}
        />
        <Stat
          label="Total bookings"
          value={practitioners.reduce((n, p) => n + Number(p.appointments_count || 0), 0)}
        />
      </div>

      <Card>
        <CardHeader><CardTitle>Practitioners</CardTitle></CardHeader>
        <CardContent className="p-0">
          {practitioners.length === 0 ? (
            <p className="p-4 text-sm italic text-muted-foreground">No practitioners yet.</p>
          ) : (
            <div className="divide-y">
              {practitioners.map((p) => (
                <div key={p.profile_id} className="flex flex-wrap items-center gap-3 p-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-medium">
                        {p.clinic_name || p.full_name || "—"}
                      </span>
                      {!p.active && <Badge variant="secondary">Inactive</Badge>}
                    </div>
                    <div className="truncate text-xs text-muted-foreground">
                      {p.email} · {p.appointments_count} bookings · {p.treatments_count} treatments
                    </div>
                  </div>
                  {p.slug && (
                    <a
                      href={`/m/${p.slug}`}
                      target="_blank"
                      rel="noopener"
                      className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                    >
                      /m/{p.slug} <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <CreatePractitionerCard />

      <DemoLaunchCard />




      <Card>
        <CardHeader><CardTitle>Add an admin</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Enter an email. If they have an account they get admin access immediately;
            otherwise they get it automatically when they sign up.
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              type="email"
              placeholder="person@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") invite(); }}
            />
            <Button onClick={invite} disabled={busy}>
              <UserPlus className="mr-1 h-4 w-4" /> Add admin
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Current admins</CardTitle></CardHeader>
        <CardContent className="p-0">
          <div className="divide-y">
            {admins.map((a) => (
              <div key={a.user_id} className="flex items-center justify-between gap-2 p-3">
                <div>
                  <div className="font-medium">{a.email}</div>
                  <div className="text-xs text-muted-foreground">
                    Since {new Date(a.created_at).toLocaleDateString()}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => revoke(a.user_id, a.email ?? "this admin")}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {invites.filter((i) => !i.accepted_at).length > 0 && (
        <Card>
          <CardHeader><CardTitle>Pending invites</CardTitle></CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
              {invites.filter((i) => !i.accepted_at).map((i) => (
                <div key={i.id} className="flex items-center justify-between gap-2 p-3">
                  <div className="text-sm">{i.email}</div>
                  <Button variant="ghost" size="icon" onClick={() => dropInvite(i.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <UserSupportCard />

      <WaitlistCard />

      <SubscriptionsSection practitioners={practitioners} />
      <DiscountCodesSection />
    </div>
    </AdminShell>
  );
}

function CreatePractitionerCard() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [clinicName, setClinicName] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<"invite" | "password">("invite");
  const [result, setResult] = useState<{ mode: "invite" | "password"; email: string; temp_password?: string | null } | null>(null);

  async function submit() {
    if (!email.trim()) { toast.error("Email is required"); return; }
    setBusy(true);
    try {
      if (mode === "invite") {
        await adminInvitePractitioner({
          data: {
            email: email.trim(),
            full_name: fullName.trim() || null,
            clinic_name: clinicName.trim() || null,
          },
        });
        setResult({ mode: "invite", email: email.trim() });
        toast.success("Invite email sent");
      } else {
        const r = await adminCreatePractitioner({
          data: {
            email: email.trim(),
            full_name: fullName.trim() || null,
            clinic_name: clinicName.trim() || null,
            password: password.trim() || null,
          },
        });
        setResult({ mode: "password", email: r.email, temp_password: r.temp_password });
        toast.success("Account created");
      }
      setEmail(""); setFullName(""); setClinicName(""); setPassword("");
      router.invalidate();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  async function copy(text: string, label: string) {
    try { await navigator.clipboard.writeText(text); toast.success(`${label} copied`); }
    catch { toast.info(text); }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><UserPlus className="h-4 w-4" /> Create practitioner account</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant={mode === "invite" ? "default" : "outline"} onClick={() => setMode("invite")}>
            Send invite email
          </Button>
          <Button size="sm" variant={mode === "password" ? "default" : "outline"} onClick={() => setMode("password")}>
            Create with temp password
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">
          {mode === "invite"
            ? "Sends the practitioner an invite email. They click the link to set their password and finish signing in."
            : "Creates an auto-confirmed account. Share the temporary password with them via a secure channel — they can change it from account settings."}
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label>Email</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="person@example.com" />
          </div>
          <div className="space-y-1">
            <Label>Full name</Label>
            <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Jane Doe" />
          </div>
          <div className="space-y-1">
            <Label>Clinic name</Label>
            <Input value={clinicName} onChange={(e) => setClinicName(e.target.value)} placeholder="Clinic (optional)" />
          </div>
          {mode === "password" && (
            <div className="space-y-1">
              <Label>Password (optional)</Label>
              <Input type="text" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Leave blank to auto-generate" />
            </div>
          )}
        </div>
        <div>
          <Button onClick={submit} disabled={busy}>
            <UserPlus className="mr-1 h-4 w-4" /> {busy ? "Working…" : mode === "invite" ? "Send invite" : "Create account"}
          </Button>
        </div>

        {result && (
          <div className="rounded-md border bg-muted/40 p-3 text-sm space-y-2">
            <div><span className="font-medium">Account:</span> {result.email}</div>
            {result.mode === "invite" ? (
              <p className="text-xs text-muted-foreground">
                Invite email sent. They'll receive a link to set their password and sign in.
              </p>
            ) : result.temp_password ? (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">Temporary password:</span>
                  <code className="rounded bg-background px-2 py-0.5 text-xs">{result.temp_password}</code>
                  <Button size="sm" variant="outline" onClick={() => copy(result.temp_password!, "Password")}>Copy</Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Send these to the practitioner via a secure channel. They can sign in at <code>/auth</code> and change their password in account settings.
                </p>
              </>
            ) : null}
          </div>
        )}


      </CardContent>
    </Card>
  );
}


function UserSupportCard() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{
    authUsers: Array<{ id: string; email: string | null; created_at: string; last_sign_in_at: string | null; email_confirmed_at: string | null }>;
    profiles: Array<{ id: string; user_id: string | null; full_name: string | null; clinic_name: string | null; slug: string | null; active: boolean | null }>;
    clients: Array<{ id: string; profile_id: string; full_name: string | null; email: string | null; phone: string | null }>;
  } | null>(null);


  async function search() {
    if (!q.trim()) return;
    setBusy(true);
    try {
      const r = await adminLookupByEmail({ data: { email: q.trim() } });
      setResult(r);
      if (!r.authUsers.length && !r.profiles.length && !r.clients.length) {
        toast.info("No matches found");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Lookup failed");
    } finally {
      setBusy(false);
    }
  }

  async function sendReset(email: string) {
    try {
      const origin = typeof window !== "undefined" ? window.location.origin : "";
      const r = await adminSendPasswordReset({ data: { email, redirectTo: `${origin}/reset-password` } });
      if (r.actionLink) {
        try { await navigator.clipboard.writeText(r.actionLink); toast.success("Recovery link copied to clipboard"); }
        catch { toast.success("Recovery link generated"); }
      } else {
        toast.success("Password reset email sent");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  }

  async function setPassword(email: string) {
    const pw = window.prompt(`Set a new password for ${email}\n\nMin 8 characters. Share it securely — they can change it after signing in.`);
    if (!pw) return;
    if (pw.length < 8) { toast.error("Password must be at least 8 characters"); return; }
    try {
      await adminSetUserPassword({ data: { email, password: pw } });
      try { await navigator.clipboard.writeText(pw); toast.success("Password updated & copied to clipboard"); }
      catch { toast.success("Password updated"); }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  }

  async function toggleActive(profile_id: string, active: boolean) {
    if (!confirm(active ? "Reactivate this clinic profile?" : "Deactivate this clinic profile? Their public booking link will stop working.")) return;
    try {
      await adminSetProfileActive({ data: { profile_id, active } });
      toast.success("Updated");
      await search();
      router.invalidate();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  }

  async function deleteClient(id: string, name: string) {
    if (!confirm(`Permanently delete patient "${name}"? This cannot be undone.`)) return;
    try {
      await adminDeleteClient({ data: { client_id: id } });
      toast.success("Deleted");
      await search();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Search className="h-4 w-4" /> User support — lookup by email</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Find any account or patient by email. Send a password reset link, deactivate a clinic, or remove a patient record to help fix IT issues.
        </p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            type="email"
            placeholder="search by email…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") search(); }}
          />
          <Button onClick={search} disabled={busy}>{busy ? "Searching…" : "Search"}</Button>
        </div>

        {result && (
          <div className="space-y-4">
            {result.authUsers.length > 0 && (
              <div>
                <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Auth accounts</div>
                <div className="divide-y rounded-md border">
                  {result.authUsers.map((u) => (
                    <div key={u.id} className="flex flex-wrap items-center gap-2 p-3">
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-medium">{u.email}</div>
                        <div className="text-xs text-muted-foreground">
                          Joined {new Date(u.created_at).toLocaleDateString()}
                          {u.last_sign_in_at ? ` · last in ${new Date(u.last_sign_in_at).toLocaleDateString()}` : " · never signed in"}
                          {!u.email_confirmed_at && " · email unconfirmed"}
                        </div>
                      </div>
                      <Button size="sm" variant="outline" onClick={() => u.email && sendReset(u.email)}>
                        <KeyRound className="mr-1 h-3 w-3" /> Send reset
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => u.email && setPassword(u.email)}>
                        <KeyRound className="mr-1 h-3 w-3" /> Set password
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {result.profiles.length > 0 && (
              <div>
                <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Clinic profiles</div>
                <div className="divide-y rounded-md border">
                  {result.profiles.map((p) => (
                    <div key={p.id} className="flex flex-wrap items-center gap-2 p-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="truncate font-medium">{p.clinic_name || p.full_name || "—"}</span>
                          {!p.active && <Badge variant="secondary">Inactive</Badge>}
                        </div>
                        {p.slug && (
                          <a href={`/m/${p.slug}`} target="_blank" rel="noopener" className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                            /m/{p.slug} <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                      </div>
                      <Button size="sm" variant="outline" onClick={() => toggleActive(p.id, !p.active)}>
                        <Power className="mr-1 h-3 w-3" /> {p.active ? "Deactivate" : "Reactivate"}
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {result.clients.length > 0 && (
              <div>
                <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Patient records</div>
                <div className="divide-y rounded-md border">
                  {result.clients.map((c) => (
                    <div key={c.id} className="flex flex-wrap items-center gap-2 p-3">
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-medium">{c.full_name || "—"}</div>
                        <div className="truncate text-xs text-muted-foreground">{c.email}{c.phone ? ` · ${c.phone}` : ""}</div>
                      </div>
                      <Button size="sm" variant="ghost" onClick={() => deleteClient(c.id, c.full_name || c.email || "patient")}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}


type Plan = {
  id: string; name: string; description: string | null;
  amount_cents: number; currency: string; interval: string;
  stripe_price_id: string | null; active: boolean;
  is_default?: boolean; kind?: string | null;
};
type SubRow = {
  id: string; profile_id: string; plan_id: string | null;
  status: string; stripe_customer_id: string | null;
  stripe_subscription_id: string | null; cancel_at_period_end: boolean;
  current_period_end: string | null; notes: string | null;
  subscription_plans: { name: string; amount_cents: number; currency: string; interval: string } | null;
};

function money(cents: number, currency: string) {
  const symbol = currency.toLowerCase() === "gbp" ? "£" : currency.toLowerCase() === "usd" ? "$" : currency.toUpperCase() + " ";
  return `${symbol}${(cents / 100).toFixed(2)}`;
}

function SubscriptionsSection({ practitioners }: { practitioners: Practitioner[] }) {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [subs, setSubs] = useState<SubRow[]>([]);
  const [showNewPlan, setShowNewPlan] = useState(false);
  const [assignFor, setAssignFor] = useState<Practitioner | null>(null);

  async function refresh() {
    try {
      const [p, s] = await Promise.all([listSubscriptionPlans(), listPractitionerSubscriptions()]);
      setPlans(p as Plan[]);
      setSubs(s as SubRow[]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load subscriptions");
    }
  }
  useEffect(() => { void refresh(); }, []);

  const subByProfile = new Map(subs.map((s) => [s.profile_id, s]));

  const basePlans = plans.filter((p) => (p.kind ?? "base") === "base");
  const addonPlans = plans.filter((p) => (p.kind ?? "base") !== "base");
  const [newPlanKind, setNewPlanKind] = useState<"base" | "addon_location" | "addon_practitioner">("base");
  const [editPlan, setEditPlan] = useState<Plan | null>(null);

  function PlanRow({ p }: { p: Plan }) {
    return (
      <div className="flex flex-wrap items-center gap-3 p-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium">{p.name}</span>
            {p.is_default && <Badge>Default</Badge>}
            {p.kind === "addon_location" && <Badge variant="outline">Add-on · Location</Badge>}
            {p.kind === "addon_practitioner" && <Badge variant="outline">Add-on · Practitioner</Badge>}
            {!p.active && <Badge variant="secondary">Inactive</Badge>}
          </div>
          <div className="text-xs text-muted-foreground">
            {money(p.amount_cents, p.currency)} / {p.interval}
            {p.description ? ` · ${p.description}` : ""}
          </div>
        </div>
        <Button size="sm" variant="outline" onClick={() => setEditPlan(p)}>Edit</Button>
        {!p.is_default && p.active && (p.kind === "base" || !p.kind) && (
          <Button
            size="sm"
            variant="outline"
            onClick={async () => {
              try {
                await updateSubscriptionPlan({ data: { id: p.id, is_default: true } });
                toast.success("Set as default — new practitioners will start on this plan");
                refresh();
              } catch (e) { toast.error((e as Error).message); }
            }}
          >
            Set as default
          </Button>
        )}
        <Button
          size="sm"
          variant="outline"
          onClick={async () => {
            try {
              await updateSubscriptionPlan({ data: { id: p.id, active: !p.active } });
              refresh();
            } catch (e) { toast.error((e as Error).message); }
          }}
        >
          {p.active ? "Deactivate" : "Reactivate"}
        </Button>
      </div>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="flex items-center gap-2"><CreditCard className="h-4 w-4" /> Subscription plans</CardTitle>
          <Button size="sm" onClick={() => { setNewPlanKind("base"); setShowNewPlan(true); }}><Plus className="mr-1 h-4 w-4" />New plan</Button>
        </CardHeader>
        <CardContent className="p-0">
          {basePlans.length === 0 ? (
            <p className="p-4 text-sm italic text-muted-foreground">No subscription plans yet. Create one to bill practitioners monthly.</p>
          ) : (
            <div className="divide-y">
              {basePlans.map((p) => <PlanRow key={p.id} p={p} />)}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="flex items-center gap-2"><Plus className="h-4 w-4" /> Add-ons</CardTitle>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => { setNewPlanKind("addon_location"); setShowNewPlan(true); }}>
              <Plus className="mr-1 h-4 w-4" />Location add-on
            </Button>
            <Button size="sm" variant="outline" onClick={() => { setNewPlanKind("addon_practitioner"); setShowNewPlan(true); }}>
              <Plus className="mr-1 h-4 w-4" />Practitioner add-on
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {addonPlans.length === 0 ? (
            <p className="p-4 text-sm italic text-muted-foreground">No add-ons yet. Add extra location or team-member charges practitioners can stack on top of their base plan.</p>
          ) : (
            <div className="divide-y">
              {addonPlans.map((p) => <PlanRow key={p.id} p={p} />)}
            </div>
          )}
        </CardContent>
      </Card>


      <Card>
        <CardHeader><CardTitle>Practitioner subscriptions</CardTitle></CardHeader>
        <CardContent className="p-0">
          <div className="divide-y">
            {practitioners.map((p) => {
              const sub = subByProfile.get(p.profile_id);
              return (
                <div key={p.profile_id} className="flex flex-wrap items-center gap-3 p-3">
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{p.clinic_name || p.full_name || p.email}</div>
                    <div className="text-xs text-muted-foreground">
                      {sub ? (
                        <>
                          {sub.subscription_plans?.name ?? "—"}
                          {sub.subscription_plans ? ` · ${money(sub.subscription_plans.amount_cents, sub.subscription_plans.currency)}/${sub.subscription_plans.interval}` : ""}
                          {" · "}
                          <Badge variant={sub.status === "active" || sub.status === "trialing" ? "default" : "secondary"}>{sub.status}</Badge>
                          {sub.cancel_at_period_end ? " · cancels at period end" : ""}
                        </>
                      ) : (
                        <span>No subscription</span>
                      )}
                    </div>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => setAssignFor(p)} disabled={plans.length === 0}>
                    {sub ? "Change plan" : "Assign plan"}
                  </Button>
                  {sub && !sub.cancel_at_period_end && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={async () => {
                        if (!confirm("Cancel this subscription at the end of the current period?")) return;
                        try { await cancelPractitionerSubscription({ data: { profileId: p.profile_id } }); toast.success("Will cancel at period end"); refresh(); }
                        catch (e) { toast.error((e as Error).message); }
                      }}
                    >
                      Cancel
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {showNewPlan && (
        <NewPlanDialog
          kind={newPlanKind}
          onClose={() => setShowNewPlan(false)}
          onSaved={() => { setShowNewPlan(false); refresh(); }}
        />
      )}
      {editPlan && (
        <EditPlanDialog
          plan={editPlan}
          onClose={() => setEditPlan(null)}
          onSaved={() => { setEditPlan(null); refresh(); }}
        />
      )}
      {assignFor && (
        <AssignPlanDialog
          practitioner={assignFor}
          plans={plans.filter((p) => p.active)}
          onClose={() => setAssignFor(null)}
          onSaved={() => { setAssignFor(null); refresh(); }}
        />
      )}
    </>
  );
}

function NewPlanDialog({ kind, onClose, onSaved }: { kind: "base" | "addon_location" | "addon_practitioner"; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [interval, setInterval] = useState<"month" | "year">("month");
  const [busy, setBusy] = useState(false);

  const kindLabel = kind === "addon_location" ? "location add-on" : kind === "addon_practitioner" ? "practitioner add-on" : "plan";

  async function save() {
    const cents = Math.round(Number(amount) * 100);
    if (!name.trim() || !Number.isFinite(cents) || cents < 0) {
      toast.error("Enter a name and a valid amount");
      return;
    }
    setBusy(true);
    try {
      await createSubscriptionPlan({ data: {
        name: name.trim(), description: description.trim() || undefined,
        amount_cents: cents, currency: "gbp", interval, kind,
      }});
      toast.success(`${kindLabel[0].toUpperCase() + kindLabel.slice(1)} created`);
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally { setBusy(false); }
  }

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>New {kindLabel}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder={kind === "addon_location" ? "Extra location" : kind === "addon_practitioner" ? "Extra practitioner" : "MODO Pro"} /></div>
          <div><Label>Description (optional)</Label><Input value={description} onChange={(e) => setDescription(e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Amount (£)</Label><Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="4.99" /></div>
            <div>
              <Label>Billing interval</Label>
              <Select value={interval} onValueChange={(v) => setInterval(v as "month" | "year")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="month">Monthly</SelectItem>
                  <SelectItem value="year">Yearly</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            A Stripe product and recurring price will be created automatically.
            {kind !== "base" && " Practitioners can stack multiples of this add-on on top of their base plan."}
          </p>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={busy}>{busy ? "Creating…" : "Create"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditPlanDialog({ plan, onClose, onSaved }: { plan: Plan; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(plan.name);
  const [description, setDescription] = useState(plan.description ?? "");
  const [amount, setAmount] = useState((plan.amount_cents / 100).toFixed(2));
  const [interval, setInterval] = useState<"month" | "year">((plan.interval as "month" | "year") || "month");
  const [busy, setBusy] = useState(false);

  const priceChanged =
    Math.round(Number(amount) * 100) !== plan.amount_cents || interval !== plan.interval;

  async function save() {
    const cents = Math.round(Number(amount) * 100);
    if (!name.trim() || !Number.isFinite(cents) || cents < 0) {
      toast.error("Enter a valid name and amount");
      return;
    }
    setBusy(true);
    try {
      await updateSubscriptionPlan({ data: {
        id: plan.id,
        name: name.trim(),
        description: description.trim() || null,
        ...(priceChanged ? { amount_cents: cents, interval } : {}),
      }});
      toast.success(priceChanged ? "Plan updated — new Stripe price created" : "Plan updated");
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally { setBusy(false); }
  }

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Edit {plan.name}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div><Label>Description</Label><Input value={description} onChange={(e) => setDescription(e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Amount (£)</Label><Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
            <div>
              <Label>Interval</Label>
              <Select value={interval} onValueChange={(v) => setInterval(v as "month" | "year")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="month">Monthly</SelectItem>
                  <SelectItem value="year">Yearly</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          {priceChanged && (
            <p className="rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800">
              Changing price creates a new Stripe price. Existing subscribers keep their current rate until they check out again; new signups use the new rate.
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={busy}>{busy ? "Saving…" : "Save"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AssignPlanDialog({ practitioner, plans, onClose, onSaved }: {
  practitioner: Practitioner; plans: Plan[];
  onClose: () => void; onSaved: () => void;
}) {
  const [planId, setPlanId] = useState(plans[0]?.id ?? "");
  const [mode, setMode] = useState<"checkout" | "manual">("checkout");
  const [status, setStatus] = useState<"active" | "trialing" | "pending">("active");
  const [busy, setBusy] = useState(false);
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);

  async function save() {
    if (!planId) { toast.error("Pick a plan"); return; }
    setBusy(true);
    try {
      if (mode === "checkout") {
        const origin = typeof window !== "undefined" ? window.location.origin : "";
        const r = await createSubscriptionCheckout({ data: {
          profileId: practitioner.profile_id,
          planId,
          successUrl: `${origin}/dashboard?subscription=success`,
          cancelUrl: `${origin}/dashboard?subscription=cancelled`,
        }});
        if (r.url) {
          setCheckoutUrl(r.url);
          try { await navigator.clipboard.writeText(r.url); toast.success("Checkout link copied"); }
          catch { toast.success("Checkout link ready"); }
        }
      } else {
        await recordManualSubscription({ data: {
          profileId: practitioner.profile_id, planId, status,
        }});
        toast.success("Saved");
        onSaved();
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally { setBusy(false); }
  }

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Assign plan to {practitioner.clinic_name || practitioner.full_name || practitioner.email}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Plan</Label>
            <Select value={planId} onValueChange={setPlanId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {plans.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.name} · {money(p.amount_cents, p.currency)}/{p.interval}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>How to bill</Label>
            <Select value={mode} onValueChange={(v) => setMode(v as "checkout" | "manual")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="checkout">Send Stripe checkout link (recommended)</SelectItem>
                <SelectItem value="manual">Record manually (no Stripe charge)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {mode === "manual" && (
            <div>
              <Label>Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as "active" | "trialing" | "pending")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="trialing">Trial</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
          {checkoutUrl && (
            <div className="rounded-md border bg-muted/30 p-2 text-xs break-all">
              <div className="mb-1 flex items-center gap-1 font-semibold"><LinkIcon className="h-3 w-3" />Checkout link</div>
              <a href={checkoutUrl} target="_blank" rel="noreferrer" className="text-primary underline">{checkoutUrl}</a>
              <p className="mt-1 text-muted-foreground">Share this with the practitioner to complete payment setup.</p>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={checkoutUrl ? onSaved : onClose}>{checkoutUrl ? "Done" : "Cancel"}</Button>
          {!checkoutUrl && <Button onClick={save} disabled={busy}>{busy ? "Working…" : mode === "checkout" ? "Generate link" : "Save"}</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


function Stat({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className="mt-1 text-2xl font-bold">{value}</div>
      </CardContent>
    </Card>
  );
}

function DiscountCodesSection() {
  const [codes, setCodes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [code, setCode] = useState("");
  const [desc, setDesc] = useState("");
  const [percent, setPercent] = useState("");
  const [amount, setAmount] = useState("");
  const [duration, setDuration] = useState<"once" | "repeating" | "forever">("once");
  const [months, setMonths] = useState("");
  const [busy, setBusy] = useState(false);

  async function reload() {
    setLoading(true);
    try {
      const { listDiscountCodes } = await import("@/lib/admin-subscriptions.functions");
      setCodes(await listDiscountCodes());
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }
  useEffect(() => { reload(); }, []);

  async function create() {
    if (!code.trim()) return;
    const percentValue = percent ? Number(percent) : null;
    const amountValue = amount ? Math.round(Number(amount) * 100) : null;
    if (percentValue && amountValue) {
      toast.error("Choose either percent off or amount off, not both");
      return;
    }
    if (!percentValue && !amountValue) {
      toast.error("Enter a percent off or amount off");
      return;
    }
    if (duration === "repeating" && (!months || Number(months) < 1)) {
      toast.error("Enter how many months the discount repeats");
      return;
    }
    setBusy(true);
    try {
      const { createDiscountCode } = await import("@/lib/admin-subscriptions.functions");
      await createDiscountCode({ data: {
        code: code.trim(),
        description: desc || undefined,
        percent_off: percentValue,
        amount_off_cents: amountValue,
        duration,
        duration_in_months: months ? Number(months) : null,
      } });
      toast.success("Code created");
      setShowNew(false); setCode(""); setDesc(""); setPercent(""); setAmount(""); setMonths("");
      reload();
    } catch (e) {
      const message = e instanceof Error
        ? e.message
        : typeof e === "object" && e && "message" in e
          ? String(e.message)
          : "Could not create discount code";
      toast.error(message);
    }
    finally { setBusy(false); }
  }

  async function toggle(id: string, active: boolean) {
    try {
      const { toggleDiscountCode } = await import("@/lib/admin-subscriptions.functions");
      await toggleDiscountCode({ data: { id, active } });
      reload();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Platform discount codes</CardTitle>
        <Button size="sm" onClick={() => setShowNew((v) => !v)}>{showNew ? "Cancel" : "New code"}</Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {showNew && (
          <div className="rounded-md border p-3 space-y-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div><Label>Code</Label><Input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="MODO2026" /></div>
              <div><Label>Description</Label><Input value={desc} onChange={(e) => setDesc(e.target.value)} /></div>
              <div><Label>Percent off</Label><Input type="number" min="1" max="100" value={percent} onChange={(e) => { setPercent(e.target.value); if (e.target.value) setAmount(""); }} placeholder="20" /></div>
              <div><Label>Amount off (£)</Label><Input type="number" min="0.01" step="0.01" value={amount} onChange={(e) => { setAmount(e.target.value); if (e.target.value) setPercent(""); }} placeholder="10" /></div>
              <div>
                <Label>Duration</Label>
                <Select value={duration} onValueChange={(v) => setDuration(v as any)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="once">Once</SelectItem>
                    <SelectItem value="repeating">Repeating</SelectItem>
                    <SelectItem value="forever">Forever</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {duration === "repeating" && (
                <div><Label>Months</Label><Input type="number" min="1" value={months} onChange={(e) => setMonths(e.target.value)} /></div>
              )}
            </div>
            <Button onClick={create} disabled={busy}>Create</Button>
          </div>
        )}
        {loading ? <p className="text-sm text-muted-foreground">Loading…</p> : codes.length === 0 ? (
          <p className="text-sm text-muted-foreground">No discount codes yet.</p>
        ) : (
          <div className="space-y-2">
            {codes.map((c) => (
              <div key={c.id} className="flex items-center justify-between rounded-md border px-3 py-2">
                <div>
                  <div className="font-mono font-medium">{c.code}</div>
                  <div className="text-xs text-muted-foreground">
                    {c.percent_off ? `${c.percent_off}% off` : c.amount_off_cents ? `£${(c.amount_off_cents / 100).toFixed(2)} off` : ""} · {c.duration}
                    {c.max_redemptions ? ` · ${c.redemptions ?? 0}/${c.max_redemptions}` : c.redemptions ? ` · ${c.redemptions} used` : ""}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={c.active ? "default" : "outline"}>{c.active ? "Active" : "Disabled"}</Badge>
                  <Button size="sm" variant="outline" onClick={() => toggle(c.id, !c.active)}>{c.active ? "Disable" : "Enable"}</Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

type WaitlistRow = {
  id: string;
  name: string | null;
  email: string;
  role: string | null;
  clinic_name: string | null;
  source: string | null;
  consent_at: string | null;
  consent_text: string | null;
  created_at: string;
};

function WaitlistCard() {
  const [rows, setRows] = useState<WaitlistRow[] | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    try {
      const r = await adminListWaitlist();
      setRows(r.rows as WaitlistRow[]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load waitlist");
    }
  }

  useEffect(() => { load(); }, []);

  async function remove(id: string, email: string) {
    if (!confirm(`Remove ${email} from the waitlist?`)) return;
    setBusy(true);
    try {
      await adminDeleteWaitlistEntry({ data: { id } });
      toast.success("Removed");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  function exportCsv() {
    if (!rows || rows.length === 0) return;
    const header = ["Name", "Email", "Role", "Clinic", "Consent given at", "Signed up"];
    const escape = (v: string | null | undefined) => {
      const s = (v ?? "").replace(/"/g, '""');
      return `"${s}"`;
    };
    const lines = [header.join(",")].concat(
      rows.map((r) => [
        escape(r.name),
        escape(r.email),
        escape(r.role),
        escape(r.clinic_name),
        escape(r.consent_at ? new Date(r.consent_at).toISOString() : ""),
        escape(new Date(r.created_at).toISOString()),
      ].join(","))
    );
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `modo-waitlist-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-4 w-4" /> Launch waitlist
            {rows && <Badge variant="secondary">{rows.length}</Badge>}
          </CardTitle>
          <Button size="sm" variant="outline" onClick={exportCsv} disabled={!rows || rows.length === 0}>
            Export CSV
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {rows === null ? (
          <p className="p-4 text-sm italic text-muted-foreground">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="p-4 text-sm italic text-muted-foreground">No sign-ups yet.</p>
        ) : (
          <div className="divide-y">
            {rows.map((r) => (
              <div key={r.id} className="flex items-start gap-3 p-3">
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{r.name || "—"}</span>
                    {r.consent_at ? (
                      <Badge variant="secondary" className="text-[10px]">Consented</Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px]">No consent</Badge>
                    )}
                  </div>
                  <a
                    href={`mailto:${r.email}`}
                    className="block break-all text-sm font-medium text-primary hover:underline"
                  >
                    {r.email}
                  </a>
                  <div className="text-xs text-muted-foreground">
                    {[r.role, r.clinic_name].filter(Boolean).join(" · ") || "—"}
                    {" · joined "}
                    {new Date(r.created_at).toLocaleDateString()}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => remove(r.id, r.email)}
                  disabled={busy}
                  aria-label="Remove"
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
