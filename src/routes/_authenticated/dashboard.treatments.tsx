import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getMyTreatments, createTreatment, updateTreatment, deleteTreatment } from "@/lib/treatments.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Trash2, Pencil } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard/treatments")({
  ssr: false,
  component: TreatmentsPage,
});

type Treatment = {
  id: string;
  name: string;
  duration: number;
  price: number;
  description: string | null;
  active: boolean;
};

function TreatmentsPage() {
  const list = useServerFn(getMyTreatments);
  const create = useServerFn(createTreatment);
  const update = useServerFn(updateTreatment);
  const remove = useServerFn(deleteTreatment);
  const [items, setItems] = useState<Treatment[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Treatment | null>(null);

  async function load() {
    setLoading(true);
    try {
      const data = await list({});
      setItems(data as Treatment[]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load treatments");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
  }, []);

  async function handleSave(form: { name: string; duration: number; price: number; description: string }) {
    try {
      if (editing) {
        await update({ data: { id: editing.id, ...form } });
        toast.success("Treatment updated");
      } else {
        await create({ data: form });
        toast.success("Treatment created");
      }
      setOpen(false);
      setEditing(null);
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save");
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this treatment?")) return;
    try {
      await remove({ data: { id } });
      toast.success("Deleted");
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to delete");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Treatments</h1>
          <p className="text-muted-foreground">Define what patients can book.</p>
        </div>
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setEditing(null); }}>
          <DialogTrigger asChild>
            <Button onClick={() => setEditing(null)}>
              <Plus className="mr-2 h-4 w-4" /> New treatment
            </Button>
          </DialogTrigger>
          <TreatmentDialog treatment={editing} onSave={handleSave} />
        </Dialog>
      </div>

      {loading ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : items.length === 0 ? (
        <Card><CardContent className="p-8 text-center text-muted-foreground">No treatments yet. Add your first one.</CardContent></Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {items.map((t) => (
            <Card key={t.id}>
              <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0">
                <div>
                  <CardTitle className="text-base">{t.name}</CardTitle>
                  <p className="text-sm text-muted-foreground">£{t.price} · {t.duration} min</p>
                </div>
                <div className="flex gap-1">
                  <Button size="icon" variant="ghost" onClick={() => { setEditing(t); setOpen(true); }}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => handleDelete(t.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              {t.description && (
                <CardContent className="text-sm text-muted-foreground">{t.description}</CardContent>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function TreatmentDialog({ treatment, onSave }: { treatment: Treatment | null; onSave: (f: { name: string; duration: number; price: number; description: string }) => void }) {
  const [name, setName] = useState(treatment?.name ?? "");
  const [duration, setDuration] = useState(treatment?.duration ?? 30);
  const [price, setPrice] = useState(treatment?.price ?? 0);
  const [description, setDescription] = useState(treatment?.description ?? "");

  useEffect(() => {
    setName(treatment?.name ?? "");
    setDuration(treatment?.duration ?? 30);
    setPrice(treatment?.price ?? 0);
    setDescription(treatment?.description ?? "");
  }, [treatment]);

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>{treatment ? "Edit treatment" : "New treatment"}</DialogTitle>
      </DialogHeader>
      <div className="space-y-4">
        <div>
          <Label>Name</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Lip filler 1ml" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Duration (min)</Label>
            <Input type="number" value={duration} onChange={(e) => setDuration(Number(e.target.value))} />
          </div>
          <div>
            <Label>Price (£)</Label>
            <Input type="number" value={price} onChange={(e) => setPrice(Number(e.target.value))} />
          </div>
        </div>
        <div>
          <Label>Description</Label>
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
        </div>
      </div>
      <DialogFooter>
        <Button onClick={() => onSave({ name, duration, price, description })} disabled={!name}>Save</Button>
      </DialogFooter>
    </DialogContent>
  );
}
