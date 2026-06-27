import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import {
  getMyCategories,
  createCategory,
  updateCategory,
  deleteCategory,
} from "@/lib/categories.functions";
import {
  getMyTreatments,
  createTreatment,
  deleteTreatment,
} from "@/lib/treatments.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ChevronDown,
  ChevronRight,
  FolderPlus,
  Plus,
  Pencil,
  Search,
  Trash2,
  GripVertical,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/dashboard/services")({
  component: ServicesPage,
});

type Cat = {
  id: string;
  parent_id: string | null;
  name: string;
  description: string | null;
  icon: string | null;
  sort_order: number;
};
type Treat = {
  id: string;
  name: string;
  description: string | null;
  duration: number;
  price: number;
  category_id: string | null;
};
type CatNode = Cat & { children: CatNode[]; treatments: Treat[] };

function buildTree(cats: Cat[], treats: Treat[]): {
  roots: CatNode[];
  uncategorised: Treat[];
} {
  const byId = new Map<string, CatNode>();
  cats.forEach((c) => byId.set(c.id, { ...c, children: [], treatments: [] }));
  const roots: CatNode[] = [];
  byId.forEach((n) => {
    if (n.parent_id && byId.has(n.parent_id)) byId.get(n.parent_id)!.children.push(n);
    else roots.push(n);
  });
  const uncategorised: Treat[] = [];
  treats.forEach((t) => {
    if (t.category_id && byId.has(t.category_id)) byId.get(t.category_id)!.treatments.push(t);
    else uncategorised.push(t);
  });
  return { roots, uncategorised };
}

function flattenForPicker(roots: CatNode[]): { id: string; label: string; depth: number }[] {
  const out: { id: string; label: string; depth: number }[] = [];
  const walk = (n: CatNode, depth: number, path: string[]) => {
    const next = [...path, n.name];
    out.push({ id: n.id, label: next.join(" › "), depth });
    n.children.forEach((c) => walk(c, depth + 1, next));
  };
  roots.forEach((r) => walk(r, 0, []));
  return out;
}

function ServicesPage() {
  const fetchCats = useServerFn(getMyCategories);
  const fetchTreats = useServerFn(getMyTreatments);
  const createCat = useServerFn(createCategory);
  const updateCat = useServerFn(updateCategory);
  const removeCat = useServerFn(deleteCategory);
  const createTreat = useServerFn(createTreatment);
  const removeTreat = useServerFn(deleteTreatment);

  const cats = useQuery({ queryKey: ["my-categories"], queryFn: () => fetchCats() });
  const treats = useQuery({ queryKey: ["my-treatments"], queryFn: () => fetchTreats() });

  const { roots, uncategorised } = useMemo(
    () => buildTree((cats.data ?? []) as Cat[], (treats.data ?? []) as Treat[]),
    [cats.data, treats.data],
  );
  const picker = useMemo(() => flattenForPicker(roots), [roots]);

  const [search, setSearch] = useState("");
  const [catDialog, setCatDialog] = useState<
    { mode: "create" | "edit"; parentId: string | null; cat?: Cat } | null
  >(null);
  const [svcDialog, setSvcDialog] = useState<{ defaultCatId: string | null } | null>(null);

  const totalCats = (cats.data ?? []).length;
  const totalSvcs = (treats.data ?? []).length;

  const q = search.trim().toLowerCase();
  const matchTreat = (t: Treat) =>
    !q ||
    t.name.toLowerCase().includes(q) ||
    (t.description ?? "").toLowerCase().includes(q);

  async function handleDeleteCat(c: Cat) {
    if (!confirm(`Delete "${c.name}" and its subcategories? Services inside will become Uncategorised.`)) return;
    try {
      await removeCat({ data: { id: c.id } });
      toast.success("Category deleted");
      cats.refetch();
      treats.refetch();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }
  async function handleDeleteTreat(t: Treat) {
    if (!confirm(`Delete service "${t.name}"?`)) return;
    try {
      await removeTreat({ data: { id: t.id } });
      toast.success("Service deleted");
      treats.refetch();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Services</h1>
        <p className="text-sm text-muted-foreground">
          Organise your services into categories and subcategories. Clients see the same structure on your booking page.
        </p>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search for service"
          className="h-12 rounded-xl pl-10"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Button
          className="h-12 rounded-full bg-[hsl(var(--primary))] font-semibold text-primary-foreground hover:bg-[hsl(var(--primary))]/90"
          onClick={() => setCatDialog({ mode: "create", parentId: null })}
        >
          Add Category
        </Button>
        <Button
          className="h-12 rounded-full bg-[hsl(var(--primary))] font-semibold text-primary-foreground hover:bg-[hsl(var(--primary))]/90"
          onClick={() => setSvcDialog({ defaultCatId: null })}
          disabled={picker.length === 0}
          title={picker.length === 0 ? "Create a category first" : ""}
        >
          Add Service
        </Button>
      </div>

      {cats.isLoading || treats.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : roots.length === 0 && uncategorised.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            No categories or services yet. Start by adding a category, then add services inside it.
          </CardContent>
        </Card>
      ) : (
        <div className="divide-y rounded-2xl border bg-card">
          {roots.map((node) => (
            <CategoryRow
              key={node.id}
              node={node}
              depth={0}
              matchTreat={matchTreat}
              onAddSub={(parentId) => setCatDialog({ mode: "create", parentId })}
              onEditCat={(c) =>
                setCatDialog({ mode: "edit", parentId: c.parent_id, cat: c })
              }
              onDeleteCat={handleDeleteCat}
              onAddService={(catId) => setSvcDialog({ defaultCatId: catId })}
              onDeleteTreat={handleDeleteTreat}
            />
          ))}

          {uncategorised.filter(matchTreat).length > 0 && (
            <div className="p-4">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Uncategorised services
              </p>
              <div className="space-y-2">
                {uncategorised.filter(matchTreat).map((t) => (
                  <ServiceRow
                    key={t.id}
                    treat={t}
                    onDelete={() => handleDeleteTreat(t)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}


      <CategoryDialog
        state={catDialog}
        onClose={() => setCatDialog(null)}
        onSubmit={async (values) => {
          try {
            if (catDialog?.mode === "edit" && catDialog.cat) {
              await updateCat({ data: { id: catDialog.cat.id, ...values } });
              toast.success("Category updated");
            } else {
              await createCat({
                data: { ...values, parent_id: catDialog?.parentId ?? null },
              });
              toast.success("Category created");
            }
            setCatDialog(null);
            cats.refetch();
          } catch (e) {
            toast.error((e as Error).message);
          }
        }}
      />

      <ServiceDialog
        state={svcDialog}
        categories={picker}
        onClose={() => setSvcDialog(null)}
        onSubmit={async (values) => {
          try {
            await createTreat({ data: values });
            toast.success("Service created");
            setSvcDialog(null);
            treats.refetch();
          } catch (e) {
            toast.error((e as Error).message);
          }
        }}
      />
    </div>
  );
}

function CategoryRow({
  node,
  depth,
  matchTreat,
  onAddSub,
  onEditCat,
  onDeleteCat,
  onAddService,
  onDeleteTreat,
}: {
  node: CatNode;
  depth: number;
  matchTreat: (t: Treat) => boolean;
  onAddSub: (parentId: string) => void;
  onEditCat: (c: Cat) => void;
  onDeleteCat: (c: Cat) => void;
  onAddService: (catId: string) => void;
  onDeleteTreat: (t: Treat) => void;
}) {
  const [open, setOpen] = useState(depth === 0);
  const treatsHere = node.treatments.filter(matchTreat);
  const hasContent = node.children.length > 0 || treatsHere.length > 0;

  return (
    <div className="border-b-0">
      <div
        className="flex w-full items-center gap-3 px-4 py-4"
        style={{ paddingLeft: 16 + depth * 16 }}
      >
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex flex-1 items-center gap-3 text-left"
          aria-expanded={open}
        >
          <GripVertical className="h-5 w-5 shrink-0 text-[hsl(var(--accent))]" />
          <p className="flex-1 truncate text-base font-bold text-[hsl(var(--primary))] sm:text-lg">
            {node.icon ? `${node.icon} ` : ""}
            {node.name}
          </p>
        </button>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onEditCat(node); }}
          className="rounded-md p-1.5 text-[hsl(var(--accent))] hover:bg-muted"
          aria-label="Edit category"
        >
          <Pencil className="h-5 w-5" />
        </button>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onDeleteCat(node); }}
          className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-destructive"
          aria-label="Delete category"
        >
          <Trash2 className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="rounded-md p-1.5 text-[hsl(var(--primary))] hover:bg-muted"
          aria-label={open ? "Collapse" : "Expand"}
        >
          {open ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
        </button>
      </div>

      {open && (
        <div className="border-t bg-muted/10">
          {treatsHere.map((t) => (
            <div key={t.id} style={{ paddingLeft: 16 + (depth + 1) * 16 }} className="border-b py-2 pr-4">
              <ServiceRow treat={t} onDelete={() => onDeleteTreat(t)} />
            </div>
          ))}

          {node.children.map((child) => (
            <CategoryRow
              key={child.id}
              node={child}
              depth={depth + 1}
              matchTreat={matchTreat}
              onAddSub={onAddSub}
              onEditCat={onEditCat}
              onDeleteCat={onDeleteCat}
              onAddService={onAddService}
              onDeleteTreat={onDeleteTreat}
            />
          ))}

          <div
            className="flex flex-wrap gap-2 border-t py-2 pr-4"
            style={{ paddingLeft: 16 + (depth + 1) * 16 }}
          >
            <Button size="sm" variant="outline" className="rounded-full" onClick={() => onAddService(node.id)}>
              <Plus className="mr-1.5 h-3.5 w-3.5" /> Add service
            </Button>
            <Button size="sm" variant="ghost" className="rounded-full" onClick={() => onAddSub(node.id)}>
              <FolderPlus className="mr-1.5 h-3.5 w-3.5" /> Add subcategory
            </Button>
          </div>
          {!hasContent && null}
        </div>
      )}
    </div>
  );
}


function ServiceRow({ treat, onDelete }: { treat: Treat; onDelete: () => void }) {
  return (
    <div className="flex items-center gap-3 rounded-md border bg-background px-3 py-2">
      <div className="flex-1 min-w-0">
        <p className="truncate text-sm font-medium">{treat.name}</p>
        <p className="text-xs text-muted-foreground">
          £{treat.price} · {treat.duration} min
        </p>
      </div>
      <Link
        to="/dashboard/treatments"
        className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
        aria-label="Edit service"
      >
        <Pencil className="h-3.5 w-3.5" />
      </Link>
      <button
        type="button"
        onClick={onDelete}
        className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-destructive"
        aria-label="Delete service"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function CategoryDialog({
  state,
  onClose,
  onSubmit,
}: {
  state: { mode: "create" | "edit"; parentId: string | null; cat?: Cat } | null;
  onClose: () => void;
  onSubmit: (v: { name: string; description?: string; icon?: string }) => Promise<void>;
}) {
  const open = !!state;
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [icon, setIcon] = useState("");
  const [saving, setSaving] = useState(false);

  useMemo(() => {
    if (open) {
      setName(state?.cat?.name ?? "");
      setDescription(state?.cat?.description ?? "");
      setIcon(state?.cat?.icon ?? "");
    }
  }, [open, state]);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {state?.mode === "edit"
              ? "Edit category"
              : state?.parentId
                ? "New subcategory"
                : "New category"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="c-name">Category name</Label>
            <Input
              id="c-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Start typing your category"
              maxLength={80}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="c-desc">Description</Label>
            <Textarea
              id="c-desc"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Write a short description about your services"
              maxLength={500}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="c-icon">Icon emoji (optional)</Label>
            <Input
              id="c-icon"
              value={icon}
              onChange={(e) => setIcon(e.target.value)}
              placeholder="e.g. 💉"
              maxLength={4}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={!name.trim() || saving}
            onClick={async () => {
              setSaving(true);
              await onSubmit({
                name: name.trim(),
                description: description.trim() || undefined,
                icon: icon.trim() || undefined,
              });
              setSaving(false);
            }}
          >
            {saving ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ServiceDialog({
  state,
  categories,
  onClose,
  onSubmit,
}: {
  state: { defaultCatId: string | null } | null;
  categories: { id: string; label: string; depth: number }[];
  onClose: () => void;
  onSubmit: (v: {
    name: string;
    duration: number;
    price: number;
    description?: string;
    category_id?: string | null;
  }) => Promise<void>;
}) {
  const open = !!state;
  const [name, setName] = useState("");
  const [duration, setDuration] = useState(30);
  const [price, setPrice] = useState(0);
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState<string>("__none__");
  const [saving, setSaving] = useState(false);

  useMemo(() => {
    if (open) {
      setName("");
      setDuration(30);
      setPrice(0);
      setDescription("");
      setCategoryId(state?.defaultCatId ?? "__none__");
    }
  }, [open, state]);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add service</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="s-name">Service name</Label>
            <Input
              id="s-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="What service are you offering?"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Assign to category</Label>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Uncategorised</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {"\u00A0\u00A0".repeat(c.depth) + c.label.split(" › ").slice(-1)[0]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="s-desc">Service description</Label>
            <Textarea
              id="s-desc"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Write a short description about your service"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="s-dur">Duration (min)</Label>
              <Input
                id="s-dur"
                type="number"
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="s-price">Price (£)</Label>
              <Input
                id="s-price"
                type="number"
                value={price}
                onChange={(e) => setPrice(Number(e.target.value))}
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            For consent forms, deposits, staff and media options, edit the service from{" "}
            <Link to="/dashboard/treatments" className="underline">
              advanced service settings
            </Link>
            .
          </p>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={!name.trim() || saving}
            onClick={async () => {
              setSaving(true);
              await onSubmit({
                name: name.trim(),
                duration,
                price,
                description: description.trim() || undefined,
                category_id: categoryId === "__none__" ? null : categoryId,
              });
              setSaving(false);
            }}
          >
            {saving ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
