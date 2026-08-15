import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { pilotFeaturesEnabled } from "@/lib/feature-flags";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  getAssociatesContext,
  inviteAssociate,
  updateAssociate,
  removeAssociate,
  respondToAssociateInvite,
  updateMyHostLink,
  leaveHostClinic,

  getAssociateOversight,
  getAssociatePatients,
  saveAssociateIncident,
  listAssociateIncidentsForMe,
  setIncidentResolved,
} from "@/lib/associates.functions";
import { getSeatSummary } from "@/lib/practitioner-billing.functions";
import { SeatCostWarning, seatWillCharge, type SeatSummary } from "@/components/SeatCostWarning";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { UserPlus, ShieldCheck, DoorOpen, Trash2, ExternalLink, AlertTriangle, FileText, Copy, Check } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard/associates/")({
  ssr: false,
  beforeLoad: ({ context }) => {
    const slug = (context as { profile?: { slug?: string } })?.profile?.slug;
    if (!pilotFeaturesEnabled(slug)) throw redirect({ to: "/dashboard/coming-soon" });
  },
  head: () => ({
    meta: [
      { title: "Associates · MODO" },
      { name: "description", content: "Host self-employed practitioners under your clinic's regulatory oversight." },
    ],
  }),
  component: AssociatesPage,
});

const SEVERITIES = ["minor", "moderate", "serious", "near-miss"];

function AssociatesPage() {
  const ctxFn = useServerFn(getAssociatesContext);
  const qc = useQueryClient();
  const { data: ctx, isLoading } = useQuery({ queryKey: ["associates-ctx"], queryFn: () => ctxFn() });

  const invite = useServerFn(inviteAssociate);
  const update = useServerFn(updateAssociate);
  const remove = useServerFn(removeAssociate);
  const respond = useServerFn(respondToAssociateInvite);
  const updateHost = useServerFn(updateMyHostLink);
  const leaveHost = useServerFn(leaveHostClinic);


  const [inviteOpen, setInviteOpen] = useState(false);
  const [warnOpen, setWarnOpen] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", notes: "" });
  const [saving, setSaving] = useState(false);
  const [oversightId, setOversightId] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const fetchSeats = useServerFn(getSeatSummary);
  const { data: seats } = useQuery({ queryKey: ["seat-summary"], queryFn: () => fetchSeats().catch(() => null) });

  /** Be explicit about the plan change before another associate is invited. */
  function requestInvite() {
    if (seatWillCharge(seats as unknown as SeatSummary, "associate")) setWarnOpen(true);
    else setInviteOpen(true);
  }

  const refresh = () => qc.invalidateQueries({ queryKey: ["associates-ctx"] });


  if (isLoading) return <div className="text-sm text-muted-foreground">Loading…</div>;

  const enabled = ctx?.enabled;
  const hostLinks = ctx?.hostLinks ?? [];

  if (!enabled && hostLinks.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="font-serif text-2xl">Associates</CardTitle>
          <CardDescription>
            Host self-employed practitioners who work under your clinic's regulation. This is currently in limited release —
            speak to MODO to have it switched on for your clinic.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  async function submitInvite() {
    setSaving(true);
    try {
      await invite({ data: { name: form.name, email: form.email, notes: form.notes } });
      toast.success("Invite sent");
      setInviteOpen(false);
      setForm({ name: "", email: "", notes: "" });
      refresh();
    } catch (e: any) {
      toast.error(e?.message ?? "Could not send invite");
    } finally {
      setSaving(false);
    }
  }

  async function patch(id: string, p: Record<string, unknown>) {
    try {
      await update({ data: { id, patch: p as any } });
      refresh();
    } catch (e: any) {
      toast.error(e?.message ?? "Could not save");
    }
  }

  async function patchHost(id: string, p: Record<string, boolean>) {
    try {
      await updateHost({ data: { id, patch: p as any } });
      refresh();
    } catch (e: any) {
      toast.error(e?.message ?? "Could not save");
    }
  }


  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-serif text-2xl sm:text-3xl">Associates</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Self-employed practitioners who work inside your clinic. They keep their own MODO account, booking link and
            payments — you keep clinical oversight for audits and incidents.
          </p>
        </div>
        {enabled && (
          <Button onClick={requestInvite} className="rounded-full">
            <UserPlus className="mr-2 h-4 w-4" /> Invite associate
          </Button>
        )}
      </div>

      <SeatCostWarning
        open={warnOpen}
        onOpenChange={setWarnOpen}
        kind="associate"
        seats={seats as unknown as SeatSummary}
        onConfirm={() => { setWarnOpen(false); setInviteOpen(true); }}
      />

      {enabled && seats?.associates && !seats.comped && (
        <Card>
          <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4 text-sm">
            <div>
              <p className="font-medium">
                {seats.associates.used} associate{seats.associates.used === 1 ? "" : "s"} ·{" "}
                {(seats.associates as any).covered ?? seats.associates.included} covered
              </p>
              <p className="text-xs text-muted-foreground">
                The Associates service is{" "}
                {new Intl.NumberFormat("en-GB", { style: "currency", currency: (seats.currency || "gbp").toUpperCase() }).format(seats.associates.moduleCents / 100)}
                /{seats.interval} and covers your first {seats.associates.included} associates. Every further block of{" "}
                {(seats.associates as any).blockSize ?? 5} adds{" "}
                {new Intl.NumberFormat("en-GB", { style: "currency", currency: (seats.currency || "gbp").toUpperCase() }).format(seats.associates.addonCents / 100)}
                /{seats.interval}, collected from your next billing date.
              </p>
            </div>
          </CardContent>
        </Card>
      )}



      {/* Invitations addressed to me */}
      {hostLinks.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Clinics you work in</CardTitle>
            <CardDescription>Host clinics that provide your room and hold regulatory oversight of your work.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {hostLinks.map((h: any) => (
              <div key={h.id} className="space-y-3 rounded-xl border p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-medium">{h.clinic_name ?? "Clinic"}</div>
                    <div className="text-xs text-muted-foreground">
                      They can see: {[h.oversight_records && "clinical records", h.oversight_appointments && "appointments", h.oversight_incidents && "incidents"].filter(Boolean).join(" · ") || "nothing"}
                      {h.room_allocation_enabled ? " · room auto-allocated" : ""}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={h.status === "active" ? "default" : "secondary"}>{h.status}</Badge>
                    {h.status !== "active" && h.status !== "revoked" && (
                      <>
                        <Button size="sm" onClick={async () => { await respond({ data: { id: h.id, accept: true } }); toast.success("Joined"); refresh(); }}>Accept</Button>
                        <Button size="sm" variant="ghost" onClick={async () => { await respond({ data: { id: h.id, accept: false } }); refresh(); }}>Decline</Button>
                      </>
                    )}
                  </div>
                </div>

                {h.status === "active" && (
                  <div className="space-y-2 border-t pt-3">
                    <div className="text-xs font-medium text-muted-foreground">What this clinic can see</div>
                    <ToggleRow
                      label="Clinical records"
                      desc="Notes, consents, forms"
                      checked={h.oversight_records}
                      onChange={(v) => patchHost(h.id, { oversight_records: v })}
                    />
                    <ToggleRow
                      label="Appointments"
                      desc="Your diary and bookings"
                      checked={h.oversight_appointments}
                      onChange={(v) => patchHost(h.id, { oversight_appointments: v })}
                    />
                    <ToggleRow
                      label="Incidents"
                      desc="Adverse events & complaints"
                      checked={h.oversight_incidents}
                      onChange={(v) => patchHost(h.id, { oversight_incidents: v })}
                    />
                    <p className="text-[11px] text-muted-foreground">
                      Your host clinic may be required to hold oversight for regulatory audits — check your agreement before
                      switching these off.
                    </p>
                    <div className="pt-1">
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-destructive"
                        onClick={async () => {
                          if (!confirm(`Remove ${h.clinic_name ?? "this clinic"} as your clinic owner? They will lose all access to your records.`)) return;
                          try {
                            await leaveHost({ data: { id: h.id } });
                            toast.success("Clinic removed");
                            refresh();
                          } catch (e: any) {
                            toast.error(e?.message ?? "Could not remove clinic");
                          }
                        }}
                      >
                        <Trash2 className="mr-2 h-4 w-4" /> Remove clinic owner
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ))}

          </CardContent>
        </Card>
      )}

      <IncidentsPanel onOpenAssociate={(linkId) => setOversightId(linkId)} />



      {enabled && (
        <div className="space-y-4">
          {(ctx?.associates ?? []).length === 0 && (
            <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">No associates yet. Invite your first self-employed practitioner.</CardContent></Card>
          )}
          {(ctx?.associates ?? []).map((a: any) => {
            const bookingUrl = a.associate_slug ? `https://modobook.uk/m/${a.associate_slug}` : null;
            return (
              <Card key={a.id}>
                <CardHeader className="pb-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <CardTitle className="text-base">{a.associate_name || a.invited_name}</CardTitle>
                      <CardDescription className="break-all">{a.invited_email}</CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={a.status === "active" ? "default" : "secondary"}>{a.status}</Badge>
                      <Button asChild size="sm" className="rounded-full">
                        <Link to="/dashboard/associates/$id" params={{ id: a.id }}>
                          <ShieldCheck className="mr-2 h-4 w-4" /> Open
                        </Link>
                      </Button>
                      <Button size="icon" variant="ghost" onClick={async () => { if (confirm("Remove this associate link?")) { await remove({ data: { id: a.id } }); refresh(); } }}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex flex-wrap gap-2 text-xs">
                    {[
                      a.oversight_records && "Records",
                      a.oversight_appointments && "Appointments",
                      a.oversight_incidents && "Incidents",
                      a.room_allocation_enabled && "Room allocated",
                      a.seat_sponsored && "Seat sponsored",
                    ]
                      .filter(Boolean)
                      .map((t) => (
                        <Badge key={String(t)} variant="secondary" className="rounded-full font-normal">{t}</Badge>
                      ))}
                  </div>
                  {bookingUrl && (
                    <div className="flex flex-wrap items-center gap-2 rounded-lg bg-muted/50 p-3 text-xs">
                      <span className="text-muted-foreground">Their booking link</span>
                      <code className="break-all">{bookingUrl}</code>
                      <Button size="sm" variant="ghost" onClick={() => { navigator.clipboard.writeText(bookingUrl); setCopied(a.id); setTimeout(() => setCopied(null), 1500); }}>
                        {copied === a.id ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                      </Button>
                      <a href={bookingUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary">
                        Open <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}

        </div>
      )}

      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invite an associate</DialogTitle>
            <DialogDescription>
              They'll create (or sign into) their own MODO account with this email address, then accept your oversight link.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Jane Smith" />
            </div>
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="jane@clinic.co.uk" />
            </div>
            <div className="space-y-1.5">
              <Label>Internal notes (optional)</Label>
              <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setInviteOpen(false)}>Cancel</Button>
            <Button onClick={submitInvite} disabled={saving}>{saving ? "Sending…" : "Send invite"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {oversightId && <OversightDialog id={oversightId} onClose={() => setOversightId(null)} />}
    </div>
  );
}

function ToggleRow({ label, desc, checked, onChange }: { label: string; desc: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-lg border p-3">
      <div className="min-w-0">
        <div className="text-sm font-medium">{label}</div>
        <div className="text-xs text-muted-foreground">{desc}</div>
      </div>
      <Switch checked={!!checked} onCheckedChange={onChange} />
    </div>
  );
}

function OversightDialog({ id, onClose }: { id: string; onClose: () => void }) {
  const oversight = useServerFn(getAssociateOversight);
  const patientsFn = useServerFn(getAssociatePatients);
  const recordFn = useServerFn(getAssociatePatientRecord);
  const saveIncident = useServerFn(saveAssociateIncident);
  const qc = useQueryClient();

  const { data } = useQuery({ queryKey: ["associate-oversight", id], queryFn: () => oversight({ data: { id } }) });
  const { data: patients } = useQuery({ queryKey: ["associate-patients", id], queryFn: () => patientsFn({ data: { id } }) });
  const [openClient, setOpenClient] = useState<string | null>(null);
  const { data: record } = useQuery({
    queryKey: ["associate-record", id, openClient],
    queryFn: () => recordFn({ data: { id, clientId: openClient! } }),
    enabled: !!openClient,
  });

  const [incident, setIncident] = useState({ title: "", severity: "minor", description: "", action_taken: "", occurred_at: new Date().toISOString().slice(0, 10) });

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Regulatory oversight</DialogTitle>
          <DialogDescription>Read-only audit view of this associate's clinical activity. Access is logged.</DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="appointments">
          <TabsList className="flex w-full overflow-x-auto">
            <TabsTrigger value="appointments">Appointments</TabsTrigger>
            <TabsTrigger value="patients">Patients</TabsTrigger>
            <TabsTrigger value="incidents">Incidents</TabsTrigger>
            <TabsTrigger value="rooms">Room use</TabsTrigger>
          </TabsList>

          <TabsContent value="appointments" className="space-y-2 pt-4">
            {(data?.appointments ?? []).length === 0 && <p className="text-sm text-muted-foreground">Nothing to show.</p>}
            {(data?.appointments ?? []).map((a: any) => (
              <div key={a.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-sm">
                <div>
                  <div className="font-medium">{a.patient_name}</div>
                  <div className="text-xs text-muted-foreground">{a.treatments?.name ?? "Appointment"} · {a.scheduled_date} {String(a.start_time).slice(0, 5)}</div>
                </div>
                <Badge variant="secondary">{a.status}</Badge>
              </div>
            ))}
          </TabsContent>

          <TabsContent value="patients" className="space-y-2 pt-4">
            {(patients ?? []).length === 0 && <p className="text-sm text-muted-foreground">No patient records shared.</p>}
            {(patients ?? []).map((p: any) => (
              <button key={p.id} onClick={() => setOpenClient(p.id === openClient ? null : p.id)} className="w-full rounded-lg border p-3 text-left text-sm hover:bg-muted/50">
                <div className="font-medium">{p.first_name} {p.last_name}</div>
                <div className="text-xs text-muted-foreground">{p.email}</div>
              </button>
            ))}
            {openClient && record && (
              <div className="space-y-3 rounded-xl border bg-muted/30 p-4 text-sm">
                <div className="flex items-center gap-2 font-medium"><FileText className="h-4 w-4" /> Record</div>
                <div className="text-xs text-muted-foreground">{(record.appointments ?? []).length} appointments · {(record.notes ?? []).length} notes · {(record.consents ?? []).length} consents</div>
                {(record.notes ?? []).length === 0 && <p className="text-xs text-muted-foreground">No clinical notes recorded.</p>}
                {(record.notes ?? []).slice(0, 10).map((n: any) => (
                  <div key={n.id} className="rounded-md bg-background p-3">
                    <div className="text-[11px] text-muted-foreground">{new Date(n.created_at).toLocaleString("en-GB")}</div>
                    <div className="whitespace-pre-wrap">{n.body}</div>
                  </div>
                ))}

              </div>
            )}
          </TabsContent>

          <TabsContent value="incidents" className="space-y-3 pt-4">
            {(data?.incidents ?? []).map((i: any) => (
              <div key={i.id} className="rounded-lg border p-3 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 font-medium"><AlertTriangle className="h-4 w-4 text-amber-600" /> {i.title}</div>
                  <Badge variant="secondary">{i.severity}</Badge>
                </div>
                <div className="mt-1 text-xs text-muted-foreground">{new Date(i.occurred_at).toLocaleDateString("en-GB")}{i.resolved_at ? " · resolved" : ""}</div>
                {i.description && <p className="mt-2 whitespace-pre-wrap">{i.description}</p>}
                {i.action_taken && <p className="mt-2 text-muted-foreground"><strong>Action:</strong> {i.action_taken}</p>}
              </div>
            ))}
            <div className="space-y-2 rounded-xl border p-4">
              <div className="text-sm font-medium">Log an incident</div>
              <Input placeholder="Title" value={incident.title} onChange={(e) => setIncident({ ...incident, title: e.target.value })} />
              <div className="grid gap-2 sm:grid-cols-2">
                <Input type="date" value={incident.occurred_at} onChange={(e) => setIncident({ ...incident, occurred_at: e.target.value })} />
                <Select value={incident.severity} onValueChange={(v) => setIncident({ ...incident, severity: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{SEVERITIES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <Textarea rows={3} placeholder="What happened?" value={incident.description} onChange={(e) => setIncident({ ...incident, description: e.target.value })} />
              <Textarea rows={2} placeholder="Action taken" value={incident.action_taken} onChange={(e) => setIncident({ ...incident, action_taken: e.target.value })} />
              <Button
                size="sm"
                onClick={async () => {
                  if (!incident.title.trim()) return toast.error("Add a title");
                  await saveIncident({ data: { link_id: id, occurred_at: new Date(incident.occurred_at).toISOString(), severity: incident.severity, title: incident.title, description: incident.description, action_taken: incident.action_taken, resolved: false } });
                  toast.success("Incident logged");
                  setIncident({ title: "", severity: "minor", description: "", action_taken: "", occurred_at: new Date().toISOString().slice(0, 10) });
                  qc.invalidateQueries({ queryKey: ["associate-oversight", id] });
                  qc.invalidateQueries({ queryKey: ["associate-incidents-all"] });
                }}
              >
                Save incident
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="rooms" className="space-y-2 pt-4">
            {(data?.roomBookings ?? []).length === 0 && <p className="text-sm text-muted-foreground">No room usage recorded.</p>}
            {(data?.roomBookings ?? []).map((r: any) => (
              <div key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-sm">
                <div className="flex items-center gap-2">
                  <DoorOpen className="h-4 w-4 text-muted-foreground" />
                  <span>{r.booking_date} · {String(r.start_time).slice(0, 5)}–{String(r.end_time).slice(0, 5)}{r.unit_index ? ` · room ${r.unit_index}` : ""}</span>
                </div>
                <div className="flex items-center gap-2">
                  {Number(r.price) > 0 && <span className="text-muted-foreground">£{Number(r.price).toFixed(2)}</span>}
                  <Badge variant="secondary">{r.status}</Badge>
                </div>
              </div>
            ))}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

function IncidentsPanel({ onOpenAssociate }: { onOpenAssociate: (linkId: string) => void }) {
  const listFn = useServerFn(listAssociateIncidentsForMe);
  const resolveFn = useServerFn(setIncidentResolved);
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["associate-incidents-all"], queryFn: () => listFn() });
  const [showResolved, setShowResolved] = useState(false);

  const all = (data ?? []) as any[];
  const open = all.filter((i) => !i.resolved_at);
  const rows = showResolved ? all : open;

  if (isLoading || all.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle className="text-base">Incidents</CardTitle>
            <CardDescription>
              Adverse events and complaints logged across your associate links. {open.length} open.
            </CardDescription>
          </div>
          <Button size="sm" variant="ghost" onClick={() => setShowResolved((v) => !v)}>
            {showResolved ? "Hide resolved" : `Show all (${all.length})`}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {rows.length === 0 && <p className="text-sm text-muted-foreground">No open incidents.</p>}
        {rows.map((i) => (
          <div key={i.id} className="rounded-xl border p-3 text-sm">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2 font-medium">
                <AlertTriangle className={`h-4 w-4 shrink-0 ${i.resolved_at ? "text-muted-foreground" : "text-amber-600"}`} />
                <span className="break-words">{i.title}</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary">{i.severity}</Badge>
                {i.resolved_at && <Badge variant="outline">resolved</Badge>}
              </div>
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              {new Date(i.occurred_at).toLocaleDateString("en-GB")}
              {" · "}
              {i.mine ? i.associate_name ?? "Associate" : `${i.clinic_name ?? "Host clinic"} (host)`}
            </div>
            {i.description && <p className="mt-2 whitespace-pre-wrap">{i.description}</p>}
            {i.action_taken && (
              <p className="mt-2 text-muted-foreground"><strong>Action:</strong> {i.action_taken}</p>
            )}
            <div className="mt-3 flex flex-wrap gap-2">
              {i.mine && i.link_id && (
                <Button size="sm" variant="outline" className="rounded-full" onClick={() => onOpenAssociate(i.link_id)}>
                  <ShieldCheck className="mr-2 h-3.5 w-3.5" /> Open oversight
                </Button>
              )}
              <Button
                size="sm"
                variant="ghost"
                onClick={async () => {
                  try {
                    await resolveFn({ data: { id: i.id, resolved: !i.resolved_at } });
                    qc.invalidateQueries({ queryKey: ["associate-incidents-all"] });
                    qc.invalidateQueries({ queryKey: ["associate-oversight"] });
                  } catch (e: any) {
                    toast.error(e?.message ?? "Could not update");
                  }
                }}
              >
                {i.resolved_at ? "Re-open" : "Mark resolved"}
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
