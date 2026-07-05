import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Trash2, Plus, Mail, RefreshCw, ShieldCheck, Stethoscope, UserRound, Eye } from "lucide-react";
import { listStaff, inviteStaff, updateStaff, revokeStaff, resendStaffInvite, type StaffRole, type StaffScope, type StaffStatus } from "@/lib/staff.functions";
import { listPractitioners } from "@/lib/availability.functions";

export const Route = createFileRoute("/_authenticated/dashboard/staff")({
  ssr: false,
  component: StaffPage,
});

type Staff = {
  id: string; name: string; invited_email: string; role: StaffRole;
  data_scope: StaffScope; practitioner_id: string | null; status: StaffStatus;
  invited_at: string; accepted_at: string | null; last_active_at: string | null;
  invite_expires_at: string | null;
};
type Practitioner = { id: string; name: string };

const ROLES: { value: StaffRole; label: string; desc: string; icon: any }[] = [
  { value: "admin", label: "Admin", desc: "Full access · not bookable", icon: ShieldCheck },
  { value: "practitioner", label: "Practitioner", desc: "Bookable clinician", icon: Stethoscope },
  { value: "receptionist", label: "Receptionist", desc: "Bookings & patients · not bookable", icon: UserRound },
  { value: "viewer", label: "Viewer", desc: "Read-only access", icon: Eye },
];

function StaffPage() {
  const list = useServerFn(listStaff);
  const invite = useServerFn(inviteStaff);
  const update = useServerFn(updateStaff);
  const revoke = useServerFn(revokeStaff);
  const resend = useServerFn(resendStaffInvite);
  const listPracts = useServerFn(listPractitioners);

  const [staff, setStaff] = useState<Staff[]>([]);
  const [practitioners, setPractitioners] = useState<Practitioner[]>([]);
  const [dlgOpen, setDlgOpen] = useState(false);
  const [editing, setEditing] = useState<Staff | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "", email: "", role: "practitioner" as StaffRole,
    data_scope: "clinic" as StaffScope, practitioner_id: "none",
  });

  async function refresh() {
    const [s, p] = await Promise.all([list(), listPracts()]);
    setStaff(s as Staff[]);
    setPractitioners(p as Practitioner[]);
  }
  useEffect(() => { refresh(); }, []);

  function openInvite() {
    setEditing(null);
    setForm({ name: "", email: "", role: "practitioner", data_scope: "clinic", practitioner_id: "none" });
    setDlgOpen(true);
  }
  function openEdit(s: Staff) {
    setEditing(s);
    setForm({
      name: s.name, email: s.invited_email, role: s.role,
      data_scope: s.data_scope, practitioner_id: s.practitioner_id ?? "none",
    });
    setDlgOpen(true);
  }
  async function save() {
    setSaving(true);
    try {
      if (editing) {
        await update({ data: {
          id: editing.id, name: form.name, role: form.role, data_scope: form.data_scope,
          practitioner_id: form.role === "practitioner" ? (form.practitioner_id === "none" ? null : form.practitioner_id) : null,
        } });
        toast.success("Staff updated");
      } else {
        await invite({ data: {
          name: form.name, email: form.email, role: form.role, data_scope: form.data_scope,
          practitioner_id: form.role === "practitioner" ? (form.practitioner_id === "none" ? null : form.practitioner_id) : null,
        } });
        toast.success("Invite sent");
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
    try { await resend({ data: { id } }); toast.success("Invite re-sent"); await refresh(); }
    catch (e: any) { toast.error(e?.message ?? "Failed"); }
  }

  const roleInfo = (r: StaffRole) => ROLES.find((x) => x.value === r)!;

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Staff</h1>
          <p className="text-muted-foreground">Invite your team and control what they can do.</p>
        </div>
        <Button onClick={openInvite}><Plus className="h-4 w-4 mr-1" />Invite staff</Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Team members</CardTitle>
          <CardDescription>Admins have full access but don't appear as bookable practitioners.</CardDescription>
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
                        <div className="text-xs text-muted-foreground truncate">{s.invited_email}</div>
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
                        {s.status === "invited" && (
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
                disabled={!!editing}
                placeholder="sam@example.com"
              />
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
            <Button onClick={save} disabled={saving || !form.name || (!editing && !form.email)}>
              <Mail className="h-4 w-4 mr-1" />
              {saving ? "Saving…" : editing ? "Save changes" : "Send invite"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
