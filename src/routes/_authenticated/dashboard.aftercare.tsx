import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  listAftercareTemplates,
  saveAftercareTemplate,
  deleteAftercareTemplate,
  listMyTreatmentsBasic,
  getAftercareTemplateTreatmentIds,
  setAftercareTemplateTreatmentIds,
} from "@/lib/aftercare-templates.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ArrowLeft, Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/dashboard/aftercare")({
  component: AftercarePage,
  errorComponent: ({ error }) => <div className="p-6 text-sm text-destructive">{error.message}</div>,
  notFoundComponent: () => <div className="p-6 text-sm">Not found.</div>,
});

type Tpl = { id: string; name: string; body_html: string; delay_hours: number };

function AftercarePage() {
  const list = useServerFn(listAftercareTemplates);
  const save = useServerFn(saveAftercareTemplate);
  const remove = useServerFn(deleteAftercareTemplate);
  const listTreatments = useServerFn(listMyTreatmentsBasic);
  const getTplTreatments = useServerFn(getAftercareTemplateTreatmentIds);
  const setTplTreatments = useServerFn(setAftercareTemplateTreatmentIds);
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["aftercare-templates"], queryFn: () => list() });
  const tQ = useQuery({ queryKey: ["my-treatments-basic"], queryFn: () => listTreatments() });
  const [editing, setEditing] = useState<Tpl | null>(null);
  const [open, setOpen] = useState(false);
  const [treatmentIds, setTreatmentIds] = useState<string[]>([]);

  const openEditor = async (tpl: Tpl) => {
    setEditing(tpl);
    setOpen(true);
    if (tpl.id) {
      const ids = await getTplTreatments({ data: { template_id: tpl.id } });
      setTreatmentIds(ids as string[]);
    } else {
      setTreatmentIds([]);
    }
  };

  return (
    <div className="mx-auto max-w-3xl p-4 sm:p-6 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <Link to="/dashboard" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:underline">
          <ArrowLeft className="h-4 w-4" /> Dashboard
        </Link>
        <Button
          onClick={() => {
            setEditing({ id: "", name: "", body_html: "", delay_hours: 2 });
            setOpen(true);
          }}
        >
          <Plus className="mr-1 h-4 w-4" /> New template
        </Button>
      </div>

      <header>
        <h1 className="text-2xl font-semibold">Aftercare templates</h1>
        <p className="text-sm text-muted-foreground">
          Write once, attach to any treatment in <span className="font-medium">Services</span>. Sent automatically after the appointment ends — defaults to 2 hours after.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Your templates</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {q.isLoading && <div className="text-sm text-muted-foreground">Loading…</div>}
          {q.data && q.data.length === 0 && (
            <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
              No templates yet. Click <span className="font-medium">New template</span> to create your first one.
            </div>
          )}
          {(q.data as Tpl[] | undefined)?.map((t) => (
            <div key={t.id} className="flex items-center justify-between gap-3 rounded-lg border p-3">
              <div className="min-w-0">
                <div className="truncate font-medium">{t.name}</div>
                <div className="text-xs text-muted-foreground">Sends {t.delay_hours}h after appointment</div>
              </div>
              <div className="flex gap-1 shrink-0">
                <Button size="sm" variant="ghost" onClick={() => { setEditing(t); setOpen(true); }}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={async () => {
                    if (!confirm(`Delete "${t.name}"?`)) return;
                    await remove({ data: { id: t.id } });
                    await qc.invalidateQueries({ queryKey: ["aftercare-templates"] });
                    toast.success("Deleted");
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Edit template" : "New aftercare template"}</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>Name</Label>
                <Input
                  value={editing.name}
                  onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                  placeholder="e.g. Lip filler aftercare"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Message</Label>
                <Textarea
                  rows={10}
                  value={editing.body_html}
                  onChange={(e) => setEditing({ ...editing, body_html: e.target.value })}
                  placeholder="Write the aftercare instructions sent to the patient."
                />
              </div>
              <div className="space-y-1.5 max-w-[200px]">
                <Label>Send after (hours)</Label>
                <Input
                  type="number"
                  min={0}
                  value={editing.delay_hours}
                  onChange={(e) =>
                    setEditing({ ...editing, delay_hours: Math.max(0, Number(e.target.value) || 0) })
                  }
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button
              disabled={!editing?.name.trim()}
              onClick={async () => {
                if (!editing) return;
                await save({
                  data: {
                    id: editing.id || undefined,
                    name: editing.name.trim(),
                    body_html: editing.body_html,
                    delay_hours: editing.delay_hours,
                  },
                });
                await qc.invalidateQueries({ queryKey: ["aftercare-templates"] });
                setOpen(false);
                toast.success("Saved");
              }}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
