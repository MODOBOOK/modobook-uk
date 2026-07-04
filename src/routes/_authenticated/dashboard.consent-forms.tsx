import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  listConsentTemplates,
  cloneConsentTemplate,
  saveConsentTemplate,
  deleteConsentTemplate,
} from "@/lib/templates.functions";
import { amIAdmin } from "@/lib/admin.functions";

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
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Copy,
  FileSignature,
  Pencil,
  Trash2,
  Search,
  Eye,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { ConsentSectionsEditor, ConsentSectionsView, type ConsentSection } from "@/components/ConsentSections";
import { AiGenerateConsentDialog } from "@/components/medical-forms/AiGenerateConsentDialog";

export const Route = createFileRoute("/_authenticated/dashboard/consent-forms")({
  component: ConsentFormsPage,
});

type Tpl = Awaited<ReturnType<typeof listConsentTemplates>>[number] & {
  sections?: ConsentSection[] | null;
  summary?: string | null;
};

function ConsentFormsPage() {
  const fetchAll = useServerFn(listConsentTemplates);
  const clone = useServerFn(cloneConsentTemplate);
  const save = useServerFn(saveConsentTemplate);
  const remove = useServerFn(deleteConsentTemplate);
  const checkAdmin = useServerFn(amIAdmin);

  const [rows, setRows] = useState<Tpl[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Tpl | null>(null);
  const [query, setQuery] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [aiSystem, setAiSystem] = useState(false);


  function newBlank() {
    setEditing({
      id: undefined as any,
      name: "New consent form",
      treatment_type: "",
      body_markdown: "",
      requires_signature: true,
      is_system: false,
      sections: [
        { title: "About the treatment", body: "" },
        { title: "Expected results", bullets: [] },
        { title: "Risks & possible complications", bullets: [] },
        { title: "Contraindications", bullets: [] },
        { title: "Aftercare", bullets: [] },
      ],
      summary: "",
    } as Tpl);
  }

  async function refresh() {
    setLoading(true);
    try {
      setRows((await fetchAll()) as Tpl[]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    checkAdmin().then((r) => setIsAdmin(r.admin)).catch(() => {});
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
          body_markdown: editing.body_markdown ?? "",
          requires_signature: editing.requires_signature,
          sections: editing.sections ?? null,
          summary: editing.summary ?? null,
          is_system: isAdmin ? !!editing.is_system : false,
        },
      });
      toast.success("Saved");
      setEditing(null);
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  }


  const q = query.trim().toLowerCase();
  const filter = (list: Tpl[]) =>
    q
      ? list.filter(
          (r) =>
            r.name.toLowerCase().includes(q) ||
            (r.treatment_type ?? "").toLowerCase().includes(q) ||
            (r.summary ?? "").toLowerCase().includes(q),
        )
      : list;
  const system = filter(rows.filter((r) => r.is_system));
  const mine = filter(rows.filter((r) => !r.is_system));

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Consent forms</h1>
          <p className="text-sm text-muted-foreground">
            Modern, sectioned consent templates for aesthetic treatments. Clone any system template to edit, or build your own from scratch.
          </p>
          {isAdmin && (
            <p className="mt-1 text-xs font-medium text-primary">
              Admin mode — you can add, edit and remove system templates for all practitioners.
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            onClick={() => { setAiSystem(false); setAiOpen(true); }}
          >
            <Sparkles className="mr-2 h-4 w-4" /> Generate with AI
          </Button>
          <Button onClick={newBlank} size="sm" variant="outline">
            <FileSignature className="mr-2 h-4 w-4" /> New blank consent
          </Button>
          {isAdmin && (
            <Button
              size="sm"
              onClick={() =>
                setEditing({
                  id: undefined as any,
                  name: "New system consent",
                  treatment_type: "",
                  body_markdown: "",
                  requires_signature: true,
                  is_system: true,
                  sections: [
                    { title: "About the treatment", body: "" },
                    { title: "Risks & possible complications", bullets: [] },
                    { title: "Aftercare", bullets: [] },
                  ],
                  summary: "",
                } as Tpl)
              }
            >
              <FileSignature className="mr-2 h-4 w-4" /> New system template
            </Button>
          )}
          {isAdmin && (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => { setAiSystem(true); setAiOpen(true); }}
            >
              <Sparkles className="mr-2 h-4 w-4" /> AI system template
            </Button>
          )}
        </div>
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search consent forms (Botox, lip filler, Sculptra…)"
          className="pl-9"
        />
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground">
          System templates · {system.length}
        </h2>
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : system.length === 0 ? (
          <p className="text-sm text-muted-foreground">No matches.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {system.map((t) => (
              <TemplateCard
                key={t.id}
                t={t}
                editable={isAdmin}
                onPreview={() => setEditing(t)}
                onEdit={isAdmin ? () => setEditing(t) : undefined}
                onClone={async () => {
                  await clone({ data: { template_id: t.id } });
                  toast.success("Cloned to your templates");
                  refresh();
                }}
                onDelete={
                  isAdmin
                    ? async () => {
                        if (!confirm("Remove this system consent template for all practitioners?")) return;
                        await remove({ data: { id: t.id } });
                        toast.success("System template removed");
                        refresh();
                      }
                    : undefined
                }
              />
            ))}
          </div>
        )}
      </section>


      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground">
          Your templates · {mine.length}
        </h2>
        {mine.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No custom consent forms yet — clone a system template or start a new blank one.
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {mine.map((t) => (
              <TemplateCard
                key={t.id}
                t={t}
                editable
                onEdit={() => setEditing(t)}
                onDelete={async () => {
                  if (!confirm("Delete this consent template?")) return;
                  await remove({ data: { id: t.id } });
                  refresh();
                }}
              />
            ))}
          </div>
        )}
      </section>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              {editing?.is_system
                ? isAdmin
                  ? editing?.id
                    ? "Edit system consent template"
                    : "New system consent template"
                  : "Preview consent"
                : editing?.id
                  ? "Edit consent template"
                  : "New consent template"}
            </DialogTitle>
          </DialogHeader>
          {editing && (
            <EditorBody
              value={editing}
              disabled={editing.is_system && !isAdmin}
              onChange={(v) => setEditing(v)}
            />
          )}
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setEditing(null)}>
              Close
            </Button>
            {editing && (!editing.is_system || isAdmin) && (
              <Button onClick={handleSave}>
                {editing.is_system ? "Save system template" : "Save consent form"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AiGenerateConsentDialog
        open={aiOpen}
        onOpenChange={setAiOpen}
        onCreated={refresh}
        isSystem={aiSystem && isAdmin}
      />

    </div>
  );
}

function TemplateCard({
  t,
  editable,
  onPreview,
  onClone,
  onEdit,
  onDelete,
}: {
  t: Tpl;
  editable?: boolean;
  onPreview?: () => void;
  onClone?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}) {
  const sectionCount = Array.isArray(t.sections) ? t.sections.length : 0;
  return (
    <Card className="transition hover:shadow-md">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-start justify-between gap-2 text-base">
          <span className="flex items-center gap-2">
            <FileSignature className="h-4 w-4 text-primary" />
            {t.name}
          </span>
        </CardTitle>
        <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
          {t.treatment_type && (
            <span className="rounded-full bg-muted px-2 py-0.5">{t.treatment_type}</span>
          )}
          {sectionCount > 0 && (
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-primary">
              {sectionCount} sections
            </span>
          )}
          {t.requires_signature && (
            <span className="rounded-full bg-muted px-2 py-0.5">Requires signature</span>
          )}
        </div>
        {t.summary && (
          <p className="line-clamp-2 pt-1 text-xs text-muted-foreground">{t.summary}</p>
        )}
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2">
        {editable && onEdit && (
          <Button size="sm" variant="outline" onClick={onEdit}>
            <Pencil className="mr-2 h-3 w-3" /> Edit
          </Button>
        )}
        {onClone && (
          <Button size="sm" variant="outline" onClick={onClone}>
            <Copy className="mr-2 h-3 w-3" /> Clone
          </Button>
        )}
        {onPreview && !editable && (
          <Button size="sm" variant="ghost" onClick={onPreview}>
            <Eye className="mr-2 h-3 w-3" /> Preview
          </Button>
        )}
        {onDelete && (
          <Button size="sm" variant="ghost" onClick={onDelete} className="ml-auto text-destructive">
            <Trash2 className="h-3 w-3" />
          </Button>
        )}
      </CardContent>

    </Card>
  );
}

function EditorBody({
  value,
  disabled,
  onChange,
}: {
  value: Tpl;
  disabled?: boolean;
  onChange: (v: Tpl) => void;
}) {
  const sections = useMemo(
    () => (Array.isArray(value.sections) ? value.sections : []) as ConsentSection[],
    [value.sections],
  );
  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Name</Label>
          <Input
            value={value.name}
            disabled={disabled}
            onChange={(e) => onChange({ ...value, name: e.target.value })}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Treatment type / tag</Label>
          <Input
            value={value.treatment_type ?? ""}
            disabled={disabled}
            placeholder="e.g. filler, anti_wrinkle, peel"
            onChange={(e) => onChange({ ...value, treatment_type: e.target.value })}
          />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label>Short summary (shown at top)</Label>
        <Textarea
          rows={2}
          value={value.summary ?? ""}
          disabled={disabled}
          onChange={(e) => onChange({ ...value, summary: e.target.value })}
          placeholder="One-line summary describing this consent"
        />
      </div>

      <Tabs defaultValue="sections">
        <TabsList>
          <TabsTrigger value="sections">Sections</TabsTrigger>
          <TabsTrigger value="preview">Preview</TabsTrigger>
          <TabsTrigger value="legacy">Legacy body</TabsTrigger>
        </TabsList>
        <TabsContent value="sections" className="space-y-3 pt-3">
          <ConsentSectionsEditor
            value={sections}
            disabled={disabled}
            onChange={(s) => onChange({ ...value, sections: s })}
          />
        </TabsContent>
        <TabsContent value="preview" className="pt-3">
          <ConsentSectionsView
            sections={sections}
            summary={value.summary ?? undefined}
            fallbackBody={value.body_markdown}
          />
        </TabsContent>
        <TabsContent value="legacy" className="space-y-2 pt-3">
          <p className="text-xs text-muted-foreground">
            Plain-text fallback shown if no sections are defined.
          </p>
          <Textarea
            rows={10}
            className="font-mono text-xs"
            value={value.body_markdown ?? ""}
            disabled={disabled}
            onChange={(e) => onChange({ ...value, body_markdown: e.target.value })}
          />
        </TabsContent>
      </Tabs>

      <div className="flex items-center justify-between rounded-md border p-3">
        <div>
          <p className="text-sm font-medium">Requires signature</p>
          <p className="text-xs text-muted-foreground">
            Patient must sign before treatment proceeds.
          </p>
        </div>
        <Switch
          checked={!!value.requires_signature}
          disabled={disabled}
          onCheckedChange={(v) => onChange({ ...value, requires_signature: v })}
        />
      </div>
    </div>
  );
}
