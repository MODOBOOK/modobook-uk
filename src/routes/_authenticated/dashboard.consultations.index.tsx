import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { listConsultations, createConsultation, deleteConsultation } from "@/lib/consultations.functions";
import { listClients, upsertClient } from "@/lib/clients.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus, Trash2, ClipboardList, ChevronRight, Search, UserPlus, AlertTriangle } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/dashboard/consultations/")({
  ssr: false,
  component: ConsultationsPage,
});

type Row = Awaited<ReturnType<typeof listConsultations>>[number];
type Client = Awaited<ReturnType<typeof listClients>>[number];

function ConsultationsPage() {
  const list = useServerFn(listConsultations);
  const create = useServerFn(createConsultation);
  const del = useServerFn(deleteConsultation);
  const clientsFn = useServerFn(listClients);
  const upsert = useServerFn(upsertClient);

  const [rows, setRows] = useState<Row[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"pick" | "new">("pick");
  const [query, setQuery] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [dob, setDob] = useState("");
  const [creating, setCreating] = useState(false);

  async function reload() {
    setLoading(true);
    try {
      const [c, cl] = await Promise.all([list(), clientsFn()]);
      setRows(c as Row[]);
      setClients(cl as Client[]);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { reload(); }, []); // eslint-disable-line

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return clients;
    return clients.filter((c) =>
      c.full_name.toLowerCase().includes(q) ||
      (c.email ?? "").toLowerCase().includes(q) ||
      (c.phone ?? "").toLowerCase().includes(q)
    );
  }, [clients, query]);

  async function startForClient(c: Client) {
    setCreating(true);
    try {
      const res: any = await create({ data: { patient_name: c.full_name, patient_email: c.email || undefined, patient_phone: c.phone || undefined } });
      window.location.href = `/dashboard/consultations/${res.id}`;
    } catch (e: any) { toast.error(e?.message ?? "Failed"); setCreating(false); }
  }

  async function onCreateNew() {
    if (!name.trim()) return;
    setCreating(true);
    try {
      try { await upsert({ data: { full_name: name, email: email || null, dob: dob || null } }); } catch { /* non-fatal */ }
      const res: any = await create({ data: { patient_name: name, patient_email: email || undefined } });
      setOpen(false); setName(""); setEmail(""); setDob(""); setMode("pick");
      window.location.href = `/dashboard/consultations/${res.id}`;
    } catch (e: any) {
      toast.error(e?.message ?? "Failed");
    } finally { setCreating(false); }
  }

  async function onDelete(id: string) {
    if (!confirm("Delete this consultation?")) return;
    await del({ data: { id } });
    reload();
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Consultations</h1>
          <p className="text-sm text-muted-foreground">MODO — step-by-step patient consultation records.</p>
        </div>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setMode("pick"); }}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="mr-1.5 h-4 w-4" />New</Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>New consultation</DialogTitle></DialogHeader>

            {mode === "pick" ? (
              <div className="space-y-3">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input className="pl-9" placeholder="Search patients…" value={query} onChange={(e) => setQuery(e.target.value)} autoFocus />
                </div>
                <Button variant="outline" className="w-full justify-start" onClick={() => setMode("new")}>
                  <UserPlus className="mr-2 h-4 w-4" />Add new patient
                </Button>
                <div className="max-h-80 space-y-0 overflow-y-auto rounded-md border">
                  {filtered.length === 0 ? (
                    <div className="p-4 text-center text-sm text-muted-foreground">No patients yet — add one above.</div>
                  ) : filtered.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => startForClient(c)}
                      disabled={creating}
                      className="flex w-full items-center justify-between gap-2 border-b px-3 py-2 text-left text-sm hover:bg-muted/50 last:border-0 disabled:opacity-60"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="truncate font-medium">{c.full_name}</span>
                          {c.has_allergies && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-bold text-red-700">
                              <AlertTriangle className="h-2.5 w-2.5" />Allergy
                            </span>
                          )}
                        </div>
                        <div className="truncate text-xs text-muted-foreground">{c.email || c.phone || "—"}</div>
                        {c.has_allergies && c.allergies && (
                          <div className="truncate text-xs text-red-600">{c.allergies}</div>
                        )}
                      </div>
                      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <Input placeholder="Full name *" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
                <Input placeholder="Date of birth" type="date" value={dob} onChange={(e) => setDob(e.target.value)} />
                <Input placeholder="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
                <DialogFooter className="gap-2">
                  <Button variant="ghost" onClick={() => setMode("pick")}>Back</Button>
                  <Button onClick={onCreateNew} disabled={creating || !name.trim()}>
                    {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Add & start
                  </Button>
                </DialogFooter>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : rows.length === 0 ? (
        <Card><CardContent className="py-12 text-center">
          <ClipboardList className="mx-auto h-10 w-10 text-muted-foreground/40" />
          <p className="mt-3 text-sm text-muted-foreground">No consultations yet.</p>
        </CardContent></Card>
      ) : (
        <div className="space-y-2">
          {rows.map((r) => (
            <Card key={r.id} className="overflow-hidden">
              <div className="flex items-center gap-2 p-3">
                <Link
                  to="/dashboard/consultations/$id"
                  params={{ id: r.id }}
                  className="flex min-w-0 flex-1 items-center gap-3"
                >
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                    <ClipboardList className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-medium">{r.patient_name}</span>
                      <Badge variant={r.status === "completed" ? "default" : "secondary"} className="shrink-0 text-[10px]">
                        {r.status === "completed" ? "Done" : `Step ${r.current_step}/8`}
                      </Badge>
                    </div>
                    <div className="truncate text-xs text-muted-foreground">
                      {r.patient_email || r.patient_phone || "—"} · updated {new Date(r.updated_at).toLocaleDateString()}
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                </Link>
                <Button size="icon" variant="ghost" onClick={() => onDelete(r.id)} aria-label="Delete">
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
