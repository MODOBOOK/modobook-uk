import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { listConsultations, createConsultation, deleteConsultation } from "@/lib/consultations.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus, Trash2, ClipboardList, ChevronRight } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/dashboard/consultations/")({
  ssr: false,
  component: ConsultationsPage,
});

type Row = Awaited<ReturnType<typeof listConsultations>>[number];

function ConsultationsPage() {
  const list = useServerFn(listConsultations);
  const create = useServerFn(createConsultation);
  const del = useServerFn(deleteConsultation);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [creating, setCreating] = useState(false);

  async function reload() {
    setLoading(true);
    const data = await list();
    setRows(data as Row[]);
    setLoading(false);
  }
  useEffect(() => { reload(); }, []); // eslint-disable-line

  async function onCreate() {
    if (!name.trim()) return;
    setCreating(true);
    try {
      const res: any = await create({ data: { patient_name: name, patient_email: email || undefined, patient_phone: phone || undefined } });
      setOpen(false); setName(""); setEmail(""); setPhone("");
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
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="mr-1.5 h-4 w-4" />New</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New consultation</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <Input placeholder="Patient full name" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
              <Input placeholder="Email (optional)" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              <Input placeholder="Phone (optional)" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <DialogFooter>
              <Button onClick={onCreate} disabled={creating || !name.trim()}>
                {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Start consultation
              </Button>
            </DialogFooter>
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
