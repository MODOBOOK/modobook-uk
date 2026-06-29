import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  listForms, saveForm, deleteForm, getForm,
  listFormCategories, upsertFormCategory, deleteFormCategory,
} from "@/lib/medical-forms.functions";
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
        case "checkbox": return { id: nid(), type, label: "I agree" };
        case "separator": return { id: nid(), type };
        case "space": return { id: nid(), type };
        case "signature": return { id: nid(), type, label: "Signature" };
      }
    })();
    setSchema((s) => ({
      ...s,
      steps: s.steps.map((st) => st.id === stepId ? { ...st, elements: [...st.elements, base] } : st),
    }));
    setPickerStep(null);
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
                onChange={(patch) => updateElement(step.id, el.id, patch)}
                onRemove={() => removeElement(step.id, el.id)}
                onMove={(d) => moveElement(step.id, el.id, d)}
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

function ElementEditor({ element, onChange, onRemove, onMove }: {
  element: FormElement;
  onChange: (p: Partial<FormElement>) => void;
  onRemove: () => void;
  onMove: (d: -1 | 1) => void;
}) {
  return (
    <div className="group space-y-2 rounded-md border bg-muted/20 p-3">
      <div className="flex items-center gap-1">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{element.type}</span>
        <div className="ml-auto flex items-center gap-0.5">
          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => onMove(-1)}><ChevronUp className="h-3 w-3" /></Button>
          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => onMove(1)}><ChevronDown className="h-3 w-3" /></Button>
          <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive" onClick={onRemove}><Trash2 className="h-3 w-3" /></Button>
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

      {element.type === "field" && (
        <div className="space-y-2">
          <div className="grid grid-cols-[1fr_auto_auto] gap-2">
            <Input value={element.label ?? ""} onChange={(e) => onChange({ label: e.target.value })} placeholder="Label" />
            <Select value={element.fieldType ?? "text"} onValueChange={(v) => onChange({ fieldType: v as any })}>
              <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="text">Text</SelectItem>
                <SelectItem value="email">Email</SelectItem>
                <SelectItem value="tel">Phone</SelectItem>
                <SelectItem value="number">Number</SelectItem>
                <SelectItem value="date">Date</SelectItem>
                <SelectItem value="textarea">Long text</SelectItem>
              </SelectContent>
            </Select>
            <label className="flex items-center gap-1 text-xs">
              <Checkbox checked={!!element.required} onCheckedChange={(c) => onChange({ required: !!c })} />
              Req
            </label>
          </div>
          <Input value={element.placeholder ?? ""} onChange={(e) => onChange({ placeholder: e.target.value })} placeholder="Placeholder (optional)" />
        </div>
      )}

      {element.type === "select" && (
        <div className="space-y-2">
          <div className="grid grid-cols-[1fr_auto] gap-2">
            <Input value={element.label ?? ""} onChange={(e) => onChange({ label: e.target.value })} placeholder="Label" />
            <label className="flex items-center gap-1 text-xs">
              <Checkbox checked={!!element.required} onCheckedChange={(c) => onChange({ required: !!c })} />Req
            </label>
          </div>
          <Textarea rows={3} placeholder="Options, one per line" value={(element.options ?? []).join("\n")}
            onChange={(e) => onChange({ options: e.target.value.split("\n").map((s) => s.trim()).filter(Boolean) })} />
        </div>
      )}

      {element.type === "checkbox" && (
        <Input value={element.label ?? ""} onChange={(e) => onChange({ label: e.target.value })} placeholder="Checkbox label" />
      )}

      {element.type === "signature" && (
        <Input value={element.label ?? "Signature"} onChange={(e) => onChange({ label: e.target.value })} placeholder="Signature label" />
      )}

      {(element.type === "separator" || element.type === "space") && (
        <div className="text-xs text-muted-foreground">No options.</div>
      )}
    </div>
  );
}

function ElementPicker({ open, onClose, onPick }: { open: boolean; onClose: () => void; onPick: (t: ElType) => void }) {
  const items: { type: ElType; label: string; icon: any }[] = [
    { type: "heading", label: "Heading", icon: Heading1 },
    { type: "paragraph", label: "Paragraph", icon: TypeIcon },
    { type: "field", label: "Field", icon: TextCursorInput },
    { type: "select", label: "Select", icon: ListChecks },
    { type: "checkbox", label: "Checkbox", icon: CheckSquare },
    { type: "separator", label: "Separator", icon: Minus },
    { type: "space", label: "Space", icon: MoveVertical },
    { type: "signature", label: "Signature", icon: Signature },
  ];
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Select Element</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          {items.map(({ type, label, icon: Icon }) => (
            <button
              key={type}
              onClick={() => onPick(type)}
              className="flex flex-col items-center gap-2 rounded-xl border p-4 transition hover:bg-muted active:scale-95"
            >
              <Icon className="h-7 w-7 text-primary" />
              <span className="text-sm font-bold">{label}</span>
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
