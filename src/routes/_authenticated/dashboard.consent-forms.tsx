import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  listConsentTemplates,
  cloneConsentTemplate,
  saveConsentTemplate,
  deleteConsentTemplate,
} from "@/lib/templates.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Copy, FileSignature, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/dashboard/consent-forms")({
  component: ConsentFormsPage,
});

type Tpl = Awaited<ReturnType<typeof listConsentTemplates>>[number];

function ConsentFormsPage() {
  const fetchAll = useServerFn(listConsentTemplates);
  const clone = useServerFn(cloneConsentTemplate);
  const save = useServerFn(saveConsentTemplate);
  const remove = useServerFn(deleteConsentTemplate);

  const [rows, setRows] = useState<Tpl[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<(Partial<Tpl> & Pick<Tpl, "name" | "body_markdown">) | null>(null);

  function newBlank() {
    setEditing({
      id: undefined,
      name: "New consent form",
      treatment_type: "",
      body_markdown: "# Consent\n\nDescribe the treatment, risks, aftercare, and any contraindications here.\n\nBy signing below, the patient confirms they have read and understood this consent.",
      requires_signature: true,
    } as Partial<Tpl> & Pick<Tpl, "name" | "body_markdown">);
  }

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

  async function handleSave() {
    if (!editing) return;
    try {
      await save({
        data: {
          id: editing.id,
          name: editing.name,
          treatment_type: editing.treatment_type,
          body_markdown: editing.body_markdown,
          requires_signature: editing.requires_signature,
        },
      });
      toast.success("Saved");
      setEditing(null);
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  }

  const system = rows.filter((r) => r.is_system);
  const mine = rows.filter((r) => !r.is_system);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Consent forms</h1>
          <p className="text-sm text-muted-foreground">
            Ready-to-use consent templates for Botox, fillers and skin treatments. Clone any
            template to edit the wording, or start a blank one of your own.
          </p>
        </div>
        <Button onClick={newBlank} size="sm">
          <FileSignature className="mr-2 h-4 w-4" /> New blank consent
        </Button>
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
                    <FileSignature className="h-4 w-4" /> {t.name}
                  </CardTitle>
                  {t.treatment_type && (
                    <span className="inline-block rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                      {t.treatment_type}
                    </span>
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
                  <Button size="sm" variant="ghost" onClick={() => setEditing(t)}>
                    Preview
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
            No custom consent forms yet — clone a system template to start.
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {mine.map((t) => (
              <Card key={t.id}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">{t.name}</CardTitle>
                  {t.treatment_type && (
                    <span className="inline-block rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                      {t.treatment_type}
                    </span>
                  )}
                </CardHeader>
                <CardContent className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => setEditing(t)}>
                    <Pencil className="mr-2 h-3 w-3" /> Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={async () => {
                      if (!confirm("Delete this consent template?")) return;
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
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              {editing?.is_system ? "Preview consent" : "Edit consent template"}
            </DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>Name</Label>
                <Input
                  value={editing.name}
                  disabled={editing.is_system}
                  onChange={(e) =>
                    setEditing((s) => (s ? { ...s, name: e.target.value } : s))
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label>Treatment type</Label>
                <Input
                  value={editing.treatment_type ?? ""}
                  disabled={editing.is_system}
                  onChange={(e) =>
                    setEditing((s) => (s ? { ...s, treatment_type: e.target.value } : s))
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label>Body (Markdown)</Label>
                <Textarea
                  rows={18}
                  className="font-mono text-xs"
                  value={editing.body_markdown}
                  disabled={editing.is_system}
                  onChange={(e) =>
                    setEditing((s) => (s ? { ...s, body_markdown: e.target.value } : s))
                  }
                />
              </div>
              <div className="flex items-center justify-between rounded-md border p-3">
                <div>
                  <p className="text-sm font-medium">Requires signature</p>
                  <p className="text-xs text-muted-foreground">
                    Patient must sign before treatment proceeds.
                  </p>
                </div>
                <Switch
                  checked={editing.requires_signature}
                  disabled={editing.is_system}
                  onCheckedChange={(v) =>
                    setEditing((s) => (s ? { ...s, requires_signature: v } : s))
                  }
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditing(null)}>
              Close
            </Button>
            {editing && !editing.is_system && <Button onClick={handleSave}>Save</Button>}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
