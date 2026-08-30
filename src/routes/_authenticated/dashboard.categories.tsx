import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  getMyCategories,
  createCategory,
  updateCategory,
  deleteCategory,
} from "@/lib/categories.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useMemo, useState } from "react";
import { ChevronRight, Plus, Pencil, Trash2, FolderTree } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/dashboard/categories")({
  component: CategoriesPage,
});

type Cat = {
  id: string;
  parent_id: string | null;
  name: string;
  description: string | null;
  icon: string | null;
  sort_order: number;
  rebook_reminder_days: number | null;
  topup_reminder_days: number | null;
};

type TreeNode = Cat & { children: TreeNode[] };

function buildTree(rows: Cat[]): TreeNode[] {
  const byId = new Map<string, TreeNode>();
  rows.forEach((r) => byId.set(r.id, { ...r, children: [] }));
  const roots: TreeNode[] = [];
  byId.forEach((node) => {
    if (node.parent_id && byId.has(node.parent_id)) {
      byId.get(node.parent_id)!.children.push(node);
    } else {
      roots.push(node);
    }
  });
  return roots;
}

function CategoriesPage() {
  const router = useRouter();
  const fetchCats = useServerFn(getMyCategories);
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["my-categories"],
    queryFn: () => fetchCats(),
  });

  const tree = useMemo(() => buildTree((data ?? []) as Cat[]), [data]);

  const [editing, setEditing] = useState<{
    mode: "create" | "edit";
    parentId: string | null;
    cat?: Cat;
  } | null>(null);

  const createFn = useServerFn(createCategory);
  const updateFn = useServerFn(updateCategory);
  const deleteFn = useServerFn(deleteCategory);

  async function handleDelete(cat: Cat) {
    if (!confirm(`Delete "${cat.name}" and all its subcategories?`)) return;
    try {
      await deleteFn({ data: { id: cat.id } });
      toast.success("Category deleted");
      refetch();
      router.invalidate();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Categories</h1>
          <p className="text-sm text-muted-foreground">
            Group treatments into categories and subcategories. Unlimited depth.
          </p>
        </div>
        <Button onClick={() => setEditing({ mode: "create", parentId: null })}>
          <Plus className="mr-2 h-4 w-4" /> New top-level category
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <FolderTree className="h-4 w-4" /> Category tree
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : tree.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No categories yet. Add your first one to start organising treatments.
            </p>
          ) : (
            <ul className="space-y-1">
              {tree.map((node) => (
                <TreeRow
                  key={node.id}
                  node={node}
                  depth={0}
                  onAddChild={(parentId) => setEditing({ mode: "create", parentId })}
                  onEdit={(cat) =>
                    setEditing({ mode: "edit", parentId: cat.parent_id, cat })
                  }
                  onDelete={handleDelete}
                />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <CategoryDialog
        open={!!editing}
        onClose={() => setEditing(null)}
        mode={editing?.mode ?? "create"}
        parentId={editing?.parentId ?? null}
        cat={editing?.cat}
        onSubmit={async (values) => {
          try {
            if (editing?.mode === "edit" && editing.cat) {
              await updateFn({ data: { id: editing.cat.id, ...values } });
              toast.success("Category updated");
            } else {
              await createFn({
                data: { ...values, parent_id: editing?.parentId ?? null },
              });
              toast.success("Category created");
            }
            setEditing(null);
            refetch();
          } catch (e) {
            toast.error((e as Error).message);
          }
        }}
      />
    </div>
  );
}

function TreeRow({
  node,
  depth,
  onAddChild,
  onEdit,
  onDelete,
}: {
  node: TreeNode;
  depth: number;
  onAddChild: (parentId: string) => void;
  onEdit: (cat: Cat) => void;
  onDelete: (cat: Cat) => void;
}) {
  const [open, setOpen] = useState(true);
  const hasChildren = node.children.length > 0;
  return (
    <li>
      <div
        className="group flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted"
        style={{ paddingLeft: 8 + depth * 20 }}
      >
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex h-5 w-5 items-center justify-center text-muted-foreground"
          aria-label={open ? "Collapse" : "Expand"}
        >
          {hasChildren ? (
            <ChevronRight
              className={`h-4 w-4 transition-transform ${open ? "rotate-90" : ""}`}
            />
          ) : (
            <span className="h-1 w-1 rounded-full bg-muted-foreground/40" />
          )}
        </button>
        <span className="flex-1 text-sm">{node.name}</span>
        <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onAddChild(node.id)}
            title="Add subcategory"
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onEdit(node)}
            title="Edit"
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onDelete(node)}
            title="Delete"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
      {hasChildren && open && (
        <ul className="space-y-1">
          {node.children.map((child) => (
            <TreeRow
              key={child.id}
              node={child}
              depth={depth + 1}
              onAddChild={onAddChild}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

function CategoryDialog({
  open,
  onClose,
  mode,
  parentId,
  cat,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  mode: "create" | "edit";
  parentId: string | null;
  cat?: Cat;
  onSubmit: (values: {
    name: string;
    description?: string | null;
    icon?: string | null;
    rebook_reminder_days?: number | null;
    topup_reminder_days?: number | null;
  }) => Promise<void>;
}) {
  const [name, setName] = useState(cat?.name ?? "");
  const [description, setDescription] = useState(cat?.description ?? "");
  const [icon, setIcon] = useState(cat?.icon ?? "");
  const [rebookDays, setRebookDays] = useState<string>(
    cat?.rebook_reminder_days != null ? String(cat.rebook_reminder_days) : "",
  );
  const [topupDays, setTopupDays] = useState<string>(
    cat?.topup_reminder_days != null ? String(cat.topup_reminder_days) : "",
  );
  const [saving, setSaving] = useState(false);

  // Reset when dialog opens
  useMemo(() => {
    if (open) {
      setName(cat?.name ?? "");
      setDescription(cat?.description ?? "");
      setIcon(cat?.icon ?? "");
      setRebookDays(cat?.rebook_reminder_days != null ? String(cat.rebook_reminder_days) : "");
      setTopupDays(cat?.topup_reminder_days != null ? String(cat.topup_reminder_days) : "");
    }
  }, [open, cat]);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {mode === "edit"
              ? "Edit category"
              : parentId
                ? "New subcategory"
                : "New category"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="cat-name">Name</Label>
            <Input
              id="cat-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Injectables"
              maxLength={80}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cat-desc">Description (optional)</Label>
            <Textarea
              id="cat-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={500}
              rows={3}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cat-icon">Icon emoji (optional)</Label>
            <Input
              id="cat-icon"
              value={icon}
              onChange={(e) => setIcon(e.target.value)}
              placeholder="e.g. 💉"
              maxLength={4}
            />
          </div>
          <div className="rounded-md border p-3 space-y-3">
            <div>
              <Label className="m-0 text-sm">Reminders (default for this category)</Label>
              <p className="text-[11px] text-muted-foreground">Used for treatments in this category that don't set their own value.</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="cat-rebook" className="text-xs text-muted-foreground">Rebook reminder — days after</Label>
                <Input
                  id="cat-rebook"
                  type="number"
                  min={0}
                  placeholder="e.g. 90"
                  value={rebookDays}
                  onChange={(e) => setRebookDays(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cat-topup" className="text-xs text-muted-foreground">Top-up reminder — days after</Label>
                <Input
                  id="cat-topup"
                  type="number"
                  min={0}
                  placeholder="e.g. 30"
                  value={topupDays}
                  onChange={(e) => setTopupDays(e.target.value)}
                />
              </div>
            </div>
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
                description: description.trim() || null,
                icon: icon.trim() || null,
                rebook_reminder_days: rebookDays.trim() === "" ? null : Number(rebookDays),
                topup_reminder_days: topupDays.trim() === "" ? null : Number(topupDays),
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
