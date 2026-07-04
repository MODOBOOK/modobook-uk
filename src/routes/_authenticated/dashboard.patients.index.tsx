import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { listClients, listArchivedClients, restoreClient, upsertClient, deleteClient, importClientsCsv, assignClientsToGroup, findDuplicateClients, mergeClients } from "@/lib/clients.functions";
import { listMyAppointments } from "@/lib/availability.functions";
import { createConsultation, listConsultationsForPatient } from "@/lib/consultations.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import {
  Plus, Search, Upload, Users, Combine, Loader2, Mail, Phone,
  Calendar, ClipboardList, Pencil, Trash2, ChevronRight, X,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/dashboard/patients/")({
  ssr: false,
  component: PatientsPage,
});

type Client = {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  dob: string | null;
  gender: string | null;
  address: string | null;
  group_name: string | null;
  notes: string | null;
  avatar_url: string | null;
  has_allergies?: boolean | null;
  allergies?: string | null;
};

type Appt = Awaited<ReturnType<typeof listMyAppointments>>[number];

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() ?? "")
    .join("") || "?";
}

const EMPTY_FORM: Omit<Client, "id"> = {
  full_name: "",
  email: "",
  phone: "",
  dob: "",
  gender: "",
  address: "",
  group_name: "",
  notes: "",
  avatar_url: "",
  has_allergies: false,
  allergies: "",
};

function PatientsPage() {
  const list = useServerFn(listClients);
  const listArchived = useServerFn(listArchivedClients);
  const restore = useServerFn(restoreClient);
  const upsert = useServerFn(upsertClient);
  const remove = useServerFn(deleteClient);
  const listAppt = useServerFn(listMyAppointments);

  const [clients, setClients] = useState<Client[]>([]);
  const [archivedClients, setArchivedClients] = useState<Client[]>([]);
  const [view, setView] = useState<"active" | "archived">("active");
  const [appts, setAppts] = useState<Appt[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Client | null>(null);
  const [form, setForm] = useState<typeof EMPTY_FORM & { id?: string }>(EMPTY_FORM);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [drawer, setDrawer] = useState<Client | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [groupOpen, setGroupOpen] = useState(false);
  const [mergeOpen, setMergeOpen] = useState(false);
  const navigate = useNavigate();
  const importCsv = useServerFn(importClientsCsv);
  const assignGroup = useServerFn(assignClientsToGroup);
  const findDupes = useServerFn(findDuplicateClients);
  const doMerge = useServerFn(mergeClients);

  async function refresh() {
    const [c, ar, a] = await Promise.all([list(), listArchived(), listAppt()]);
    setClients(c as Client[]);
    setArchivedClients(ar as Client[]);
    setAppts(a as Appt[]);
    setLoading(false);
  }

  useEffect(() => { refresh(); /* eslint-disable-next-line */ }, []);

  // Aggregate appointment-based patients that aren't yet in clients list (read-only)
  const allEntries = useMemo(() => {
    if (view === "archived") {
      const q = search.trim().toLowerCase();
      const arr = archivedClients;
      return q
        ? arr.filter((c) =>
            c.full_name.toLowerCase().includes(q) ||
            (c.email ?? "").toLowerCase().includes(q) ||
            (c.phone ?? "").toLowerCase().includes(q))
        : arr;
    }
    const fromClients: Client[] = clients;
    const knownEmails = new Set(clients.map((c) => (c.email ?? "").toLowerCase()).filter(Boolean));
    const knownNames = new Set(clients.map((c) => c.full_name.toLowerCase()));
    const archivedEmails = new Set(archivedClients.map((c) => (c.email ?? "").toLowerCase()).filter(Boolean));
    const archivedNames = new Set(archivedClients.map((c) => c.full_name.toLowerCase()));
    const synthetic = new Map<string, Client>();
    for (const a of appts) {
      const email = (a.patient_email ?? "").toLowerCase();
      const nm = (a.patient_name ?? "").toLowerCase();
      if (email && (knownEmails.has(email) || archivedEmails.has(email))) continue;
      if (!email && nm && (knownNames.has(nm) || archivedNames.has(nm))) continue;
      const key = email || nm || a.id;
      if (synthetic.has(key)) continue;
      synthetic.set(key, {
        id: `appt:${key}`,
        full_name: a.patient_name || "(no name)",
        email: a.patient_email ?? null,
        phone: a.patient_phone ?? null,
        dob: null, gender: null, address: null, group_name: null, notes: null, avatar_url: null,
      });
    }
    const arr = [...fromClients, ...synthetic.values()];
    const q = search.trim().toLowerCase();
    return q
      ? arr.filter((c) =>
          c.full_name.toLowerCase().includes(q) ||
          (c.email ?? "").toLowerCase().includes(q) ||
          (c.phone ?? "").toLowerCase().includes(q))
      : arr;
  }, [clients, archivedClients, appts, search, view]);

  const grouped = useMemo(() => {
    const sorted = [...allEntries].sort((a, b) => a.full_name.localeCompare(b.full_name));
    const m = new Map<string, Client[]>();
    for (const c of sorted) {
      const letter = (c.full_name[0] || "#").toUpperCase();
      const key = /[A-Z]/.test(letter) ? letter : "#";
      if (!m.has(key)) m.set(key, []);
      m.get(key)!.push(c);
    }
    return Array.from(m.entries());
  }, [allEntries]);

  function openAdd() {
    setForm({ ...EMPTY_FORM });
    setEditing(null);
    setOpen(true);
  }
  function openEdit(c: Client) {
    if (c.id.startsWith("appt:")) {
      setForm({
        full_name: c.full_name,
        email: c.email ?? "",
        phone: c.phone ?? "",
        dob: "", gender: "", address: "", group_name: "", notes: "", avatar_url: "",
        has_allergies: false, allergies: "",
      });
      setEditing(null);
    } else {
      setForm({
        id: c.id,
        full_name: c.full_name,
        email: c.email ?? "",
        phone: c.phone ?? "",
        dob: c.dob ?? "",
        gender: c.gender ?? "",
        address: c.address ?? "",
        group_name: c.group_name ?? "",
        notes: c.notes ?? "",
        avatar_url: c.avatar_url ?? "",
        has_allergies: !!c.has_allergies,
        allergies: c.allergies ?? "",
      });
      setEditing(c);
    }
    setOpen(true);
  }

  async function save() {
    if (!form.full_name.trim()) {
      toast.error("Name is required");
      return;
    }
    if (!form.dob || !form.dob.trim()) {
      toast.error("Date of birth is required");
      return;
    }
    setSaving(true);
    try {
      await upsert({ data: { ...form, has_allergies: !!form.has_allergies, allergies: form.allergies || null } });
      toast.success(editing ? "Client updated" : "Client added");
      setOpen(false);
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Move this patient to the archive? You can restore them later.")) return;
    try {
      await remove({ data: { id } });
      toast.success("Patient archived");
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to archive");
    }
  }

  async function handleRestore(id: string) {
    try {
      await restore({ data: { id } });
      toast.success("Patient restored");
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to restore");
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4 pb-12">
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-bold">Patient List</h1>
          <p className="text-xs text-muted-foreground">Manage your patient contacts</p>
        </div>
        <div className="shrink-0 text-xs text-muted-foreground">
          {allEntries.length} {view === "archived" ? "archived" : "total"}
        </div>
      </header>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <ActionPill icon={Upload} label="Import Patients" onClick={() => setImportOpen(true)} />
        <ActionPill icon={Plus} label="Add Patient" onClick={openAdd} primary />
        <ActionPill icon={Users} label="Create Group" onClick={() => setGroupOpen(true)} />
        <ActionPill icon={Combine} label="Merge Duplicates" onClick={() => setMergeOpen(true)} />
      </div>

      <div className="inline-flex rounded-lg border p-0.5 text-xs">
        <button
          type="button"
          onClick={() => setView("active")}
          className={`rounded-md px-3 py-1.5 font-medium ${view === "active" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
        >
          Active ({clients.length})
        </button>
        <button
          type="button"
          onClick={() => setView("archived")}
          className={`rounded-md px-3 py-1.5 font-medium ${view === "archived" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
        >
          Archived ({archivedClients.length})
        </button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, email or number"
          className="pl-10"
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : grouped.length === 0 ? (
        <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">
          No clients yet — add your first one above.
        </CardContent></Card>
      ) : (
        <div className="space-y-4">
          {grouped.map(([letter, group]) => (
            <section key={letter}>
              <div className="border-b py-2 text-sm font-bold text-primary">{letter}</div>
              <div className="divide-y">
                {group.map((c) => (
                  <button
                    key={c.id}
                    onClick={async () => {
                      if (!c.id.startsWith("appt:")) {
                        navigate({ to: "/dashboard/patients/$id", params: { id: c.id } });
                        return;
                      }
                      try {
                        const row: any = await upsert({ data: {
                          full_name: c.full_name,
                          email: c.email || null,
                          phone: c.phone || null,
                        }});
                        navigate({ to: "/dashboard/patients/$id", params: { id: row.id } });
                      } catch (e) {
                        toast.error(e instanceof Error ? e.message : "Could not open profile");
                      }
                    }}
                    className="flex w-full items-center gap-3 py-3 text-left hover:bg-muted/40"
                  >
                    <div className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-full bg-primary/10 text-sm font-bold text-primary">
                      {c.avatar_url ? (
                        <img src={c.avatar_url} alt="" className="h-full w-full object-cover" />
                      ) : (
                        initials(c.full_name)
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate font-semibold">{c.full_name}</span>
                        {c.has_allergies && (
                          <span className="shrink-0 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold uppercase text-red-700">⚠ Allergy</span>
                        )}
                      </div>
                      <div className="truncate text-xs text-muted-foreground">
                        {c.phone || c.email || "No contact info"}
                      </div>
                      {c.email && c.phone && (
                        <div className="truncate text-xs text-muted-foreground">{c.email}</div>
                      )}
                      {c.has_allergies && c.allergies && (
                        <div className="truncate text-xs font-medium text-red-600">Allergies: {c.allergies}</div>
                      )}
                    </div>
                    <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {/* Add/Edit dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader><DialogTitle>{editing ? "Edit client" : "Add client"}</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <Field label="Full name" required>
              <Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Email"><Input type="email" value={form.email ?? ""} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
              <Field label="Phone"><Input value={form.phone ?? ""} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Date of birth" required><Input type="date" required value={form.dob ?? ""} onChange={(e) => setForm({ ...form, dob: e.target.value })} /></Field>
              <Field label="Gender">
                <Select value={form.gender ?? ""} onValueChange={(v) => setForm({ ...form, gender: v })}>
                  <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="female">Female</SelectItem>
                    <SelectItem value="male">Male</SelectItem>
                    <SelectItem value="nonbinary">Non-binary</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                    <SelectItem value="undisclosed">Prefer not to say</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            </div>
            <Field label="Address">
              <Textarea rows={2} value={form.address ?? ""} onChange={(e) => setForm({ ...form, address: e.target.value })} />
            </Field>
            <Field label="Group">
              <Input placeholder="e.g. VIP, Family" value={form.group_name ?? ""} onChange={(e) => setForm({ ...form, group_name: e.target.value })} />
            </Field>
            <Field label="Notes">
              <Textarea rows={3} value={form.notes ?? ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </Field>
            <div className="rounded-md border border-red-200 bg-red-50/50 p-3 space-y-2">
              <label className="flex items-center gap-2 text-sm font-semibold text-red-700">
                <input
                  type="checkbox"
                  className="h-4 w-4"
                  checked={!!form.has_allergies}
                  onChange={(e) => setForm({ ...form, has_allergies: e.target.checked })}
                />
                ⚠ This patient has allergies
              </label>
              {form.has_allergies && (
                <Textarea
                  rows={2}
                  placeholder="List allergies (e.g. penicillin, latex, lidocaine)"
                  value={form.allergies ?? ""}
                  onChange={(e) => setForm({ ...form, allergies: e.target.value })}
                />
              )}
            </div>
          </div>
          <DialogFooter>
            {editing && (
              <Button variant="ghost" className="text-destructive" onClick={() => { handleDelete(editing.id); setOpen(false); }}>
                <Trash2 className="mr-2 h-4 w-4" /> Delete
              </Button>
            )}
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving}>{saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail drawer */}
      <Sheet open={!!drawer} onOpenChange={(v) => !v && setDrawer(null)}>
        <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto rounded-t-2xl sm:max-w-xl sm:rounded-2xl">
          {drawer && (
            <PatientDetail
              client={drawer}
              appts={appts.filter((a) =>
                (drawer.email && a.patient_email?.toLowerCase() === drawer.email.toLowerCase()) ||
                (!drawer.email && a.patient_name?.toLowerCase() === drawer.full_name.toLowerCase())
              )}
              onEdit={() => { setDrawer(null); openEdit(drawer); }}
            />
          )}
        </SheetContent>
      </Sheet>

      <ImportCsvDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        onImport={async (rows) => {
          const res: any = await importCsv({ data: { rows } });
          const detail = res.skippedDetails?.length ? ` — first issue: ${res.skippedDetails[0]}` : "";
          toast.success(`Imported ${res.inserted}, updated ${res.updated}${res.skipped ? `, skipped ${res.skipped}${detail}` : ""}`);
          setImportOpen(false);

          refresh();
        }}
      />

      <CreateGroupDialog
        open={groupOpen}
        onOpenChange={setGroupOpen}
        clients={clients}
        onSave={async (name, ids) => {
          await assignGroup({ data: { client_ids: ids, group_name: name } });
          toast.success(`Added ${ids.length} to "${name}"`);
          setGroupOpen(false);
          refresh();
        }}
      />

      <MergeDuplicatesDialog
        open={mergeOpen}
        onOpenChange={setMergeOpen}
        loadGroups={async () => (await findDupes()) as any}
        onMerge={async (keep_id, merge_ids) => {
          await doMerge({ data: { keep_id, merge_ids } });
          toast.success("Merged");
          refresh();
        }}
      />
    </div>
  );
}

function ActionPill({ icon: Icon, label, onClick, primary }: {
  icon: React.ComponentType<{ className?: string }>; label: string; onClick: () => void; primary?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center justify-center gap-1 rounded-2xl border px-3 py-3 text-xs font-semibold transition active:scale-95 ${
        primary ? "bg-primary text-primary-foreground border-primary" : "bg-card hover:bg-muted"
      }`}
    >
      <Icon className="h-5 w-5" />
      <span className="text-center leading-tight">{label}</span>
    </button>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}{required && <span className="text-destructive"> *</span>}</Label>
      {children}
    </div>
  );
}

function PatientDetail({ client, appts, onEdit }: { client: Client; appts: Appt[]; onEdit: () => void }) {
  const createConsult = useServerFn(createConsultation);
  const listConsults = useServerFn(listConsultationsForPatient);
  const [consults, setConsults] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    (async () => {
      const data: any = await listConsults({ data: { email: client.email || undefined, name: client.email ? undefined : client.full_name } });
      setConsults(data ?? []);
    })();
    // eslint-disable-next-line
  }, [client.id]);

  async function startConsultation() {
    setBusy(true);
    try {
      const res: any = await createConsult({ data: {
        patient_name: client.full_name,
        patient_email: client.email || undefined,
        patient_phone: client.phone || undefined,
      } });
      window.location.href = `/dashboard/consultations/${res.id}`;
    } finally { setBusy(false); }
  }

  return (
    <div className="space-y-4">
      <SheetHeader>
        <div className="flex items-center gap-3">
          <div className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-full bg-primary/10 text-base font-bold text-primary">
            {client.avatar_url ? <img src={client.avatar_url} alt="" className="h-full w-full object-cover" /> : initials(client.full_name)}
          </div>
          <div className="min-w-0 flex-1">
            <SheetTitle className="truncate text-left">{client.full_name}</SheetTitle>
            <div className="space-y-0.5 text-left text-xs text-muted-foreground">
              {client.email && <div className="flex items-center gap-1"><Mail className="h-3 w-3" />{client.email}</div>}
              {client.phone && <div className="flex items-center gap-1"><Phone className="h-3 w-3" />{client.phone}</div>}
            </div>
          </div>
          {!client.id.startsWith("appt:") && (
            <Button size="icon" variant="ghost" onClick={onEdit}><Pencil className="h-4 w-4" /></Button>
          )}
        </div>
      </SheetHeader>

      {(client.dob || client.gender || client.address || client.group_name) && (
        <div className="grid gap-2 rounded-lg border bg-muted/30 p-3 text-xs">
          {client.dob && <div><span className="font-semibold">DOB:</span> {client.dob}</div>}
          {client.gender && <div><span className="font-semibold">Gender:</span> {client.gender}</div>}
          {client.address && <div><span className="font-semibold">Address:</span> {client.address}</div>}
          {client.group_name && <div><span className="font-semibold">Group:</span> {client.group_name}</div>}
        </div>
      )}

      {client.id.startsWith("appt:") && (
        <Card className="border-dashed bg-muted/30">
          <CardContent className="flex items-center justify-between gap-3 p-3 text-xs">
            <span>This patient came from a booking — save them to your client list to add full details.</span>
            <Button size="sm" onClick={onEdit}>Save</Button>
          </CardContent>
        </Card>
      )}

      <div className="space-y-2">
        <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Bookings</div>
        {appts.length === 0 ? (
          <div className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">No bookings yet.</div>
        ) : (
          appts.slice(0, 10).map((b) => (
            <div key={b.id} className="flex items-center justify-between rounded-md border p-2.5 text-sm">
              <div className="min-w-0">
                <div className="truncate font-medium">{(b as any).treatments?.name ?? "Treatment"}</div>
                <div className="text-xs text-muted-foreground">
                  <Calendar className="mr-1 inline h-3 w-3" />{b.scheduled_date} · {String(b.start_time).slice(0, 5)}
                </div>
              </div>
              <Badge variant={b.status === "cancelled" ? "destructive" : "outline"}>{b.status}</Badge>
            </div>
          ))
        )}
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Consultations</div>
          <Button size="sm" variant="outline" onClick={startConsultation} disabled={busy}>
            {busy ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Plus className="mr-1 h-3.5 w-3.5" />} New
          </Button>
        </div>
        {consults.length === 0 ? (
          <div className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">No consultations on file.</div>
        ) : consults.map((r) => (
          <Link
            key={r.id}
            to="/dashboard/consultations/$id"
            params={{ id: r.id }}
            className="flex items-center justify-between rounded-md border p-2.5 text-sm hover:bg-muted"
          >
            <span className="flex items-center gap-2"><ClipboardList className="h-4 w-4 text-primary" />Consultation · {new Date(r.created_at).toLocaleDateString()}</span>
            <Badge variant={r.status === "completed" ? "default" : "secondary"} className="text-[10px]">
              {r.status === "completed" ? "Completed" : `Step ${r.current_step}/8`}
            </Badge>
          </Link>
        ))}
      </div>
    </div>
  );
}

/* ---------- CSV Import ---------- */
function detectDelimiter(sample: string): string {
  const counts: Record<string, number> = { ",": 0, ";": 0, "\t": 0, "|": 0 };
  let inQ = false;
  for (const ch of sample) {
    if (ch === '"') inQ = !inQ;
    else if (!inQ && ch in counts) counts[ch]++;
    if (ch === "\n") break;
  }
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0] || ",";
}

function parseCsv(text: string): Record<string, string>[] {
  // Strip UTF-8 BOM (Excel adds this on "Save as CSV")
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  const delim = detectDelimiter(text.slice(0, 4096));
  const lines: string[][] = [];
  let cur: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else { inQuotes = false; }
      } else field += ch;
    } else {
      if (ch === '"') inQuotes = true;
      else if (ch === delim) { cur.push(field); field = ""; }
      else if (ch === "\r") { /* skip */ }
      else if (ch === "\n") { cur.push(field); lines.push(cur); cur = []; field = ""; }
      else field += ch;
    }
  }
  if (field.length || cur.length) { cur.push(field); lines.push(cur); }
  const rows = lines.filter((r) => r.some((c) => c.trim() !== ""));
  if (!rows.length) return [];
  const header = rows[0].map((h) => h.replace(/^\uFEFF/, "").trim());
  return rows.slice(1).map((r) => {
    const obj: Record<string, string> = {};
    header.forEach((h, i) => { obj[h] = (r[i] ?? "").trim(); });
    return obj;
  });
}

const SAMPLE_CSV = "Full Name,Email,Phone,DOB,Address,Postcode,City,Gender,Notes,Group\nJane Doe,jane@example.com,07700 900123,15/04/1988,10 High Street,SW1A 1AA,London,female,Sample patient,VIP\n";
function downloadSampleCsv() {
  const blob = new Blob([SAMPLE_CSV], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = "modo-patients-template.csv"; a.click();
  URL.revokeObjectURL(url);
}


function ImportCsvDialog({ open, onOpenChange, onImport }: {
  open: boolean; onOpenChange: (v: boolean) => void; onImport: (rows: Record<string, string>[]) => Promise<void>;
}) {
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [busy, setBusy] = useState(false);
  const [filename, setFilename] = useState("");

  function handleFile(f: File | null) {
    if (!f) return;
    setFilename(f.name);
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = parseCsv(String(reader.result || ""));
        setRows(parsed);
        if (!parsed.length) toast.error("No rows found in CSV");
      } catch {
        toast.error("Could not parse CSV");
      }
    };
    reader.readAsText(f);
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { setRows([]); setFilename(""); } onOpenChange(v); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader><DialogTitle>Import patients from CSV</DialogTitle></DialogHeader>
        <div className="space-y-3 text-sm">
          <p className="text-xs text-muted-foreground">
            Include a header row. Recognised columns: <strong>Full Name, Email, Phone, DOB, Address, Postcode, City, Gender, Notes, Group</strong>.
            Existing patients with the same email will be updated. Commas, semicolons and tabs are all supported as separators.
          </p>
          <button type="button" onClick={downloadSampleCsv} className="text-xs underline text-primary">
            Download a sample template
          </button>
          <Input type="file" accept=".csv,text/csv,text/plain" onChange={(e) => handleFile(e.target.files?.[0] ?? null)} />
          {filename && <div className="text-xs text-muted-foreground">{filename} — {rows.length} row(s) detected</div>}

          {rows.length > 0 && (
            <div className="max-h-40 overflow-auto rounded border text-xs">
              <table className="w-full">
                <thead className="bg-muted/50"><tr>{Object.keys(rows[0]).slice(0, 5).map((h) => <th key={h} className="px-2 py-1 text-left">{h}</th>)}</tr></thead>
                <tbody>
                  {rows.slice(0, 5).map((r, i) => (
                    <tr key={i} className="border-t">{Object.keys(rows[0]).slice(0, 5).map((h) => <td key={h} className="px-2 py-1">{r[h]}</td>)}</tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button disabled={!rows.length || busy} onClick={async () => {
            setBusy(true);
            try { await onImport(rows); setRows([]); setFilename(""); }
            catch (e) { toast.error(e instanceof Error ? e.message : "Import failed"); }
            finally { setBusy(false); }
          }}>{busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Import {rows.length || ""}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ---------- Create Group ---------- */
function CreateGroupDialog({ open, onOpenChange, clients, onSave }: {
  open: boolean; onOpenChange: (v: boolean) => void; clients: Client[];
  onSave: (name: string, ids: string[]) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return s ? clients.filter((c) => c.full_name.toLowerCase().includes(s) || (c.email ?? "").toLowerCase().includes(s)) : clients;
  }, [clients, q]);

  function toggle(id: string) {
    setSelected((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { setName(""); setSelected(new Set()); setQ(""); } onOpenChange(v); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader><DialogTitle>Create group</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <Field label="Group name" required>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. VIP, Botox regulars" />
          </Field>
          <Input placeholder="Search patients…" value={q} onChange={(e) => setQ(e.target.value)} />
          <div className="max-h-64 overflow-auto rounded border divide-y">
            {filtered.map((c) => (
              <label key={c.id} className="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm hover:bg-muted/40">
                <input type="checkbox" checked={selected.has(c.id)} onChange={() => toggle(c.id)} />
                <span className="flex-1 truncate">{c.full_name}</span>
                <span className="truncate text-xs text-muted-foreground">{c.email}</span>
              </label>
            ))}
            {!filtered.length && <div className="p-4 text-center text-xs text-muted-foreground">No patients match</div>}
          </div>
          <div className="text-xs text-muted-foreground">{selected.size} selected</div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button disabled={!name.trim() || !selected.size || busy} onClick={async () => {
            setBusy(true);
            try { await onSave(name.trim(), Array.from(selected)); setName(""); setSelected(new Set()); }
            catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
            finally { setBusy(false); }
          }}>{busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Save group</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ---------- Merge Duplicates ---------- */
type DupeGroup = { key: string; clients: { id: string; full_name: string; email: string | null; phone: string | null; created_at: string }[] };
function MergeDuplicatesDialog({ open, onOpenChange, loadGroups, onMerge }: {
  open: boolean; onOpenChange: (v: boolean) => void;
  loadGroups: () => Promise<DupeGroup[]>;
  onMerge: (keep_id: string, merge_ids: string[]) => Promise<void>;
}) {
  const [groups, setGroups] = useState<DupeGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [keepMap, setKeepMap] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    loadGroups().then((g) => {
      setGroups(g);
      const km: Record<string, string> = {};
      g.forEach((grp) => { km[grp.key] = grp.clients[0].id; });
      setKeepMap(km);
    }).finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Merge duplicate patients</DialogTitle></DialogHeader>
        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
        ) : groups.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">No duplicates found.</div>
        ) : (
          <div className="space-y-4">
            <p className="text-xs text-muted-foreground">Patients matched by shared email, phone, or name. Choose which record to keep — the others merge into it.</p>
            {groups.map((g) => {
              const keepId = keepMap[g.key];
              return (
                <div key={g.key} className="rounded-lg border p-3 space-y-2">
                  {g.clients.map((c) => (
                    <label key={c.id} className="flex cursor-pointer items-start gap-2 rounded p-2 hover:bg-muted/40">
                      <input type="radio" name={`keep-${g.key}`} checked={keepId === c.id}
                             onChange={() => setKeepMap({ ...keepMap, [g.key]: c.id })} className="mt-1" />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold truncate">{c.full_name} {keepId === c.id && <Badge variant="outline" className="ml-1 text-[10px]">Keep</Badge>}</div>
                        <div className="text-xs text-muted-foreground truncate">{c.email || "—"} · {c.phone || "—"}</div>
                      </div>
                    </label>
                  ))}
                  <Button size="sm" className="w-full" disabled={busy === g.key} onClick={async () => {
                    setBusy(g.key);
                    try {
                      await onMerge(keepId, g.clients.map((c) => c.id).filter((id) => id !== keepId));
                      setGroups((prev) => prev.filter((x) => x.key !== g.key));
                    } catch (e) { toast.error(e instanceof Error ? e.message : "Merge failed"); }
                    finally { setBusy(null); }
                  }}>{busy === g.key ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Combine className="mr-2 h-4 w-4" />}Merge {g.clients.length} records</Button>
                </div>
              );
            })}
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
