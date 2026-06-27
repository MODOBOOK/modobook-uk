import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  listMedicalTemplates,
  cloneMedicalTemplate,
  saveMedicalTemplate,
  deleteMedicalTemplate,
} from "@/lib/templates.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Copy, Pencil, Trash2, FileText } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/dashboard/medical-forms")({
  component: MedicalFormsPage,
});

type Tpl = Awaited<ReturnType<typeof listMedicalTemplates>>[number];

function MedicalFormsPage() {
  const fetchAll = useServerFn(listMedicalTemplates);
  const clone = useServerFn(cloneMedicalTemplate);
  const save = useServerFn(saveMedicalTemplate);
  const remove = useServerFn(deleteMedicalTemplate);

  const [rows, setRows] = useState<Tpl[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Tpl | null>(null);
  const [schemaText, setSchemaText] = useState("");

  async function refresh() {
    setLoading(true);
    try {
      setRows(await fetchAll());
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function startEdit(t: Tpl) {
    setEditing(t);
    setSchemaText(JSON.stringify(t.schema, null, 2));
  }

  async function handleSave() {
    if (!editing) return;
    let parsed: unknown;
    try {
      parsed = JSON.parse(schemaText);
    } catch {
      toast.error("Schema is not valid JSON");
      return;
    }
    try {
      await save({
        data: {
          id: editing.id,
          name: editing.name,
          description: editing.description,
          schema: parsed,
        },
      });
      toast.success("Saved");
      setEditing(null);
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  }

  const system = rows.filter((r) => r.is_system);
  const mine = rows.filter((r) => !r.is_system);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Medical forms</h1>
        <p className="text-sm text-muted-foreground">
          Prebuilt intake questionnaires you can clone and customise for each consultation.
        </p>
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground">System templates</h2>
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {system.map((t) => (
              <Card key={t.id}>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <FileText className="h-4 w-4" /> {t.name}
                  </CardTitle>
                  {t.description && (
                    <p className="text-xs text-muted-foreground">{t.description}</p>
                  )}
                </CardHeader>
                <CardContent className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={async () => {
                      await clone({ data: { template_id: t.id } });
                      toast.success("Cloned to your templates");
                      refresh();
                    }}
                  >
                    <Copy className="mr-2 h-3 w-3" /> Clone & edit
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground">Your templates</h2>
        {mine.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No custom templates yet — clone a system template to start.
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {mine.map((t) => (
              <Card key={t.id}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">{t.name}</CardTitle>
                  {t.description && (
                    <p className="text-xs text-muted-foreground">{t.description}</p>
                  )}
                </CardHeader>
                <CardContent className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => startEdit(t)}>
                    <Pencil className="mr-2 h-3 w-3" /> Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={async () => {
                      if (!confirm("Delete this template?")) return;
                      await remove({ data: { id: t.id } });
                      refresh();
                    }}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit medical template</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>Name</Label>
                <Input
                  value={editing.name}
                  onChange={(e) =>
                    setEditing((s) => (s ? { ...s, name: e.target.value } : s))
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label>Description</Label>
                <Input
                  value={editing.description ?? ""}
                  onChange={(e) =>
                    setEditing((s) => (s ? { ...s, description: e.target.value } : s))
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label>Schema (JSON)</Label>
                <Textarea
                  rows={16}
                  className="font-mono text-xs"
                  value={schemaText}
                  onChange={(e) => setSchemaText(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Structure: array of {`{ group, questions: [{ id, label, type, options?, required? }] }`}.
                  Types: <code>text</code>, <code>yesno</code>, <code>checkboxes</code>,{" "}
                  <code>select</code>, <code>number</code>, <code>date</code>.
                </p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button onClick={handleSave}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
