import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  listPretreatmentTemplates,
  savePretreatmentTemplate,
  deletePretreatmentTemplate,
  type PretreatmentTpl,
} from "@/lib/pretreatment-templates.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ArrowLeft, Plus, Pencil, Trash2, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/dashboard/pre-treatment")({
  component: PreTreatmentPage,
  errorComponent: ({ error }) => <div className="p-6 text-sm text-destructive">{error.message}</div>,
  notFoundComponent: () => <div className="p-6 text-sm">Not found.</div>,
});

type Editing = Partial<PretreatmentTpl> & { id?: string };

const EXAMPLES = [
  {
    name: "Before your appointment",
    summary: "Things to do and avoid in the 24–48 hours before",
    body_html:
      "<p><strong>Please read before your visit:</strong></p><ul><li>Avoid alcohol for 24 hours prior.</li><li>Do not take blood-thinning medication (e.g. aspirin, ibuprofen) unless prescribed.</li><li>Arrive with a clean face — no makeup if having injectables or facials.</li><li>Eat a light meal before treatment to reduce light-headedness.</li></ul>",
  },
  {
    name: "Clinic rules & arrival",
    summary: "Parking, lateness, plus-ones",
    body_html:
      "<p><strong>Arriving at the clinic:</strong></p><ul><li>Please arrive 5 minutes early to complete any forms.</li><li>Lateness over 15 minutes may require rebooking and forfeit your deposit.</li><li>Children and additional guests are not permitted in the treatment room.</li></ul>",
  },
];

function PreTreatmentPage() {
  const list = useServerFn(listPretreatmentTemplates);
  const save = useServerFn(savePretreatmentTemplate);
  const remove = useServerFn(deletePretreatmentTemplate);
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["pretreatment-templates"], queryFn: () => list() });
  const [editing, setEditing] = useState<Editing | null>(null);
  const [open, setOpen] = useState(false);

  const items = (q.data as PretreatmentTpl[] | undefined) ?? [];

  return (
    <div className="mx-auto max-w-3xl p-4 sm:p-6 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <Link to="/dashboard" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:underline">
          <ArrowLeft className="h-4 w-4" /> Dashboard
        </Link>
        <Button
          onClick={() => {
            setEditing({ name: "", summary: "", body_html: "", show_on_public: true, active: true });
            setOpen(true);
          }}
        >
          <Plus className="mr-1 h-4 w-4" /> New section
        </Button>
      </div>

      <header>
        <h1 className="text-2xl font-semibold">Pre-treatment information</h1>
        <p className="text-sm text-muted-foreground">
          Info patients see <span className="font-medium">before</span> they book — clinic rules, what to bring, what to avoid in the 24–48 hours before. Shown on the booking page under the “Pre-treatment” button.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Your sections</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {q.isLoading && <div className="text-sm text-muted-foreground">Loading…</div>}
          {!q.isLoading && items.length === 0 && (
            <div className="space-y-3 rounded-md border border-dashed p-4 text-sm">
              <p className="text-muted-foreground">No sections yet. Start from an example or create your own.</p>
              <div className="flex flex-wrap gap-2">
                {EXAMPLES.map((ex) => (
                  <Button
                    key={ex.name}
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setEditing({ ...ex, show_on_public: true, active: true });
                      setOpen(true);
                    }}
                  >
                    Use “{ex.name}”
                  </Button>
                ))}
              </div>
            </div>
          )}
          {items.map((t) => (
            <div key={t.id} className="flex items-center justify-between gap-3 rounded-lg border p-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <div className="truncate font-medium">{t.name}</div>
                  {t.show_on_public ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
                      <Eye className="h-3 w-3" /> Visible
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                      <EyeOff className="h-3 w-3" /> Hidden
                    </span>
                  )}
                </div>
                {t.summary && <div className="truncate text-xs text-muted-foreground">{t.summary}</div>}
              </div>
              <div className="flex gap-1 shrink-0">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setEditing(t);
                    setOpen(true);
                  }}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={async () => {
                    if (!confirm(`Delete "${t.name}"?`)) return;
                    await remove({ data: { id: t.id } });
                    await qc.invalidateQueries({ queryKey: ["pretreatment-templates"] });
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
            <DialogTitle>{editing?.id ? "Edit section" : "New pre-treatment section"}</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>Title</Label>
                <Input
                  value={editing.name ?? ""}
                  onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                  placeholder="e.g. Before your appointment"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Short summary <span className="text-xs text-muted-foreground">(optional)</span></Label>
                <Input
                  value={editing.summary ?? ""}
                  onChange={(e) => setEditing({ ...editing, summary: e.target.value })}
                  placeholder="e.g. Things to do and avoid 24h before"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Details</Label>
                <Textarea
                  rows={10}
                  value={editing.body_html ?? ""}
                  onChange={(e) => setEditing({ ...editing, body_html: e.target.value })}
                  placeholder="Write rules and guidance for patients before their appointment. Basic HTML allowed (e.g. <ul><li>...</li></ul>, <strong>)."
                />
              </div>

              <label className="flex items-start gap-3 rounded-lg border p-3 cursor-pointer">
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4"
                  checked={!!editing.show_on_public}
                  onChange={(e) => setEditing({ ...editing, show_on_public: e.target.checked })}
                />
                <span className="text-sm">
                  <span className="font-semibold">Show on booking page</span>
                  <span className="block text-xs text-muted-foreground">Patients can read this from the “Pre-treatment” button on your booking page before they book.</span>
                </span>
              </label>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button
              disabled={!editing?.name?.trim()}
              onClick={async () => {
                if (!editing) return;
                await save({
                  data: {
                    id: editing.id,
                    name: (editing.name ?? "").trim(),
                    summary: editing.summary ?? "",
                    body_html: editing.body_html ?? "",
                    show_on_public: editing.show_on_public ?? true,
                    active: editing.active ?? true,
                  },
                });
                await qc.invalidateQueries({ queryKey: ["pretreatment-templates"] });
                setOpen(false);
                toast.success("Saved — remember to save your booking page if needed");
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
