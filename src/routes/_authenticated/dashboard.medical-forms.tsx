import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  listForms, saveForm, deleteForm, getForm,
  listFormCategories, upsertFormCategory, deleteFormCategory,
  listRecentFormSubmissions,
} from "@/lib/medical-forms.functions";
import { FormResponseDialog } from "@/components/patient/FormResponseDialog";
import { getMyTreatments } from "@/lib/treatments.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Accordion, AccordionItem, AccordionTrigger, AccordionContent,
} from "@/components/ui/accordion";
import {
  Search, Plus, Pencil, Trash2, ChevronUp, ChevronDown, Heading1, Type as TypeIcon,
  TextCursorInput, ListChecks, CheckSquare, Minus, MoveVertical, Signature, Loader2, X,
  Copy, GripVertical, Info, Star, CircleDot, ListTodo,
} from "lucide-react";
import { toast } from "sonner";
import { AiGenerateFormDialog } from "@/components/medical-forms/AiGenerateFormDialog";
import { Sparkles } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard/medical-forms")({
  ssr: false,
  component: FormsPage,
});

/* ---------- Schema types ---------- */
type ElType =
  | "heading" | "paragraph" | "field" | "select" | "checkbox" | "separator"
  | "space" | "signature" | "radio" | "checkbox_group" | "info" | "rating";
type FormElement = {
  id: string;
  type: ElType;
  label?: string;
  placeholder?: string;
  helpText?: string;
  required?: boolean;
  options?: string[];
  text?: string;
  level?: 1 | 2 | 3;
  fieldType?: "text" | "email" | "tel" | "number" | "date" | "textarea";
  variant?: "info" | "warning" | "success";
  max?: number;
  /** Conditional visibility: only show when answer to `showIfId` equals `equals` (string match, or contained for multi-choice). */
  logic?: { showIfId: string; equals: string } | null;
};
type FormStep = { id: string; title: string; elements: FormElement[] };
type FormSchema = { steps: FormStep[] };


function nid() { return Math.random().toString(36).slice(2, 9); }

function defaultSchema(): FormSchema {
  return {
    steps: [{
      id: nid(),
      title: "About You",
      elements: [
        { id: nid(), type: "heading", text: "About You", level: 2 },
        { id: nid(), type: "field", label: "Name", required: true, fieldType: "text" },
        { id: nid(), type: "field", label: "Phone Number", required: true, fieldType: "tel", placeholder: "+44XXXXXXXXXX" },
        { id: nid(), type: "field", label: "Email Address", required: true, fieldType: "email" },
        { id: nid(), type: "select", label: "Gender", required: true, options: ["Female", "Male", "Non-binary", "Other"] },
        { id: nid(), type: "field", label: "DOB", required: true, fieldType: "date" },
        { id: nid(), type: "field", label: "Address", fieldType: "textarea" },
      ],
    }],
  };
}

type Form = {
  id: string;
  name: string;
  description: string | null;
  schema: FormSchema | null;
  category_id: string | null;
  validity: string;
  is_system: boolean;
  profile_id: string | null;
};
type Cat = { id: string; name: string };

function FormsPage() {
  const fetchForms = useServerFn(listForms);
  const fetchCats = useServerFn(listFormCategories);
  const removeForm = useServerFn(deleteForm);
  const upsertCat = useServerFn(upsertFormCategory);
  const removeCat = useServerFn(deleteFormCategory);

  const [forms, setForms] = useState<Form[]>([]);
  const [cats, setCats] = useState<Cat[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newCatOpen, setNewCatOpen] = useState(false);
  const [newForm, setNewForm] = useState(false);
  const [catName, setCatName] = useState("");
  const [aiOpen, setAiOpen] = useState(false);

  async function refresh() {
    const [f, c] = await Promise.all([fetchForms(), fetchCats()]);
    setForms(f as Form[]);
    setCats(c as Cat[]);
    setLoading(false);
  }
  useEffect(() => { refresh(); /* eslint-disable-next-line */ }, []);

  const grouped = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = q ? forms.filter((f) => f.name.toLowerCase().includes(q)) : forms;
    const map = new Map<string, { cat: Cat | null; forms: Form[] }>();
    for (const c of cats) map.set(c.id, { cat: c, forms: [] });
    map.set("uncat", { cat: null, forms: [] });
    for (const f of filtered) {
      const key = f.category_id && map.has(f.category_id) ? f.category_id : "uncat";
      map.get(key)!.forms.push(f);
    }
    return Array.from(map.values()).filter((g) => g.forms.length > 0 || g.cat);
  }, [forms, cats, search]);

  async function handleSaveCat() {
    if (!catName.trim()) return;
    await upsertCat({ data: { name: catName.trim() } });
    setCatName("");
    setNewCatOpen(false);
    refresh();
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this form?")) return;
    await removeForm({ data: { id } });
    refresh();
  }

  if (editingId !== null) {
    return (
      <FormEditor
        formId={editingId}
        onClose={() => { setEditingId(null); refresh(); }}
        cats={cats}
      />
    );
  }
  if (newForm) {
    return (
      <FormEditor
        formId={""}
        onClose={() => { setNewForm(false); refresh(); }}
        cats={cats}
      />
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4 pb-12">
      <div>
        <h1 className="text-2xl font-bold">Medical Forms</h1>
        <p className="text-xs text-muted-foreground">
          <span className="font-semibold text-orange-600">Total Categories: {cats.length}</span>{"  "}
          <span className="font-semibold text-orange-600">Total Forms: {forms.length}</span>
        </p>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search for form" className="pl-10" />
      </div>

      <RecentSubmissionsPanel />

      <div className="grid grid-cols-2 gap-2">
        <Button variant="default" onClick={() => setNewCatOpen(true)}><Plus className="mr-2 h-4 w-4" />Add Category</Button>
        <Button variant="default" onClick={() => setNewForm(true)}><Plus className="mr-2 h-4 w-4" />Add Form</Button>
      </div>


      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : (
        <Accordion type="multiple" className="divide-y rounded-lg border">
          {grouped.map((g, i) => (
            <AccordionItem key={g.cat?.id ?? `uncat-${i}`} value={g.cat?.id ?? "uncat"} className="border-0 px-4">
              <div className="flex items-center">
                <AccordionTrigger className="flex-1 py-3 hover:no-underline">
                  <span className="text-base font-bold text-left">{g.cat?.name ?? "Uncategorised"}</span>
                </AccordionTrigger>
                {g.cat && (() => {
                  const c = g.cat;
                  return (
                    <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0" onClick={async (e) => {
                      e.stopPropagation();
                      if (!confirm(`Delete category "${c.name}"? Forms will become uncategorised.`)) return;
                      await removeCat({ data: { id: c.id } });
                      refresh();
                    }}>
                      <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                    </Button>
                  );
                })()}
              </div>
              <AccordionContent>
                <div className="space-y-1.5 pb-3">
                  {g.forms.length === 0 ? (
                    <div className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">No forms in this category yet.</div>
                  ) : g.forms.map((f) => (
                    <div key={f.id} className="flex items-center justify-between gap-2 rounded-md border p-2.5">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold">{f.name}</div>
                        {f.description && <div className="truncate text-xs text-muted-foreground">{f.description}</div>}
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        {f.is_system && <Badge variant="secondary" className="text-[10px]">System</Badge>}
                        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setEditingId(f.id)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        {!f.is_system && (
                          <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => handleDelete(f.id)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      )}

      <Dialog open={newCatOpen} onOpenChange={setNewCatOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>New category</DialogTitle></DialogHeader>
          <Input placeholder="e.g. Injections, Skin Treatments" value={catName} onChange={(e) => setCatName(e.target.value)} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewCatOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveCat}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ============= Recent submissions panel ============= */

function RecentSubmissionsPanel() {
  const fetchRecent = useServerFn(listRecentFormSubmissions);
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewId, setViewId] = useState<string | null>(null);

  useEffect(() => {
    fetchRecent({ data: { limit: 10 } })
      .then((r: any) => setRows(r ?? []))
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, [fetchRecent]);

  if (!loading && rows.length === 0) return null;

  return (
    <Accordion type="single" collapsible className="rounded-lg border">
      <AccordionItem value="recent" className="border-0 px-4">
        <AccordionTrigger className="py-3 hover:no-underline">
          <span className="flex items-center gap-2 text-sm font-semibold">
            Recent submissions
            <Badge variant="secondary" className="text-[10px]">{rows.length}</Badge>
          </span>
        </AccordionTrigger>
        <AccordionContent>
          <div className="space-y-1.5 pb-3">
            {loading ? (
              <div className="flex justify-center py-4"><Loader2 className="h-4 w-4 animate-spin" /></div>
            ) : rows.map((r) => {
              const done = r.status === "submitted";
              return (
                <button
                  key={r.id}
                  onClick={() => setViewId(r.id)}
                  className="flex w-full items-center gap-2 rounded-md border p-2.5 text-left text-sm hover:bg-muted"
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{r.template?.name ?? "Form"}</div>
                    <div className="truncate text-[11px] text-muted-foreground">
                      {(r.client?.full_name ?? r.recipient_email ?? "—")} ·{" "}
                      {done && r.submitted_at
                        ? `Completed ${new Date(r.submitted_at).toLocaleDateString()}`
                        : `Sent ${new Date(r.created_at).toLocaleDateString()}`}
                    </div>
                  </div>
                  <Badge variant={done ? "default" : "secondary"} className="text-[10px]">
                    {done ? "Completed" : "Pending"}
                  </Badge>
                </button>
              );
            })}
          </div>
        </AccordionContent>
      </AccordionItem>
      <FormResponseDialog open={!!viewId} onOpenChange={(v) => !v && setViewId(null)} submissionId={viewId} />
    </Accordion>
  );
}


/* ============= Form Editor ============= */

function FormEditor({ formId, onClose, cats }: { formId: string; onClose: () => void; cats: Cat[] }) {
  const fetchOne = useServerFn(getForm);
  const save = useServerFn(saveForm);
  const fetchTreatments = useServerFn(getMyTreatments);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [validity, setValidity] = useState("always_required");
  const [schema, setSchema] = useState<FormSchema>(defaultSchema());
  const [treatments, setTreatments] = useState<{ id: string; name: string }[]>([]);
  const [selectedTreatments, setSelectedTreatments] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [pickerStep, setPickerStep] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const tr: any = await fetchTreatments();
      setTreatments(tr ?? []);
      if (formId) {
        const row: any = await fetchOne({ data: { id: formId } });
        setName(row.name);
        setDescription(row.description ?? "");
        setCategoryId(row.category_id ?? null);
        setValidity(row.validity ?? "always_required");
        const sc = row.schema && typeof row.schema === "object" && Array.isArray(row.schema.steps) ? row.schema : defaultSchema();
        setSchema(sc);
        const linked = (row.treatment_medical_forms ?? []).map((x: any) => x.treatment_id);
        setSelectedTreatments(linked);
      }
    })();
    // eslint-disable-next-line
  }, [formId]);

  async function handleSave() {
    if (!name.trim()) { toast.error("Name is required"); return; }
    setSaving(true);
    try {
      await save({ data: {
        id: formId || undefined,
        name: name.trim(),
        description: description || null,
        category_id: categoryId,
        validity,
        schema,
        treatment_ids: selectedTreatments,
      } });
      toast.success("Form saved");
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally { setSaving(false); }
  }

  function updateStep(idx: number, updater: (s: FormStep) => FormStep) {
    setSchema((s) => ({ ...s, steps: s.steps.map((st, i) => i === idx ? updater(st) : st) }));
  }
  function addStep() {
    setSchema((s) => ({ ...s, steps: [...s.steps, { id: nid(), title: `Step ${s.steps.length + 1}`, elements: [] }] }));
  }
  function removeStep(idx: number) {
    if (schema.steps.length <= 1) { toast.error("At least one step required"); return; }
    setSchema((s) => ({ ...s, steps: s.steps.filter((_, i) => i !== idx) }));
  }

  function addElement(stepId: string, type: ElType) {
    const base: FormElement = (() => {
      switch (type) {
        case "heading": return { id: nid(), type, text: "Heading", level: 2 };
        case "paragraph": return { id: nid(), type, text: "Paragraph text…" };
        case "field": return { id: nid(), type, label: "Field", fieldType: "text" };
        case "select": return { id: nid(), type, label: "Select", options: ["Option 1", "Option 2"] };
        case "radio": return { id: nid(), type, label: "Choose one", options: ["Yes", "No"] };
        case "checkbox_group": return { id: nid(), type, label: "Select all that apply", options: ["Option 1", "Option 2"] };
        case "checkbox": return { id: nid(), type, label: "I agree" };
        case "info": return { id: nid(), type, text: "Helpful info for the patient.", variant: "info" };
        case "rating": return { id: nid(), type, label: "Rate", max: 5 };
        case "separator": return { id: nid(), type };
        case "space": return { id: nid(), type };
        case "signature": return { id: nid(), type, label: "Signature" };
        default: return { id: nid(), type: "paragraph", text: "" };
      }
    })();
    setSchema((s) => ({
      ...s,
      steps: s.steps.map((st) => st.id === stepId ? { ...st, elements: [...st.elements, base] } : st),
    }));
    setPickerStep(null);
  }

  function duplicateElement(stepId: string, elId: string) {
    setSchema((s) => ({
      ...s,
      steps: s.steps.map((st) => {
        if (st.id !== stepId) return st;
        const i = st.elements.findIndex((e) => e.id === elId);
        if (i < 0) return st;
        const copy = { ...st.elements[i], id: nid() };
        const arr = [...st.elements];
        arr.splice(i + 1, 0, copy);
        return { ...st, elements: arr };
      }),
    }));
  }

  function updateElement(stepId: string, elId: string, patch: Partial<FormElement>) {
    setSchema((s) => ({
      ...s,
      steps: s.steps.map((st) => st.id !== stepId ? st : {
        ...st, elements: st.elements.map((el) => el.id === elId ? { ...el, ...patch } : el),
      }),
    }));
  }
  function removeElement(stepId: string, elId: string) {
    setSchema((s) => ({
      ...s,
      steps: s.steps.map((st) => st.id !== stepId ? st : { ...st, elements: st.elements.filter((el) => el.id !== elId) }),
    }));
  }
  function moveElement(stepId: string, elId: string, dir: -1 | 1) {
    setSchema((s) => ({
      ...s,
      steps: s.steps.map((st) => {
        if (st.id !== stepId) return st;
        const i = st.elements.findIndex((e) => e.id === elId);
        const j = i + dir;
        if (i < 0 || j < 0 || j >= st.elements.length) return st;
        const arr = [...st.elements];
        [arr[i], arr[j]] = [arr[j], arr[i]];
        return { ...st, elements: arr };
      }),
    }));
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4 pb-24">
      <header className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3">
        <Button size="icon" variant="ghost" onClick={onClose}><X className="h-5 w-5" /></Button>
        <h1 className="truncate text-xl font-bold">{formId ? "Edit Form" : "Add Form"}</h1>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Save
        </Button>
      </header>

      <Card className="space-y-3 p-4">
        <Field label="Name">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name of the template" />
        </Field>
        <Field label="Validity">
          <Select value={validity} onValueChange={setValidity}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="always_required">Always Required</SelectItem>
              <SelectItem value="once_per_year">Once per year</SelectItem>
              <SelectItem value="once_per_6_months">Once per 6 months</SelectItem>
              <SelectItem value="once_per_3_months">Once per 3 months</SelectItem>
              <SelectItem value="once">Once only</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="Add to a category">
          <Select value={categoryId ?? "none"} onValueChange={(v) => setCategoryId(v === "none" ? null : v)}>
            <SelectTrigger><SelectValue placeholder="Choose a category" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No category</SelectItem>
              {cats.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>
        <Field label={`Services (${selectedTreatments.length} selected)`}>
          <div className="max-h-48 space-y-1 overflow-y-auto rounded-md border p-2">
            {treatments.length === 0 ? (
              <div className="p-2 text-xs text-muted-foreground">No treatments yet</div>
            ) : treatments.map((t) => (
              <label key={t.id} className="flex cursor-pointer items-center gap-2 rounded p-1.5 text-sm hover:bg-muted">
                <Checkbox checked={selectedTreatments.includes(t.id)} onCheckedChange={(c) => {
                  setSelectedTreatments((s) => c ? [...s, t.id] : s.filter((x) => x !== t.id));
                }} />
                <span>{t.name}</span>
              </label>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">When booked, the patient gets a link to fill this form before their appointment.</p>
        </Field>
      </Card>

      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold">Form Template</h2>
        <Button variant="link" size="sm" onClick={() => toast.info("Preview coming soon")}>Preview</Button>
      </div>

      <div className="space-y-4">
        {schema.steps.map((step, idx) => (
          <Card key={step.id} className="space-y-3 p-4">
            <div className="flex items-center gap-2">
              <div className="grid h-7 w-7 shrink-0 place-items-center rounded-full border-2 border-orange-400 text-xs font-bold text-orange-500">{idx + 1}</div>
              <Input
                value={step.title}
                onChange={(e) => updateStep(idx, (s) => ({ ...s, title: e.target.value }))}
                className="flex-1 border-0 bg-transparent text-base font-bold focus-visible:ring-0"
              />
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => removeStep(idx)}>
                <Trash2 className="h-3.5 w-3.5 text-destructive" />
              </Button>
            </div>

            {step.elements.length === 0 && (
              <div className="rounded-md border border-dashed p-4 text-center text-xs text-muted-foreground">
                No elements yet — add one below.
              </div>
            )}

            {step.elements.map((el) => (
              <ElementEditor
                key={el.id}
                element={el}
                siblings={step.elements.filter((x) => x.id !== el.id)}
                onChange={(patch) => updateElement(step.id, el.id, patch)}
                onRemove={() => removeElement(step.id, el.id)}
                onMove={(d) => moveElement(step.id, el.id, d)}
                onDuplicate={() => duplicateElement(step.id, el.id)}
              />
            ))}


            <Button variant="outline" className="w-full" onClick={() => setPickerStep(step.id)}>
              <Plus className="mr-2 h-4 w-4" />Add Item
            </Button>
          </Card>
        ))}

        <Button variant="outline" className="w-full border-dashed" onClick={addStep}>
          <Plus className="mr-2 h-4 w-4" />Add Step
        </Button>
      </div>

      <ElementPicker
        open={!!pickerStep}
        onClose={() => setPickerStep(null)}
        onPick={(t) => pickerStep && addElement(pickerStep, t)}
      />
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label className="text-sm font-bold">{label}</Label>{children}</div>;
}

const TYPE_META: Record<ElType, { label: string; icon: any; tint: string }> = {
  heading: { label: "Heading", icon: Heading1, tint: "bg-amber-100 text-amber-700" },
  paragraph: { label: "Paragraph", icon: TypeIcon, tint: "bg-slate-100 text-slate-700" },
  field: { label: "Input field", icon: TextCursorInput, tint: "bg-blue-100 text-blue-700" },
  select: { label: "Dropdown", icon: ListChecks, tint: "bg-indigo-100 text-indigo-700" },
  radio: { label: "Single choice", icon: CircleDot, tint: "bg-violet-100 text-violet-700" },
  checkbox_group: { label: "Multi choice", icon: ListTodo, tint: "bg-emerald-100 text-emerald-700" },
  checkbox: { label: "Agreement", icon: CheckSquare, tint: "bg-emerald-100 text-emerald-700" },
  info: { label: "Info banner", icon: Info, tint: "bg-sky-100 text-sky-700" },
  rating: { label: "Rating", icon: Star, tint: "bg-yellow-100 text-yellow-700" },
  signature: { label: "Signature", icon: Signature, tint: "bg-rose-100 text-rose-700" },
  separator: { label: "Divider", icon: Minus, tint: "bg-slate-100 text-slate-500" },
  space: { label: "Spacer", icon: MoveVertical, tint: "bg-slate-100 text-slate-500" },
};

function OptionsEditor({ options, onChange }: { options: string[]; onChange: (next: string[]) => void }) {
  const list = options ?? [];
  function update(i: number, v: string) { onChange(list.map((o, idx) => idx === i ? v : o)); }
  function remove(i: number) { onChange(list.filter((_, idx) => idx !== i)); }
  function move(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= list.length) return;
    const arr = [...list]; [arr[i], arr[j]] = [arr[j], arr[i]]; onChange(arr);
  }
  function add() { onChange([...list, `Option ${list.length + 1}`]); }
  return (
    <div className="space-y-1.5">
      {list.length === 0 && (
        <div className="rounded-md border border-dashed p-3 text-center text-xs text-muted-foreground">No options yet</div>
      )}
      {list.map((opt, i) => (
        <div key={i} className="flex items-center gap-1.5 rounded-md border bg-background p-1.5">
          <GripVertical className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-muted text-[10px] font-bold text-muted-foreground">{i + 1}</span>
          <Input
            value={opt}
            onChange={(e) => update(i, e.target.value)}
            className="h-8 flex-1 border-0 bg-transparent px-1 text-sm focus-visible:ring-0"
            placeholder={`Option ${i + 1}`}
          />
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => move(i, -1)} disabled={i === 0}><ChevronUp className="h-3 w-3" /></Button>
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => move(i, 1)} disabled={i === list.length - 1}><ChevronDown className="h-3 w-3" /></Button>
          <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => remove(i)}><X className="h-3 w-3" /></Button>
        </div>
      ))}
      <Button variant="outline" size="sm" className="w-full border-dashed" onClick={add}>
        <Plus className="mr-1.5 h-3.5 w-3.5" />Add option
      </Button>
    </div>
  );
}

function ElementEditor({ element, siblings, onChange, onRemove, onMove, onDuplicate }: {
  element: FormElement;
  siblings: FormElement[];
  onChange: (p: Partial<FormElement>) => void;
  onRemove: () => void;
  onMove: (d: -1 | 1) => void;
  onDuplicate: () => void;
}) {
  const meta = TYPE_META[element.type];
  const Icon = meta.icon;
  const hasLabel = ["field", "select", "radio", "checkbox_group", "checkbox", "signature", "rating"].includes(element.type);
  const hasOptions = element.type === "select" || element.type === "radio" || element.type === "checkbox_group";
  const canRequire = ["field", "select", "radio", "checkbox_group", "checkbox", "signature", "rating"].includes(element.type);

  return (
    <div className="group space-y-2.5 rounded-lg border bg-background p-3 shadow-sm">
      <div className="flex items-center gap-2">
        <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold ${meta.tint}`}>
          <Icon className="h-3 w-3" /> {meta.label}
        </span>
        <div className="ml-auto flex items-center gap-0.5">
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onMove(-1)} title="Move up"><ChevronUp className="h-3.5 w-3.5" /></Button>
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onMove(1)} title="Move down"><ChevronDown className="h-3.5 w-3.5" /></Button>
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onDuplicate} title="Duplicate"><Copy className="h-3.5 w-3.5" /></Button>
          <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={onRemove} title="Delete"><Trash2 className="h-3.5 w-3.5" /></Button>
        </div>
      </div>

      {element.type === "heading" && (
        <div className="grid grid-cols-[1fr_auto] gap-2">
          <Input value={element.text ?? ""} onChange={(e) => onChange({ text: e.target.value })} placeholder="Heading text" />
          <Select value={String(element.level ?? 2)} onValueChange={(v) => onChange({ level: Number(v) as 1 | 2 | 3 })}>
            <SelectTrigger className="w-20"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="1">H1</SelectItem><SelectItem value="2">H2</SelectItem><SelectItem value="3">H3</SelectItem></SelectContent>
          </Select>
        </div>
      )}

      {element.type === "paragraph" && (
        <Textarea rows={2} value={element.text ?? ""} onChange={(e) => onChange({ text: e.target.value })} placeholder="Paragraph text" />
      )}

      {element.type === "info" && (
        <div className="space-y-2">
          <Textarea rows={2} value={element.text ?? ""} onChange={(e) => onChange({ text: e.target.value })} placeholder="Patient-facing message" />
          <Select value={element.variant ?? "info"} onValueChange={(v) => onChange({ variant: v as any })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="info">Info (blue)</SelectItem>
              <SelectItem value="warning">Warning (amber)</SelectItem>
              <SelectItem value="success">Success (green)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      {hasLabel && (
        <Input
          value={element.label ?? ""}
          onChange={(e) => onChange({ label: e.target.value })}
          placeholder={element.type === "checkbox" ? "Checkbox label e.g. I agree…" : "Question / label"}
        />
      )}

      {element.type === "field" && (
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <Select value={element.fieldType ?? "text"} onValueChange={(v) => onChange({ fieldType: v as any })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="text">Short text</SelectItem>
                <SelectItem value="textarea">Long text</SelectItem>
                <SelectItem value="email">Email</SelectItem>
                <SelectItem value="tel">Phone</SelectItem>
                <SelectItem value="number">Number</SelectItem>
                <SelectItem value="date">Date</SelectItem>
              </SelectContent>
            </Select>
            <div className="space-y-1">
              <Label className="text-[11px] text-muted-foreground">Hint text (shown in grey inside the empty answer box — optional)</Label>
              <Input value={element.placeholder ?? ""} onChange={(e) => onChange({ placeholder: e.target.value })} placeholder="e.g. Type your answer here…" />
            </div>
          </div>
        </div>
      )}

      {hasOptions && (
        <OptionsEditor options={element.options ?? []} onChange={(opts) => onChange({ options: opts })} />
      )}

      {element.type === "rating" && (
        <div className="flex items-center gap-2">
          <Label className="text-xs text-muted-foreground">Max stars</Label>
          <Input
            type="number" min={3} max={10}
            value={element.max ?? 5}
            onChange={(e) => onChange({ max: Math.max(3, Math.min(10, Number(e.target.value) || 5)) })}
            className="w-20"
          />
        </div>
      )}

      {(canRequire || hasLabel) && element.type !== "heading" && element.type !== "paragraph" && element.type !== "info" && element.type !== "separator" && element.type !== "space" && (
        <div className="flex flex-wrap items-center gap-3 border-t pt-2">
          <Input
            value={element.helpText ?? ""}
            onChange={(e) => onChange({ helpText: e.target.value })}
            placeholder="Help text (optional)"
            className="h-8 flex-1 text-xs"
          />
          {canRequire && (
            <label className="flex items-center gap-1.5 text-xs font-medium">
              <Checkbox checked={!!element.required} onCheckedChange={(c) => onChange({ required: !!c })} />
              Required
            </label>
          )}
        </div>
      )}

      {(element.type === "separator" || element.type === "space") && (
        <div className="text-xs italic text-muted-foreground">Visual element — no settings.</div>
      )}

      {/* Conditional logic */}
      {element.type !== "heading" && element.type !== "separator" && element.type !== "space" && (
        <ConditionalLogicEditor element={element} siblings={siblings} onChange={onChange} />
      )}
    </div>
  );
}

function ConditionalLogicEditor({ element, siblings, onChange }: {
  element: FormElement; siblings: FormElement[]; onChange: (p: Partial<FormElement>) => void;
}) {
  const candidates = siblings.filter((s) =>
    s.type === "select" || s.type === "radio" || s.type === "checkbox_group" || s.type === "checkbox"
  );
  const logic = element.logic ?? null;
  const target = candidates.find((c) => c.id === logic?.showIfId);
  const opts = target?.type === "checkbox" ? ["Checked"] : (target?.options ?? []);
  if (candidates.length === 0 && !logic) return null;
  return (
    <div className="rounded-md border border-dashed bg-muted/30 p-2 space-y-1.5">
      <div className="flex items-center justify-between">
        <Label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Conditional logic</Label>
        {logic && (
          <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={() => onChange({ logic: null })}>Clear</Button>
        )}
      </div>
      {candidates.length === 0 ? (
        <p className="text-[11px] text-muted-foreground">Add a dropdown, choice or agreement above this item to use logic.</p>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <Select value={logic?.showIfId ?? "__none__"} onValueChange={(v) => onChange({ logic: v === "__none__" ? null : { showIfId: v, equals: "" } })}>
            <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Show if…" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">Always show</SelectItem>
              {candidates.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.label || "(no label)"}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {logic && (
            <Select value={logic.equals || "__pick__"} onValueChange={(v) => onChange({ logic: { ...logic, equals: v === "__pick__" ? "" : v } })}>
              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="equals…" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__pick__">— choose value —</SelectItem>
                {opts.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
        </div>
      )}
    </div>
  );
}

function ElementPicker({ open, onClose, onPick }: { open: boolean; onClose: () => void; onPick: (t: ElType) => void }) {
  const groups: { title: string; items: ElType[] }[] = [
    { title: "Inputs", items: ["field", "select", "radio", "checkbox_group", "checkbox", "rating", "signature"] },
    { title: "Content", items: ["heading", "paragraph", "info"] },
    { title: "Layout", items: ["separator", "space"] },
  ];
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader><DialogTitle>Add element</DialogTitle></DialogHeader>
        <div className="space-y-4">
          {groups.map((g) => (
            <div key={g.title} className="space-y-2">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{g.title}</div>
              <div className="grid grid-cols-3 gap-2">
                {g.items.map((type) => {
                  const m = TYPE_META[type];
                  const Icon = m.icon;
                  return (
                    <button
                      key={type}
                      onClick={() => onPick(type)}
                      className="flex flex-col items-center gap-1.5 rounded-xl border bg-background p-3 transition hover:border-primary hover:shadow-md active:scale-95"
                    >
                      <span className={`grid h-9 w-9 place-items-center rounded-full ${m.tint}`}>
                        <Icon className="h-4 w-4" />
                      </span>
                      <span className="text-xs font-semibold">{m.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

