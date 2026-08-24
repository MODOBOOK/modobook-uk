import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Trash2, Plus, Mail, RefreshCw, ShieldCheck, Stethoscope, UserRound, Eye, AlertTriangle } from "lucide-react";
import { useDemoGuard } from "@/hooks/use-demo-mode";
import { listStaff, inviteStaff, updateStaff, revokeStaff, resendStaffInvite, type StaffRole, type StaffScope, type StaffStatus } from "@/lib/staff.functions";
import { listPractitioners } from "@/lib/availability.functions";
import { getSeatSummary } from "@/lib/practitioner-billing.functions";
import { Link } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/dashboard/staff")({
  ssr: false,
  component: StaffPage,
});

type Staff = {
  id: string; name: string; invited_email: string | null; role: StaffRole;
  data_scope: StaffScope; practitioner_id: string | null; status: StaffStatus;
  invited_at: string; accepted_at: string | null; last_active_at: string | null;
  invite_expires_at: string | null;
};
type Practitioner = { id: string; name: string };

const ROLES: { value: StaffRole; label: string; desc: string; icon: any }[] = [
  { value: "admin", label: "Admin", desc: "Full access · not bookable", icon: ShieldCheck },
  { value: "practitioner", label: "Practitioner", desc: "Bookable clinician · uses a paid seat", icon: Stethoscope },
  { value: "receptionist", label: "Receptionist", desc: "Bookings & patients · not bookable", icon: UserRound },
  { value: "viewer", label: "Viewer", desc: "Read-only access", icon: Eye },
];

function StaffPage() {
  const list = useServerFn(listStaff);
  const demo = useDemoGuard();
  const invite = useServerFn(inviteStaff);
  const update = useServerFn(updateStaff);
  const revoke = useServerFn(revokeStaff);
  const resend = useServerFn(resendStaffInvite);
  const listPracts = useServerFn(listPractitioners);
  const fetchSeats = useServerFn(getSeatSummary);

const [staff, setStaff] = useState<Staff[]>([]);
  const [tab, setTab] = useState<"team" | "updates">("team");
  const [practitioners, setPractitioners] = useState<Practitioner[]>([]);
  const [seats, setSeats] = useState<any>(null);
  const [ownerEmail, setOwnerEmail] = useState<string | null>(null);
  useEffect(() => { supabase.auth.getUser().then(({ data }) => setOwnerEmail(data.user?.email ?? null)); }, []);
  const [dlgOpen, setDlgOpen] = useState(false);
  const [editing, setEditing] = useState<Staff | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "", email: "", role: "practitioner" as StaffRole,
    data_scope: "clinic" as StaffScope, practitioner_id: "none",
  });

  async function refresh() {
    const [s, p, sum] = await Promise.all([list(), listPracts(), fetchSeats().catch(() => null)]);
    setStaff(s as Staff[]);
    setPractitioners(p as Practitioner[]);
    setSeats(sum);
  }
  useEffect(() => { refresh(); }, []);

  function openInvite() {
    if (demo.blocked("Inviting staff is disabled in the demo account.")) return;
    setEditing(null);
    setForm({ name: "", email: "", role: "practitioner", data_scope: "clinic", practitioner_id: "none" });
    setDlgOpen(true);
  }
  function openEdit(s: Staff) {
    setEditing(s);
    setForm({
      name: s.name, email: s.invited_email ?? "", role: s.role,
      data_scope: s.data_scope, practitioner_id: s.practitioner_id ?? "none",
    });
    setDlgOpen(true);
  }
  async function save() {
    if (!editing && demo.blocked("Inviting staff is disabled in the demo account.")) return;
    setSaving(true);
    try {
      if (editing) {
        await update({ data: {
          id: editing.id, name: form.name, email: form.email, role: form.role, data_scope: form.data_scope,
          practitioner_id: form.role === "practitioner" ? (form.practitioner_id === "none" ? null : form.practitioner_id) : null,
        } });
        toast.success("Staff updated");
      } else {
        await invite({ data: {
          name: form.name, email: form.email, role: form.role, data_scope: form.data_scope,
          practitioner_id: form.role === "practitioner" ? (form.practitioner_id === "none" ? null : form.practitioner_id) : null,
        } });
        toast.success(form.email.trim() ? "Invite sent" : "Team member added");
      }
      setDlgOpen(false);
      await refresh();
    } catch (e: any) { toast.error(e?.message ?? "Failed"); }
    finally { setSaving(false); }
  }
  async function toggleDisable(s: Staff) {
    try {
      await update({ data: { id: s.id, status: s.status === "disabled" ? "active" : "disabled" } });
      await refresh();
    } catch (e: any) { toast.error(e?.message ?? "Failed"); }
  }
  async function remove(id: string) {
    if (!confirm("Remove this staff member? Their access will be revoked.")) return;
    try { await revoke({ data: { id } }); await refresh(); toast.success("Removed"); }
    catch (e: any) { toast.error(e?.message ?? "Failed"); }
  }
  async function resendInvite(id: string) {
    if (demo.blocked("Inviting staff is disabled in the demo account.")) return;
    try { await resend({ data: { id } }); toast.success("Invite re-sent"); await refresh(); }
    catch (e: any) { toast.error(e?.message ?? "Failed"); }
  }

  const roleInfo = (r: StaffRole) => ROLES.find((x) => x.value === r)!;

return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Staff</h1>
          <p className="text-muted-foreground">
            Everyone who works at your clinic lives here — each person gets their own login.
          </p>
        </div>
        {tab === "team" && <Button onClick={openInvite}><Plus className="h-4 w-4 mr-1" />Add team member</Button>}
      </div>

      <div className="flex gap-1 rounded-full border border-border/60 bg-muted/40 p-1 sm:w-fit">
        <button
          type="button"
          onClick={() => setTab("team")}
          className={
            "flex-1 sm:flex-none rounded-full px-4 py-1.5 text-sm font-medium transition " +
            (tab === "team" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")
          }
        >
          Team members
        </button>
        <button
          type="button"
          onClick={() => setTab("updates")}
          className={
            "flex-1 sm:flex-none rounded-full px-4 py-1.5 text-sm font-medium transition " +
            (tab === "updates" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")
          }
        >
          Staff updates
        </button>
      </div>

      {tab === "updates" && (
        <Card>
          <CardHeader>
            <CardTitle>Staff updates</CardTitle>
            <CardDescription>
              Individual rotas and staff payments — so each team member has their own hours and gets paid the way you agree.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            <p>
              This is finishing final testing with our pilot clinic and will switch on for your account shortly — no
              action needed from you.
            </p>
            <ul className="mt-4 space-y-2">
              <li className="flex gap-2"><span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-primary" /><span>Individual rotas per staff member, set separately from the clinic rota</span></li>
              <li className="flex gap-2"><span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-primary" /><span>Commission-based pay tracked automatically from the treatments they deliver</span></li>
              <li className="flex gap-2"><span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-primary" /><span>Or let staff connect their own Stripe account so payments go straight to them</span></li>
            </ul>
          </CardContent>
        </Card>
      )}

{tab === "team" && (
      <>
        {seats && !seats.comped && (
          <Card>
            <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
              <div className="text-sm">
                <p className="font-medium">
                  {seats.practitioners.used} of {seats.practitioners.allowed} treating {seats.practitioners.allowed === 1 ? "seat" : "seats"} used
                </p>
                <p className="text-xs text-muted-foreground">
                  Admins, receptionists and viewers are free. Adding another Practitioner adds a seat to your
                  plan automatically from your next billing date.
                </p>
              </div>
              <Button asChild variant="outline" size="sm"><Link to="/dashboard/billing">Billing</Link></Button>
            </CardContent>
          </Card>
        )}

      <Card>
        <CardHeader>
          <CardTitle>Team members</CardTitle>
          <CardDescription>
            Admins, receptionists and viewers have logins but never appear as bookable clinicians.
            Practitioners get a bookable calendar — edit their photo, title, bio and locations on{" "}
            <Link to="/dashboard/practitioners" className="underline underline-offset-2">booking profiles</Link>.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {staff.length === 0 ? (
            <div className="text-sm text-muted-foreground py-8 text-center">
              No staff yet. Invite your first team member to get started.
            </div>
          ) : (
            <div className="space-y-2">
              {staff.map((s) => {
                const info = roleInfo(s.role);
                const Icon = info.icon;
                return (
                  <div key={s.id} className="rounded-lg border p-3 flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-10 w-10 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <div className="font-medium truncate">{s.name}</div>
                        <div className="text-xs text-muted-foreground truncate">
                          {s.invited_email ?? "No login yet — add an email to invite them"}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="secondary">{info.label}</Badge>
                      <Badge variant="outline" className="text-xs">
                        {s.data_scope === "own" ? "Own patients" : "Whole clinic"}
                      </Badge>
                      <Badge
                        variant={s.status === "active" ? "default" : s.status === "invited" ? "outline" : "destructive"}
                        className="text-xs"
                      >
                        {s.status}
                      </Badge>
                      <div className="flex items-center gap-1">
                        {s.status === "invited" && s.invited_email && (
                          <Button variant="ghost" size="icon" title="Resend invite" onClick={() => resendInvite(s.id)}>
                            <RefreshCw className="h-4 w-4" />
                          </Button>
                        )}
                        <Button variant="ghost" size="sm" onClick={() => openEdit(s)}>Edit</Button>
                        <Button variant="ghost" size="sm" onClick={() => toggleDisable(s)}>
                          {s.status === "disabled" ? "Enable" : "Disable"}
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => remove(s.id)}><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dlgOpen} onOpenChange={setDlgOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit staff" : "Invite staff"}</DialogTitle>
            <DialogDescription>
              {editing ? "Change their role or access." : "They'll receive an email invite with a login link."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Name</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Sam Jones" />
            </div>
            <div>
              <Label>Email</Label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                disabled={!!editing && !!editing.invited_email}
                placeholder="sam@example.com"
              />
              {!editing && ownerEmail && form.email.trim().toLowerCase() === ownerEmail.toLowerCase() && (
                <div className="mt-2 flex gap-2 items-start rounded-md border border-destructive/40 bg-destructive/5 p-2 text-xs text-destructive">
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>
                    That's the email you use to sign in as the clinic owner. Inviting your own
                    login as staff won't create a second account — use a different address (a
                    "you+viewer@…" alias works with Gmail/Outlook).
                  </span>
                </div>
              )}
            </div>
            <div>
              <Label>Role</Label>
              <div className="grid grid-cols-2 gap-2 mt-1">
                {ROLES.map((r) => (
                  <button
                    key={r.value}
                    type="button"
                    onClick={() => setForm({ ...form, role: r.value })}
                    className={
                      "text-left rounded-lg border p-3 transition-colors " +
                      (form.role === r.value ? "border-primary bg-primary/10" : "hover:bg-muted")
                    }
                  >
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <r.icon className="h-4 w-4" />{r.label}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">{r.desc}</div>
                  </button>
                ))}
              </div>
            </div>
            <div>
              <Label>What can they see?</Label>
              <Select value={form.data_scope} onValueChange={(v) => setForm({ ...form, data_scope: v as StaffScope })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="clinic">Whole clinic — all patients & bookings</SelectItem>
                  <SelectItem value="own">Only their own patients & bookings</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {form.role === "practitioner" && practitioners.length > 0 && (
              <div>
                <Label>Link to practitioner</Label>
                <Select value={form.practitioner_id} onValueChange={(v) => setForm({ ...form, practitioner_id: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Create separate — link later</SelectItem>
                    {practitioners.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">Their bookable calendar will map to this practitioner.</p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDlgOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving || !form.name || (!!ownerEmail && form.email.trim().toLowerCase() === ownerEmail.toLowerCase())}>
              <Mail className="h-4 w-4 mr-1" />
              {saving ? "Saving…" : editing ? "Save changes" : form.email.trim() ? "Send invite" : "Add team member"}
            </Button>
          </DialogFooter>
</DialogContent>
      </Dialog>
      )}
    </div>
  );
}
