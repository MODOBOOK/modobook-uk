import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  getMyCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  reorderCategories,
} from "@/lib/categories.functions";

import {
  getMyTreatments,
  createTreatment,
  updateTreatment,
  deleteTreatment,
  reorderTreatments,
} from "@/lib/treatments.functions";
import {
  listMyConsentTemplates,
  setTreatmentConsents,
} from "@/lib/treatment-consents.functions";
import {
  listAftercareTemplates,
  getTreatmentAftercareIds,
  setTreatmentAftercareIds,
} from "@/lib/aftercare-templates.functions";
import { listMyLocations, setTreatmentLocationPricing } from "@/lib/locations.functions";
import { getMyProfile, updateProfile } from "@/lib/profiles.functions";
import { ImageUploader } from "@/components/ImageUploader";
import { PrescribingClinicCard } from "@/components/PrescribingClinicCard";

import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Star, X, Check, ChevronsUpDown, MapPin } from "lucide-react";



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
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { FitText } from "@/components/FitText";
import {
  FolderPlus,
  Plus,
  Pencil,
  Search,
  Trash2,
  ArrowUp,
  ArrowDown,
  MoreVertical,
  ChevronDown,
  GripVertical,
  ListOrdered,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/dashboard/services")({
  component: ServicesPage,
});

const PRESET_COLORS = [
  "#ef4444", "#f97316", "#f59e0b", "#eab308", "#84cc16",
  "#10b981", "#06b6d4", "#3b82f6", "#8b5cf6", "#ec4899",
];


type Cat = {
  id: string;
  parent_id: string | null;
  name: string;
  description: string | null;
  icon: string | null;
  sort_order: number;
  coming_soon_at: string | null;
};
type Treat = {
  id: string;
  name: string;
  description: string | null;
  duration: number;
  price: number;
  category_id: string | null;
  color?: string | null;
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

function AddMenu({
  hasCategories,
  onAddCategory,
  onAddService,
  onAddLimited,
}: {
  hasCategories: boolean;
  onAddCategory: () => void;
  onAddService: () => void;
  onAddLimited: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);
  return (
    <div ref={ref} className="relative shrink-0">
      <Button
        className="h-14 w-full gap-2 rounded-2xl bg-primary px-6 text-base font-semibold text-primary-foreground hover:bg-primary/90 sm:w-auto"
        onClick={() => setOpen((v) => !v)}
      >
        <Plus className="h-5 w-5" /> Add new
      </Button>
      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-64 overflow-hidden rounded-2xl border bg-card p-1.5 shadow-luxe">
          <button
            type="button"
            onClick={() => {
              onAddCategory();
              setOpen(false);
            }}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-medium hover:bg-muted/50"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <FolderPlus className="h-5 w-5" />
            </span>
            Category
          </button>
          <button
            type="button"
            disabled={!hasCategories}
            onClick={() => {
              onAddService();
              setOpen(false);
            }}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-medium hover:bg-muted/50 disabled:opacity-50"
            title={hasCategories ? "" : "Create a category first"}
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Plus className="h-5 w-5" />
            </span>
            Service
          </button>
          <button
            type="button"
            onClick={() => {
              onAddLimited();
              setOpen(false);
            }}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-medium text-rose-700 hover:bg-rose-50"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-rose-100 text-rose-600">
              <Star className="h-5 w-5" />
            </span>
            Limited-time category
          </button>
        </div>
      )}
    </div>
  );
}

function ServicesPage() {
  const fetchCats = useServerFn(getMyCategories);
  const fetchTreats = useServerFn(getMyTreatments);
  const createCat = useServerFn(createCategory);
  const updateCat = useServerFn(updateCategory);
  const removeCat = useServerFn(deleteCategory);
  const createTreat = useServerFn(createTreatment);
  const patchTreat = useServerFn(updateTreatment);
  const setConsents = useServerFn(setTreatmentConsents);
  const setAftercareTpls = useServerFn(setTreatmentAftercareIds);
  const saveLocPricing = useServerFn(setTreatmentLocationPricing);
  const removeTreat = useServerFn(deleteTreatment);
  const reorderCats = useServerFn(reorderCategories);
  const reorderTreats = useServerFn(reorderTreatments);


  const cats = useQuery({ queryKey: ["my-categories"], queryFn: () => fetchCats() });
  const treats = useQuery({ queryKey: ["my-treatments"], queryFn: () => fetchTreats() });

  const { roots, uncategorised } = useMemo(
    () => buildTree((cats.data ?? []) as Cat[], (treats.data ?? []) as Treat[]),
    [cats.data, treats.data],
  );
  const picker = useMemo(() => flattenForPicker(roots), [roots]);

  
  const [search, setSearch] = useState("");
  const [catDialog, setCatDialog] = useState<
    { mode: "create" | "edit"; parentId: string | null; cat?: Cat; limited?: boolean } | null
  >(null);
  const [svcDialog, setSvcDialog] = useState<{ defaultCatId: string | null } | null>(null);
  const [moveTreatState, setMoveTreatState] = useState<Treat | null>(null);
  const [moveCatState, setMoveCatState] = useState<Cat | null>(null);
  const [reorderOpen, setReorderOpen] = useState(false);






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

  async function moveCat(siblings: Cat[], id: string, dir: -1 | 1) {
    const idx = siblings.findIndex((s) => s.id === id);
    const swap = idx + dir;
    if (idx < 0 || swap < 0 || swap >= siblings.length) return;
    const next = siblings.slice();
    [next[idx], next[swap]] = [next[swap], next[idx]];
    try {
      await reorderCats({ data: { ids: next.map((s) => s.id) } });
      cats.refetch();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function moveTreat(siblings: Treat[], id: string, dir: -1 | 1) {
    const idx = siblings.findIndex((s) => s.id === id);
    const swap = idx + dir;
    if (idx < 0 || swap < 0 || swap >= siblings.length) return;
    const next = siblings.slice();
    [next[idx], next[swap]] = [next[swap], next[idx]];
    try {
      await reorderTreats({ data: { ids: next.map((s) => s.id) } });
      treats.refetch();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function reorderTreatsByIds(ids: string[]) {
    try {
      await reorderTreats({ data: { ids } });
      treats.refetch();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function reorderCatsByIds(ids: string[]) {
    try {
      await reorderCats({ data: { ids } });
      toast.success("Category order saved");
      cats.refetch();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function moveTreatToCategory(treatId: string, categoryId: string | null) {
    try {
      await patchTreat({ data: { id: treatId, category_id: categoryId } });
      toast.success("Service moved");
      setMoveTreatState(null);
      treats.refetch();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function moveCatToParent(catId: string, parentId: string | null) {
    try {
      await updateCat({ data: { id: catId, parent_id: parentId } });
      toast.success("Category moved");
      setMoveCatState(null);
      cats.refetch();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }



  return (
    <div className="services-page font-body space-y-6">
      <div className="flex flex-col gap-1">
        <h1 className="font-display text-3xl font-semibold tracking-tight text-foreground">Services</h1>
        <p className="text-base text-muted-foreground">
          Build your treatment menu. Patients see the same categories and services on your booking page.
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search services or categories…"
            className="h-14 rounded-2xl pl-12 text-base"
          />
        </div>
        <Button
          variant="outline"
          className="h-14 rounded-2xl px-5 text-base"
          onClick={() => setReorderOpen(true)}
          disabled={roots.length < 2}
        >
          <ListOrdered className="mr-2 h-5 w-5" /> Rearrange
        </Button>
        <AddMenu
          hasCategories={picker.length > 0}
          onAddCategory={() => setCatDialog({ mode: "create", parentId: null })}
          onAddService={() => setSvcDialog({ defaultCatId: null })}
          onAddLimited={() => setCatDialog({ mode: "create", parentId: null, limited: true })}
        />
      </div>


      <div className="grid min-w-0 grid-cols-1 gap-4 md:grid-cols-2">
        <FavouritesCard treatments={(treats.data ?? []) as Treat[]} />
        <PrescribingClinicCard />
      </div>

      {cats.isLoading || treats.isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="h-48 animate-pulse bg-muted/40" />
          ))}
        </div>
      ) : roots.length === 0 && uncategorised.length === 0 ? (
        <Card className="rounded-3xl border-dashed">
          <CardContent className="flex flex-col items-center justify-center gap-3 p-10 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <FolderPlus className="h-7 w-7" />
            </div>
            <div>
              <p className="font-display text-lg font-semibold text-foreground">No services yet</p>
              <p className="text-sm text-muted-foreground">
                Start by adding a category, then add services inside it.
              </p>
            </div>
            <Button
              className="mt-2 h-12 rounded-full bg-primary px-6 text-base font-semibold text-primary-foreground hover:bg-primary/90"
              onClick={() => setCatDialog({ mode: "create", parentId: null })}
            >
              <Plus className="mr-2 h-5 w-5" /> Add category
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {roots.map((node) => (
            <CategoryCard
              key={node.id}
              node={node}
              matchTreat={matchTreat}
              forceOpen={q.length > 0}
              onAddSub={(parentId) => setCatDialog({ mode: "create", parentId })}
              onEditCat={(c) => setCatDialog({ mode: "edit", parentId: c.parent_id, cat: c })}
              onDeleteCat={handleDeleteCat}
              onAddService={(catId) => setSvcDialog({ defaultCatId: catId })}
              onDeleteTreat={handleDeleteTreat}
              onReorderTreatsByIds={reorderTreatsByIds}
              onMoveTreatTo={(t) => setMoveTreatState(t)}
              onMoveCatTo={(c) => setMoveCatState(c)}
            />
          ))}
          {uncategorised.filter(matchTreat).length > 0 && (
            <CategoryCard
              node={{
                id: "__uncategorised__",
                parent_id: null,
                name: "Uncategorised",
                description: null,
                icon: null,
                sort_order: 9999,
                coming_soon_at: null,
                children: [],
                treatments: uncategorised.filter(matchTreat),
              }}
              isUncategorised
              matchTreat={matchTreat}
              forceOpen={q.length > 0}
              onAddSub={() => {}}
              onEditCat={() => {}}
              onDeleteCat={() => {}}
              onAddService={() => setSvcDialog({ defaultCatId: null })}
              onDeleteTreat={handleDeleteTreat}
              onReorderTreatsByIds={reorderTreatsByIds}
              onMoveTreatTo={(t) => setMoveTreatState(t)}
              onMoveCatTo={() => {}}
            />
          )}
        </div>
      )}




      <MoveTreatmentDialog
        treat={moveTreatState}
        categories={picker}
        onClose={() => setMoveTreatState(null)}
        onConfirm={(catId) => moveTreatState && moveTreatToCategory(moveTreatState.id, catId)}
      />
      <MoveCategoryDialog
        cat={moveCatState}
        allCategories={(cats.data ?? []) as Cat[]}
        onClose={() => setMoveCatState(null)}
        onConfirm={(parentId) => moveCatState && moveCatToParent(moveCatState.id, parentId)}
      />
      <ReorderCategoriesDialog
        open={reorderOpen}
        categories={roots}
        onClose={() => setReorderOpen(false)}
        onSave={async (ids) => {
          await reorderCatsByIds(ids);
          setReorderOpen(false);
        }}
      />




      <CategoryDialog
        state={catDialog}
        allCategories={(cats.data ?? []) as Cat[]}
        onClose={() => setCatDialog(null)}
        onSubmit={async (values) => {
          try {
            if (catDialog?.mode === "edit" && catDialog.cat) {
              await updateCat({ data: { id: catDialog.cat.id, ...values } });
              toast.success("Category updated");
            } else {
              const { parent_id: pickedParent, ...rest } = values;
              await createCat({
                data: { ...rest, parent_id: pickedParent ?? catDialog?.parentId ?? null },
              });
              toast.success("Category created");
            }
            setCatDialog(null);
            cats.refetch();
            treats.refetch();

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
            const { consent_ids, aftercare_template_ids, location_overrides, ...base } = values;
            const baseCreate = {
              name: base.name,
              duration: base.duration,
              price: base.price,
              description: base.description,
              category_id: base.category_id,
              session_count: base.session_count,
              allow_split_payment: base.allow_split_payment,
              rebook_reminder_days: base.rebook_reminder_days,
              topup_reminder_days: base.topup_reminder_days,
              session_interval_days: base.session_interval_days,
              color: base.color,
              picture_url: base.picture_url,
              payment_mode: base.payment_mode,
              deposit_amount: base.deposit_amount,
              active: base.active,
            };
            const created = (await createTreat({ data: baseCreate })) as { id: string };
            // patch extras not supported by createTreatment
            await patchTreat({
              data: {
                id: created.id,
                discount_percent: base.discount_percent,
                discount_label: base.discount_label,
                discount_show_was_now: base.discount_show_was_now,
                aftercare_html: base.aftercare_html,
                aftercare_delay_hours: base.aftercare_delay_hours,
                auto_send_medical_forms: base.auto_send_medical_forms,
                auto_send_aftercare: base.auto_send_aftercare,
                price_mode: base.price_mode,
                badge: base.badge,
              },
            });
            if (consent_ids && consent_ids.length > 0) {
              await setConsents({
                data: { treatmentId: created.id, consentTemplateIds: consent_ids },
              });
            }
            await setAftercareTpls({
              data: { treatment_id: created.id, template_ids: aftercare_template_ids ?? [] },
            });
            for (const o of location_overrides ?? []) {
              await saveLocPricing({
                data: {
                  treatment_id: created.id,
                  location_id: o.location_id,
                  available: o.available,
                  price_cents: o.price_cents,
                  duration_minutes: o.duration_minutes,
                },
              });
            }
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

function CategoryCard({
  node,
  matchTreat,
  forceOpen,
  onAddSub,
  onEditCat,
  onDeleteCat,
  onAddService,
  onDeleteTreat,
  onReorderTreatsByIds,
  onMoveTreatTo,
  onMoveCatTo,
  isUncategorised,
}: {
  node: CatNode;
  matchTreat: (t: Treat) => boolean;
  forceOpen?: boolean;
  onAddSub: (parentId: string) => void;
  onEditCat: (c: Cat) => void;
  onDeleteCat: (c: Cat) => void;
  onAddService: (catId: string) => void;
  onDeleteTreat: (t: Treat) => void;
  onReorderTreatsByIds: (ids: string[]) => void;
  onMoveTreatTo: (t: Treat) => void;
  onMoveCatTo: (c: Cat) => void;
  isUncategorised?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const expanded = forceOpen || open;
  const treatsHere = node.treatments.filter(matchTreat);
  const limited = (node as Cat & { is_limited?: boolean | null }).is_limited;
  const limitedEnds = (node as Cat & { limited_ends_at?: string | null }).limited_ends_at;

  return (
    <Card className="flex flex-col overflow-hidden rounded-3xl border bg-card shadow-sm transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between gap-2 border-b bg-muted/20 p-3">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="min-w-0 flex-1 text-left"
          aria-expanded={expanded}
        >
          <div className="flex items-center gap-1.5">
            <ChevronDown
              className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${expanded ? "rotate-180" : ""}`}
            />
            {node.icon && <span className="text-lg">{node.icon}</span>}
            <FitText className="font-display font-semibold text-foreground" max={16} min={10}>
              {node.name}
            </FitText>
          </div>
          {node.description && expanded && (
            <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{node.description}</p>
          )}
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            {node.coming_soon_at && new Date(node.coming_soon_at) > new Date() && (
              <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-800">
                Book from {new Date(node.coming_soon_at).toLocaleDateString(undefined, { day: "numeric", month: "short" })}
              </span>
            )}
            {limited && (
              <span className="inline-flex items-center rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-medium text-rose-800">
                {limitedEnds
                  ? (() => {
                      const ms = new Date(limitedEnds).getTime() - Date.now();
                      if (ms <= 0) return "Ended";
                      const mins = Math.floor(ms / 60000);
                      const days = Math.floor(mins / 1440);
                      const hours = Math.floor((mins % 1440) / 60);
                      return days > 0 ? `${days}d ${hours}h left` : hours > 0 ? `${hours}h left` : `${mins}m left`;
                    })()
                  : "Limited"}
              </span>
            )}
          </div>
        </button>
        {!isUncategorised && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted"
                aria-label="Category actions"
              >
                <MoreVertical className="h-4 w-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => onAddService(node.id)}>
                <Plus className="mr-2 h-4 w-4" /> Add service
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => onAddSub(node.id)}>
                <FolderPlus className="mr-2 h-4 w-4" /> Add subcategory
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => onMoveCatTo(node)}>
                <FolderPlus className="mr-2 h-4 w-4" /> Move to…
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => onEditCat(node)}>
                <Pencil className="mr-2 h-4 w-4" /> Edit
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => onDeleteCat(node)} className="text-destructive focus:text-destructive">
                <Trash2 className="mr-2 h-4 w-4" /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {expanded && (
      <div className="flex-1 p-3">
        {treatsHere.length === 0 && node.children.length === 0 && !isUncategorised && (
          <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
            <p className="text-sm text-muted-foreground">No services yet.</p>
            <Button size="sm" variant="outline" className="rounded-full" onClick={() => onAddService(node.id)}>
              <Plus className="mr-1 h-4 w-4" /> Add service
            </Button>
          </div>
        )}

        <ServiceList
          treats={treatsHere}
          reorderDisabled={forceOpen}
          onReorder={onReorderTreatsByIds}
          onDeleteTreat={onDeleteTreat}
          onMoveTreatTo={onMoveTreatTo}
        />

        {node.children.length > 0 && (
          <div className="mt-4 space-y-2">
            {node.children.map((child) => (
              <SubcategorySection
                key={child.id}
                child={child}
                forceOpen={forceOpen}
                matchTreat={matchTreat}
                onAddService={onAddService}
                onEditCat={onEditCat}
                onDeleteCat={onDeleteCat}
                onDeleteTreat={onDeleteTreat}
                onReorderTreatsByIds={onReorderTreatsByIds}
                onMoveTreatTo={onMoveTreatTo}
              />
            ))}
          </div>
        )}
      </div>
      )}

      {expanded && !isUncategorised && (
        <div className="flex gap-2 border-t bg-muted/10 p-3">
          <Button size="sm" variant="ghost" className="h-10 flex-1 rounded-xl text-sm" onClick={() => onAddService(node.id)}>
            <Plus className="mr-1 h-4 w-4" /> Service
          </Button>
          <Button size="sm" variant="ghost" className="h-10 flex-1 rounded-xl text-sm" onClick={() => onAddSub(node.id)}>
            <FolderPlus className="mr-1 h-4 w-4" /> Subcategory
          </Button>
        </div>
      )}
    </Card>
  );
}

function SubcategorySection({
  child,
  forceOpen,
  matchTreat,
  picker,
  onAddService,
  onEditCat,
  onDeleteCat,
  onDeleteTreat,
  onMoveTreat,
  onMoveTreatTo,
  onChangeTreatCategory,
}: {
  child: CatNode;
  forceOpen?: boolean;
  matchTreat: (t: Treat) => boolean;
  picker: { id: string; label: string; depth: number }[];
  onAddService: (catId: string) => void;
  onEditCat: (c: Cat) => void;
  onDeleteCat: (c: Cat) => void;
  onDeleteTreat: (t: Treat) => void;
  onMoveTreat: (siblings: Treat[], id: string, dir: -1 | 1) => void;
  onMoveTreatTo: (t: Treat) => void;
  onChangeTreatCategory: (treatId: string, categoryId: string | null) => void | Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const expanded = forceOpen || open;
  const treats = child.treatments.filter(matchTreat);

  return (
    <Collapsible open={expanded} onOpenChange={setOpen} className="rounded-2xl border bg-muted/20">
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className="flex w-full items-center justify-between gap-2 p-3 text-left"
          aria-expanded={expanded}
        >
          <div className="flex min-w-0 items-center gap-1.5">
            <ChevronDown
              className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${expanded ? "rotate-180" : ""}`}
            />
            {child.icon && <span className="text-base">{child.icon}</span>}
            <FitText className="font-display font-semibold text-foreground" max={14} min={10}>
              {child.name}
            </FitText>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                onClick={(e) => e.stopPropagation()}
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted"
                aria-label="Subcategory actions"
              >
                <MoreVertical className="h-4 w-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => onAddService(child.id)}>
                <Plus className="mr-2 h-4 w-4" /> Add service
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => onEditCat(child)}>
                <Pencil className="mr-2 h-4 w-4" /> Edit
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => onDeleteCat(child)} className="text-destructive focus:text-destructive">
                <Trash2 className="mr-2 h-4 w-4" /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="px-3 pb-3">
          {treats.length === 0 ? (
            <p className="py-2 text-center text-xs text-muted-foreground">No services yet.</p>
          ) : (
            <ServiceList
              treats={treats}
              reorderDisabled={forceOpen}
              onReorder={onReorderTreatsByIds}
              onDeleteTreat={onDeleteTreat}
              onMoveTreatTo={onMoveTreatTo}
            />
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

function ServiceList({
  treats,
  reorderDisabled,
  onReorder,
  onDeleteTreat,
  onMoveTreatTo,
}: {
  treats: Treat[];
  reorderDisabled?: boolean;
  onReorder: (ids: string[]) => void;
  onDeleteTreat: (t: Treat) => void;
  onMoveTreatTo: (t: Treat) => void;
}) {
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);

  function handleDrop(targetId: string) {
    const from = treats.findIndex((t) => t.id === dragId);
    const to = treats.findIndex((t) => t.id === targetId);
    setDragId(null);
    setOverId(null);
    if (!dragId || dragId === targetId || from < 0 || to < 0) return;
    const next = treats.slice();
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    onReorder(next.map((t) => t.id));
  }

  return (
    <div className="space-y-2">
      {treats.map((t) => (
        <ServiceCard
          key={t.id}
          treat={t}
          draggable={!reorderDisabled}
          dragging={dragId === t.id}
          dropTarget={overId === t.id && dragId !== t.id}
          onDragStart={() => setDragId(t.id)}
          onDragOver={(e) => {
            e.preventDefault();
            setOverId(t.id);
          }}
          onDragLeave={() => setOverId((v) => (v === t.id ? null : v))}
          onDrop={() => handleDrop(t.id)}
          onDragEnd={() => {
            setDragId(null);
            setOverId(null);
          }}
          onDelete={() => onDeleteTreat(t)}
          onMoveTo={() => onMoveTreatTo(t)}
        />
      ))}
    </div>
  );
}

function ServiceCard({
  treat,
  draggable,
  dragging,
  dropTarget,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
  onDragEnd,
  onDelete,
  onMoveTo,
}: {
  treat: Treat;
  draggable?: boolean;
  dragging?: boolean;
  dropTarget?: boolean;
  onDragStart?: () => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDragLeave?: () => void;
  onDrop?: () => void;
  onDragEnd?: () => void;
  onDelete: () => void;
  onMoveTo?: () => void;
}) {
  return (
    <div
      draggable={draggable}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      className={`group flex items-center gap-2 rounded-xl border bg-background px-2.5 py-2 transition-colors hover:border-primary/30 ${
        dropTarget ? "border-primary" : ""
      } ${dragging ? "opacity-50" : ""}`}
    >
      {draggable && (
        <GripVertical
          className="h-4 w-4 shrink-0 cursor-grab text-muted-foreground/60 active:cursor-grabbing"
          aria-label="Drag to reorder"
        />
      )}
      <div className="flex min-w-0 flex-1 items-center gap-2.5">
        <span
          className="h-2.5 w-2.5 shrink-0 rounded-full"
          style={{ backgroundColor: treat.color || "hsl(var(--muted-foreground))" }}
          aria-label="Calendar colour"
        />
        <div className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-2">
          <FitText className="font-display font-semibold text-foreground" max={14} min={8}>
            {treat.name}
          </FitText>

          <p className="text-xs font-medium text-primary">
            £{Number(treat.price ?? 0).toFixed(2)}
            <span className="mx-1 text-muted-foreground">·</span>
            <span className="text-muted-foreground">{treat.duration} min</span>
          </p>
        </div>
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted"
            aria-label="Service actions"
          >
            <MoreVertical className="h-4 w-4" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem asChild>
            <Link to="/dashboard/treatments" search={{ edit: treat.id, back: "services" }}>
              <Pencil className="mr-2 h-4 w-4" /> Edit
            </Link>
          </DropdownMenuItem>
          {onMoveTo && (
            <DropdownMenuItem onSelect={() => onMoveTo()}>
              <FolderPlus className="mr-2 h-4 w-4" /> Move to category…
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={onDelete} className="text-destructive focus:text-destructive">
            <Trash2 className="mr-2 h-4 w-4" /> Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}



function ReorderCategoriesDialog({
  open,
  categories,
  onClose,
  onSave,
}: {
  open: boolean;
  categories: CatNode[];
  onClose: () => void;
  onSave: (ids: string[]) => void | Promise<void>;
}) {
  const [items, setItems] = useState<CatNode[]>(categories);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setItems(categories);
  }, [open, categories]);

  function handleDrop(targetId: string) {
    if (!dragId || dragId === targetId) return;
    const from = items.findIndex((c) => c.id === dragId);
    const to = items.findIndex((c) => c.id === targetId);
    if (from < 0 || to < 0) return;
    const next = items.slice();
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    setItems(next);
    setDragId(null);
    setOverId(null);
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display">Rearrange categories</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Drag categories into the order you want them on your booking page.
        </p>
        <div className="max-h-[50vh] space-y-2 overflow-y-auto py-1">
          {items.map((c) => (
            <div
              key={c.id}
              draggable
              onDragStart={() => setDragId(c.id)}
              onDragOver={(e) => {
                e.preventDefault();
                setOverId(c.id);
              }}
              onDragLeave={() => setOverId((v) => (v === c.id ? null : v))}
              onDrop={() => handleDrop(c.id)}
              onDragEnd={() => {
                setDragId(null);
                setOverId(null);
              }}
              className={`flex cursor-grab items-center gap-3 rounded-2xl border bg-background p-3 transition-colors active:cursor-grabbing ${
                overId === c.id && dragId !== c.id ? "border-primary" : ""
              } ${dragId === c.id ? "opacity-50" : ""}`}
            >
              <GripVertical className="h-5 w-5 shrink-0 text-muted-foreground" />
              {c.icon && <span className="text-lg">{c.icon}</span>}
              <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
                {c.name}
              </span>
              <span className="shrink-0 text-xs text-muted-foreground">
                {c.treatments.length} service{c.treatments.length === 1 ? "" : "s"}
              </span>
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button
            disabled={saving}
            onClick={async () => {
              setSaving(true);
              try {
                await onSave(items.map((c) => c.id));
              } finally {
                setSaving(false);
              }
            }}
          >
            {saving ? "Saving…" : "Save order"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MoveTreatmentDialog({
  treat,
  categories,
  onClose,
  onConfirm,
}: {
  treat: Treat | null;
  categories: { id: string; label: string; depth: number }[];
  onClose: () => void;
  onConfirm: (categoryId: string | null) => void;
}) {
  const open = !!treat;
  const [target, setTarget] = useState<string>("__none__");
  useMemo(() => {
    if (open) setTarget(treat?.category_id ?? "__none__");
  }, [open, treat]);
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Move “{treat?.name}”</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          <Label>Choose a category or subcategory</Label>
          <Select value={target} onValueChange={setTarget}>
            <SelectTrigger>
              <SelectValue />
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
          <p className="text-[11px] text-muted-foreground">
            Tip: subcategories appear indented. Pick any level.
          </p>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={() => onConfirm(target === "__none__" ? null : target)}>Move</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MoveCategoryDialog({
  cat,
  allCategories,
  onClose,
  onConfirm,
}: {
  cat: Cat | null;
  allCategories: Cat[];
  onClose: () => void;
  onConfirm: (parentId: string | null) => void;
}) {
  const open = !!cat;
  const [target, setTarget] = useState<string>("__none__");
  useMemo(() => {
    if (open) setTarget(cat?.parent_id ?? "__none__");
  }, [open, cat]);
  // Eligible parents: top-level categories that are not this category itself.
  const options = allCategories.filter(
    (c) => !c.parent_id && (!cat || c.id !== cat.id),
  );
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Move “{cat?.name}”</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          <Label>Move under</Label>
          <Select value={target} onValueChange={setTarget}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">Top-level (no parent)</SelectItem>
              {options.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.icon ? `${c.icon} ` : ""}{c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-[11px] text-muted-foreground">
            Pick a parent to make this a subcategory, or keep it top-level.
          </p>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={() => onConfirm(target === "__none__" ? null : target)}>Move</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


function toLocalDT(iso: string | null | undefined) {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function fromLocalDT(v: string) {
  if (!v.trim()) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function CategoryDialog({
  state,
  allCategories,
  onClose,
  onSubmit,
}: {
  state: { mode: "create" | "edit"; parentId: string | null; cat?: Cat; limited?: boolean } | null;
  allCategories: Cat[];
  onClose: () => void;
  onSubmit: (v: {
    name: string;
    description?: string | null;
    icon?: string | null;
    coming_soon_at?: string | null;
    parent_id?: string | null;
    is_limited?: boolean;
    limited_starts_at?: string | null;
    limited_ends_at?: string | null;
  }) => Promise<void>;
}) {
  const open = !!state;
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [icon, setIcon] = useState("");
  const [comingSoon, setComingSoon] = useState("");
  const [parentId, setParentId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [limited, setLimited] = useState(false);
  const [limStart, setLimStart] = useState("");
  const [limEnd, setLimEnd] = useState("");

  useEffect(() => {
    if (open) {
      setName(state?.cat?.name ?? "");
      setDescription(state?.cat?.description ?? "");
      setIcon(state?.cat?.icon ?? "");
      setComingSoon(state?.cat?.coming_soon_at ? state.cat.coming_soon_at.slice(0, 10) : "");
      setParentId(state?.cat ? state.cat.parent_id : state?.parentId ?? null);
      const c = state?.cat as (Cat & { is_limited?: boolean | null; limited_starts_at?: string | null; limited_ends_at?: string | null }) | undefined;
      setLimited(Boolean(c?.is_limited) || Boolean(state?.limited));
      setLimStart(toLocalDT(c?.limited_starts_at));
      setLimEnd(toLocalDT(c?.limited_ends_at));
    }
  }, [open, state]);

  // Categories eligible as parent: top-level only, exclude self
  const parentOptions = useMemo(
    () =>
      allCategories.filter(
        (c) => !c.parent_id && (!state?.cat || c.id !== state.cat.id),
      ),
    [allCategories, state],
  );


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
            <Label htmlFor="c-parent">Parent category</Label>
            <Select
              value={parentId ?? "__none__"}
              onValueChange={(v) => setParentId(v === "__none__" ? null : v)}
            >
              <SelectTrigger id="c-parent">
                <SelectValue placeholder="Top-level category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Top-level (no parent)</SelectItem>
                {parentOptions.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.icon ? `${c.icon} ` : ""}
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground">
              Pick a parent to make this a subcategory, or keep it top-level. You can move it to a different parent at any time.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="c-desc">Description</Label>
            <Textarea
              id="c-desc"
              rows={8}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Write a description about your services"
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
          <div className="space-y-1.5 rounded-lg border border-dashed border-amber-300 bg-amber-50/50 p-3">
            <Label htmlFor="c-soon" className="text-amber-900">Book from date (optional)</Label>
            <Input
              id="c-soon"
              type="date"
              value={comingSoon}
              onChange={(e) => setComingSoon(e.target.value)}
            />
            <p className="text-[11px] text-amber-800/80">
              Before this date the category shows a "Book from [date]" badge and cannot be booked. After it passes, it becomes bookable automatically. Leave blank to disable.
            </p>
          </div>
          <div className="space-y-3 rounded-lg border border-dashed border-rose-300 bg-rose-50/50 p-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <Label className="text-rose-900">Limited time category</Label>
                <p className="text-[11px] text-rose-800/80">
                  Give this category a countdown (e.g. "Autumn offers"). Everything inside it — treatments or packages —
                  shows the timer and the whole category disappears from your booking page when it ends.
                </p>
              </div>
              <Switch checked={limited} onCheckedChange={setLimited} />
            </div>
            {limited && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Starts (optional)</Label>
                  <Input type="datetime-local" value={limStart} onChange={(e) => setLimStart(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Ends</Label>
                  <Input type="datetime-local" value={limEnd} onChange={(e) => setLimEnd(e.target.value)} />
                </div>
              </div>
            )}
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
                coming_soon_at: comingSoon ? new Date(comingSoon + "T00:00:00").toISOString() : null,
                parent_id: parentId,
                is_limited: limited,
                limited_starts_at: limited ? fromLocalDT(limStart) : null,
                limited_ends_at: limited ? fromLocalDT(limEnd) : null,
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
    session_count?: number;
    allow_split_payment?: boolean;
    rebook_reminder_days?: number | null;
    topup_reminder_days?: number | null;
    session_interval_days?: number | null;
    color?: string | null;
    active?: boolean;
    picture_url?: string;
    payment_mode?: "full" | "deposit" | "pay_in_clinic";
    deposit_amount?: number;
    consent_ids?: string[];
    aftercare_template_ids?: string[];
    auto_send_medical_forms?: boolean;
    aftercare_html?: string | null;
    aftercare_delay_hours?: number;
    auto_send_aftercare?: boolean;
    discount_percent?: number | null;
    discount_label?: string | null;
    discount_show_was_now?: boolean;
    price_mode?: "fixed" | "from" | "poa" | "free";
    badge?: "recommended" | "popular" | "new" | "bestseller" | null;
    location_overrides?: { location_id: string; available: boolean; price_cents: number | null; duration_minutes: number | null }[];
  }) => Promise<void>;
}) {
  const open = !!state;
  const fetchProfile = useServerFn(getMyProfile);
  const fetchConsents = useServerFn(listMyConsentTemplates);
  const fetchAftercare = useServerFn(listAftercareTemplates);
  const fetchLocations = useServerFn(listMyLocations);
  const profile = useQuery({ queryKey: ["my-profile"], queryFn: () => fetchProfile() });
  const consents = useQuery({
    queryKey: ["my-consent-templates"],
    queryFn: () => fetchConsents(),
  });
  const aftercareTpls = useQuery({
    queryKey: ["my-aftercare-templates"],
    queryFn: () => fetchAftercare(),
  });
  const locations = useQuery({
    queryKey: ["my-locations"],
    queryFn: () => fetchLocations(),
  });
  const profileId = (profile.data as { id?: string } | undefined)?.id ?? "";
  const consentList = (consents.data ?? []) as { id: string; name: string; is_system: boolean }[];
  const aftercareList = (aftercareTpls.data ?? []) as { id: string; name: string; delay_hours: number }[];
  const locationList = (locations.data ?? []) as { id: string; name: string }[];

  const [name, setName] = useState("");
  const [duration, setDuration] = useState(30);
  const [price, setPrice] = useState(0);
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState<string>("__none__");
  const [sessionCount, setSessionCount] = useState(1);
  const [allowSplit, setAllowSplit] = useState(false);
  const [rebookDays, setRebookDays] = useState<string>("");
  const [topupDays, setTopupDays] = useState<string>("");
  const [intervalDays, setIntervalDays] = useState<string>("");
  const [intervalUnit, setIntervalUnit] = useState<"days" | "weeks">("weeks");
  const [color, setColor] = useState<string>(PRESET_COLORS[0]);
  const [active, setActive] = useState(true);
  const [pictureUrl, setPictureUrl] = useState<string | null>(null);
  const [paymentMode, setPaymentMode] = useState<"full" | "deposit" | "pay_in_clinic">("full");
  const [depositAmount, setDepositAmount] = useState<string>("");
  const [consentIds, setConsentIds] = useState<string[]>([]);
  const [aftercareIds, setAftercareIds] = useState<string[]>([]);
  const [autoSendForms, setAutoSendForms] = useState(true);
  const [aftercareHtml, setAftercareHtml] = useState("");
  const [aftercareDelay, setAftercareDelay] = useState(2);
  const [autoSendAftercare, setAutoSendAftercare] = useState(true);
  const [discountPercent, setDiscountPercent] = useState<string>("");
  const [discountLabel, setDiscountLabel] = useState("");
  const [discountShowWasNow, setDiscountShowWasNow] = useState(true);
  const [priceMode, setPriceMode] = useState<"fixed" | "from" | "poa" | "free">("fixed");
  const [badge, setBadge] = useState<"none" | "recommended" | "popular" | "new" | "bestseller">("none");
  // Per-location availability + optional price/duration override (in £ and minutes — strings for empty inputs)
  type LocOverride = { available: boolean; price: string; duration: string };
  const [locOverrides, setLocOverrides] = useState<Record<string, LocOverride>>({});
  const [saving, setSaving] = useState(false);

  useMemo(() => {
    if (open) {
      setName("");
      setDuration(30);
      setPrice(0);
      setDescription("");
      setCategoryId(state?.defaultCatId ?? "__none__");
      setSessionCount(1);
      setAllowSplit(false);
      setRebookDays("");
      setIntervalDays("");
      setIntervalUnit("weeks");
      setColor(PRESET_COLORS[Math.floor(Math.random() * PRESET_COLORS.length)]);
      setActive(true);
      setPictureUrl(null);
      setPaymentMode("full");
      setDepositAmount("");
      setConsentIds([]);
      setAftercareIds([]);
      setAutoSendForms(true);
      setAftercareHtml("");
      setAftercareDelay(2);
      setAutoSendAftercare(true);
      setDiscountPercent("");
      setDiscountLabel("");
      setDiscountShowWasNow(true);
      setPriceMode("fixed");
      setBadge("none");
      setLocOverrides({});
    }
  }, [open, state]);

  function toggleConsent(id: string) {
    setConsentIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add service</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {/* Quick toggle rows at the top */}
          <div className="grid grid-cols-2 gap-2 rounded-lg border bg-muted/30 p-2">
            <label className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-xs">
              <span className="font-medium">Visible to patients</span>
              <Switch checked={active} onCheckedChange={setActive} />
            </label>
            <label className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-xs">
              <span className="font-medium">Auto-send medical forms</span>
              <Switch checked={autoSendForms} onCheckedChange={setAutoSendForms} />
            </label>
            <label className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-xs">
              <span className="font-medium">Auto-send aftercare</span>
              <Switch checked={autoSendAftercare} onCheckedChange={setAutoSendAftercare} />
            </label>
            <label className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-xs">
              <span className="font-medium">Show was/now price</span>
              <Switch checked={discountShowWasNow} onCheckedChange={setDiscountShowWasNow} />
            </label>
          </div>

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
              rows={10}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the service in as much detail as you'd like"
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

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Price display</Label>
              <Select value={priceMode} onValueChange={(v) => setPriceMode(v as typeof priceMode)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="fixed">Fixed price</SelectItem>
                  <SelectItem value="from">From £…</SelectItem>
                  <SelectItem value="poa">POA (price on application)</SelectItem>
                  <SelectItem value="free">Free</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Highlight badge</Label>
              <Select value={badge} onValueChange={(v) => setBadge(v as typeof badge)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No badge</SelectItem>
                  <SelectItem value="recommended">Recommended</SelectItem>
                  <SelectItem value="popular">Most popular</SelectItem>
                  <SelectItem value="new">New</SelectItem>
                  <SelectItem value="bestseller">Bestseller</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {profileId && (
            <ImageUploader
              label="Service picture (optional)"
              value={pictureUrl}
              onChange={setPictureUrl}
              profileId={profileId}
              folder="treatments"
              previewClass="mt-2 h-24 w-full object-cover rounded-md"
            />
          )}

          <div className="rounded-lg border bg-muted/30 p-3 space-y-3">
            <div className="text-sm font-semibold">Sessions &amp; payment</div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="s-sess">Sessions included</Label>
                <Input
                  id="s-sess"
                  type="number"
                  min={1}
                  value={sessionCount}
                  onChange={(e) => setSessionCount(Math.max(1, Number(e.target.value) || 1))}
                />
                <p className="text-[11px] text-muted-foreground">Shown to patients e.g. "3 sessions included".</p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="s-rebook">Rebook reminder — days after</Label>
                <Input
                  id="s-rebook"
                  type="number"
                  min={0}
                  placeholder="e.g. 90"
                  value={rebookDays}
                  onChange={(e) => setRebookDays(e.target.value)}
                />
                <p className="text-[11px] text-muted-foreground">"Time to rebook" email sent this many days after their appointment.</p>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="s-topup">Top-up reminder — days after (optional)</Label>
              <Input
                id="s-topup"
                type="number"
                min={0}
                placeholder="e.g. 30"
                value={topupDays}
                onChange={(e) => setTopupDays(e.target.value)}
              />
              <p className="text-[11px] text-muted-foreground">Shorter reminder before a full rebook (e.g. filler top-up). Leave blank to skip.</p>
            </div>
            <div className={`space-y-1.5 ${sessionCount > 1 ? "" : "opacity-60"}`}>
              <Label htmlFor="s-int">How far apart should sessions be?</Label>
              <div className="flex gap-2">
                <Input
                  id="s-int"
                  type="number"
                  min={1}
                  placeholder={intervalUnit === "weeks" ? "e.g. 2" : "e.g. 14"}
                  value={intervalDays}
                  onChange={(e) => setIntervalDays(e.target.value)}
                  className="flex-1"
                  disabled={sessionCount < 2}
                />
                <div className="inline-flex rounded-md border bg-background p-0.5">
                  <button
                    type="button"
                    onClick={() => setIntervalUnit("days")}
                    disabled={sessionCount < 2}
                    className={`px-3 py-1 text-xs rounded ${intervalUnit === "days" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
                  >
                    Days
                  </button>
                  <button
                    type="button"
                    onClick={() => setIntervalUnit("weeks")}
                    disabled={sessionCount < 2}
                    className={`px-3 py-1 text-xs rounded ${intervalUnit === "weeks" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
                  >
                    Weeks
                  </button>
                </div>
              </div>
              <p className="text-[11px] text-muted-foreground">
                {sessionCount > 1
                  ? "Recommended spacing between each session — shown to patients."
                  : "Set Sessions included above to 2+ to enable. Spacing is shown to patients."}
              </p>
            </div>
            {sessionCount > 1 && (
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4"
                  checked={allowSplit}
                  onChange={(e) => setAllowSplit(e.target.checked)}
                />
                <span>
                  Allow split payment per session
                  <span className="block text-[11px] text-muted-foreground">
                    Patients can pay the per-session amount at each appointment instead of paying in full.
                  </span>
                </span>
              </label>
            )}
            {(profile.data as { payment_deposit_enabled?: boolean } | undefined)?.payment_deposit_enabled && (
              <div className="pt-2 border-t space-y-1.5">
                <Label htmlFor="s-dep">Deposit override (£) <span className="text-[11px] font-normal text-muted-foreground">— optional, leave blank to use default</span></Label>
                <Input
                  id="s-dep"
                  type="number"
                  min={0}
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                  placeholder={`Default £${(((profile.data as { deposit_amount_cents?: number } | undefined)?.deposit_amount_cents ?? 0) / 100).toFixed(2)}`}
                />
                <p className="text-[11px] text-muted-foreground">
                  Payment methods (full / deposit / Klarna / Clearpay / pay in clinic) are managed in <a href="/dashboard/settings" className="underline">Booking settings</a>. Klarna &amp; Clearpay always charge the full amount at booking.
                </p>
              </div>
            )}
          </div>

          <div className="rounded-lg border p-3 space-y-2">
            <Label className="m-0 text-sm font-semibold">Consent forms to send on booking</Label>
            <ConsentPicker
              all={consentList}
              selected={consentIds}
              onToggle={toggleConsent}
            />
          </div>


          <div className="rounded-lg border p-3 space-y-3">
            <Label className="m-0 text-sm font-semibold">Discount (optional)</Label>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">% off</Label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  placeholder="e.g. 15"
                  value={discountPercent}
                  onChange={(e) => setDiscountPercent(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Label</Label>
                <Input
                  placeholder="e.g. Spring offer"
                  value={discountLabel}
                  onChange={(e) => setDiscountLabel(e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="rounded-lg border p-3 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <Label className="m-0 text-sm font-semibold">Aftercare</Label>
              <Link to="/dashboard/aftercare" className="text-xs underline text-muted-foreground">
                Manage templates
              </Link>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Attach aftercare templates</Label>
              {aftercareList.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  No templates yet. Create reusable aftercare messages on the Aftercare page.
                </p>
              ) : (
                <AftercarePicker
                  items={aftercareList}
                  selected={aftercareIds}
                  onToggle={(id) =>
                    setAftercareIds((prev) =>
                      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
                    )
                  }
                />
              )}
            </div>
            <details>
              <summary className="cursor-pointer text-xs font-medium text-muted-foreground">
                Custom one-off aftercare for this service (optional)
              </summary>
              <div className="mt-2 space-y-2">
                <Textarea
                  rows={3}
                  value={aftercareHtml}
                  onChange={(e) => setAftercareHtml(e.target.value)}
                  placeholder="Overrides templates for this service only."
                />
                <div className="space-y-1.5 max-w-[180px]">
                  <Label className="text-xs text-muted-foreground">Send after (hours)</Label>
                  <Input
                    type="number"
                    min={0}
                    value={aftercareDelay}
                    onChange={(e) => setAftercareDelay(Math.max(0, Number(e.target.value) || 0))}
                  />
                </div>
              </div>
            </details>
          </div>

          {locationList.length > 0 && (
            <div className="rounded-lg border p-3 space-y-3">
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <Label className="m-0 text-sm font-semibold">Locations & pricing</Label>
              </div>
              <p className="text-xs text-muted-foreground">
                Tick locations where this service is offered. Leave price/duration blank to use the defaults above.
              </p>
              <div className="space-y-2">
                {locationList.map((loc) => {
                  const ov = locOverrides[loc.id] ?? { available: true, price: "", duration: "" };
                  const update = (patch: Partial<LocOverride>) =>
                    setLocOverrides((prev) => ({ ...prev, [loc.id]: { ...ov, ...patch } }));
                  return (
                    <div key={loc.id} className="flex flex-wrap items-center gap-2 rounded-md border p-2">
                      <label className="flex items-center gap-2 text-sm flex-1 min-w-[140px]">
                        <input
                          type="checkbox"
                          checked={ov.available}
                          onChange={(e) => update({ available: e.target.checked })}
                        />
                        <span className="font-medium">{loc.name}</span>
                      </label>
                      <div className="flex items-center gap-1">
                        <span className="text-xs text-muted-foreground">£</span>
                        <Input
                          className="w-20 h-8"
                          type="number"
                          min={0}
                          placeholder={String(price)}
                          value={ov.price}
                          disabled={!ov.available}
                          onChange={(e) => update({ price: e.target.value })}
                        />
                      </div>
                      <div className="flex items-center gap-1">
                        <Input
                          className="w-20 h-8"
                          type="number"
                          min={0}
                          placeholder={String(duration)}
                          value={ov.duration}
                          disabled={!ov.available}
                          onChange={(e) => update({ duration: e.target.value })}
                        />
                        <span className="text-xs text-muted-foreground">min</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}


          <div className="space-y-1.5">
            <Label>Calendar colour</Label>
            <div className="flex flex-wrap gap-2">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={`h-8 w-8 rounded-full border-2 transition ${color === c ? "ring-2 ring-offset-2 ring-foreground border-white" : "border-white/60"}`}
                  style={{ backgroundColor: c }}
                  aria-label={`Pick ${c}`}
                />
              ))}
            </div>
            <p className="text-[11px] text-muted-foreground">Appointments for this service appear in this colour on your calendar.</p>
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
                duration,
                price,
                description: description.trim() || undefined,
                category_id: categoryId === "__none__" ? null : categoryId,
                session_count: sessionCount,
                allow_split_payment: sessionCount > 1 ? allowSplit : false,
                rebook_reminder_days: rebookDays.trim() ? Number(rebookDays) : null,
                topup_reminder_days: topupDays.trim() ? Number(topupDays) : null,
                session_interval_days: sessionCount > 1 && intervalDays.trim() ? Number(intervalDays) * (intervalUnit === "weeks" ? 7 : 1) : null,
                color,
                active,
                picture_url: pictureUrl ?? undefined,
                payment_mode: (profile.data as { payment_deposit_enabled?: boolean } | undefined)?.payment_deposit_enabled ? "deposit" : "full",
                deposit_amount: depositAmount.trim() ? Number(depositAmount) : undefined,
                consent_ids: consentIds,
                aftercare_template_ids: aftercareIds,
                auto_send_medical_forms: autoSendForms,
                aftercare_html: aftercareHtml.trim() || null,
                aftercare_delay_hours: aftercareDelay,
                auto_send_aftercare: autoSendAftercare,
                discount_percent: discountPercent.trim() ? Number(discountPercent) : null,
                discount_label: discountLabel.trim() || null,
                discount_show_was_now: discountShowWasNow,
                price_mode: priceMode,
                badge: badge === "none" ? null : badge,
                location_overrides: Object.entries(locOverrides).map(([location_id, ov]) => ({
                  location_id,
                  available: ov.available,
                  price_cents: ov.price.trim() ? Math.round(Number(ov.price) * 100) : null,
                  duration_minutes: ov.duration.trim() ? Number(ov.duration) : null,
                })),
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


function FavouritesCard({ treatments }: { treatments: Treat[] }) {
  const fetchProfile = useServerFn(getMyProfile);
  const saveProfile = useServerFn(updateProfile);
  const profile = useQuery({ queryKey: ["my-profile"], queryFn: () => fetchProfile() });
  const [picking, setPicking] = useState(false);
  const [pickerSearch, setPickerSearch] = useState("");
  const [titleDraft, setTitleDraft] = useState<string | null>(null);


  const p = profile.data as
    | {
        id: string;
        clinic_name: string;
        full_name: string | null;
        favourite_treatment_ids?: string[] | null;
        favourites_enabled?: boolean | null;
        favourites_custom_title?: string | null;
      }
    | null
    | undefined;

  if (!p) return null;

  const ids: string[] = (p.favourite_treatment_ids ?? []) as string[];
  const enabled = p.favourites_enabled ?? true;
  const customTitle = p.favourites_custom_title ?? "";
  const selected = ids
    .map((id) => treatments.find((t) => t.id === id))
    .filter((t): t is Treat => !!t);
  const available = treatments
    .filter((t) => !ids.includes(t.id))
    .filter((t) =>
      pickerSearch.trim() === "" ? true : t.name.toLowerCase().includes(pickerSearch.toLowerCase()),
    );

  async function save(next: Partial<{ favourite_treatment_ids: string[]; favourites_enabled: boolean; favourites_custom_title: string | null }>) {
    if (!p) return;
    try {
      await saveProfile({ data: { id: p.id, ...next } });
      profile.refetch();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  function move(idx: number, dir: -1 | 1) {
    const next = [...ids];
    const j = idx + dir;
    if (j < 0 || j >= next.length) return;
    [next[idx], next[j]] = [next[j], next[idx]];
    save({ favourite_treatment_ids: next });
  }

  const defaultTitle = `${(p.full_name || p.clinic_name) ?? "Our"}'s Favourite Treatments`;

  return (
    <Card className="min-w-0 max-w-full overflow-hidden rounded-2xl sm:rounded-3xl">
      <CardContent className="min-w-0 space-y-3 p-3 sm:space-y-4 sm:p-5">
        <div className="flex min-w-0 flex-col gap-3 sm:grid sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
          <div className="flex min-w-0 items-start gap-2.5 sm:gap-3">
            <div className="shrink-0 rounded-xl bg-amber-100 p-2 text-amber-600">
              <Star className="h-4 w-4 fill-amber-500 stroke-amber-600 sm:h-5 sm:w-5" />
            </div>
            <div className="min-w-0">
              <h2 className="truncate text-sm font-semibold sm:text-base">Favourite / Most popular</h2>
              <p className="line-clamp-2 text-[11px] leading-snug text-muted-foreground sm:text-xs">
                Featured on your booking page as <em>“{customTitle.trim() || defaultTitle}”</em>.
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center justify-between gap-2 sm:justify-end">
            <Label htmlFor="fav-enabled" className="text-[10px] sm:text-xs">Show</Label>
            <Switch id="fav-enabled" checked={enabled} onCheckedChange={(v) => save({ favourites_enabled: v })} />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-[10px] sm:text-xs">Custom heading (optional)</Label>
          <Input
            value={titleDraft ?? customTitle}
            onChange={(e) => setTitleDraft(e.target.value)}
            onBlur={() => {
              if (titleDraft !== null && titleDraft !== customTitle) {
                save({ favourites_custom_title: titleDraft.trim() ? titleDraft : null });
              }
              setTitleDraft(null);
            }}
            placeholder={defaultTitle}
            className="h-9 text-sm sm:h-10"
          />
        </div>

        {selected.length === 0 ? (
          <p className="rounded-lg border border-dashed bg-muted/40 p-3 text-center text-xs text-muted-foreground">
            No favourites picked yet.
          </p>
        ) : (
          <ul className="min-w-0 divide-y overflow-hidden rounded-lg border">
            {selected.map((t, idx) => (
              <li key={t.id} className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-2 p-2.5">
                <div className="flex min-w-0 flex-col gap-0.5 sm:flex-row sm:items-center sm:justify-between sm:gap-2">
                  <span className="truncate text-sm font-medium">{t.name}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">£{Number(t.price ?? 0).toFixed(2)}</span>
                </div>
                <div className="flex shrink-0 items-center justify-end gap-0.5">
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => move(idx, -1)} disabled={idx === 0}>
                    <ArrowUp className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => move(idx, 1)} disabled={idx === selected.length - 1}>
                    <ArrowDown className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 text-destructive"
                    onClick={() => save({ favourite_treatment_ids: ids.filter((x) => x !== t.id) })}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}

        <Button variant="outline" size="sm" onClick={() => setPicking((v) => !v)} disabled={treatments.length === 0}>
          <Plus className="mr-1 h-4 w-4" /> Add treatment
        </Button>

        {picking && (
          <div className="space-y-2 rounded-lg border bg-muted/30 p-3">
            <Input
              autoFocus
              value={pickerSearch}
              onChange={(e) => setPickerSearch(e.target.value)}
              placeholder="Search treatments…"
              className="h-9"
            />
            <div className="max-h-64 space-y-1 overflow-y-auto">
              {available.length === 0 ? (
                <p className="p-2 text-center text-xs text-muted-foreground">No more treatments to add.</p>
              ) : (
                available.map((t) => (
                  <button
                    key={t.id}
                    className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm hover:bg-background"
                    onClick={() => {
                      save({ favourite_treatment_ids: [...ids, t.id] });
                      setPickerSearch("");
                    }}
                  >
                    <span className="truncate">{t.name}</span>
                    <span className="ml-2 text-xs text-muted-foreground">£{Number(t.price ?? 0).toFixed(2)}</span>
                  </button>
                ))
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ConsentPicker({
  all,
  selected,
  onToggle,
}: {
  all: { id: string; name: string; is_system: boolean; treatment_type?: string | null }[];
  selected: string[];
  onToggle: (id: string) => void;
}) {
  const [q, setQ] = useState("");
  const query = q.trim().toLowerCase();
  const filtered = query
    ? all.filter(
        (t) =>
          t.name.toLowerCase().includes(query) ||
          (t.treatment_type ?? "").toLowerCase().includes(query),
      )
    : all;
  const selectedRows = all.filter((t) => selected.includes(t.id));

  if (all.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        No consent forms yet. Add them in Dashboard → Consent forms.
      </p>
    );
  }
  return (
    <div className="space-y-2">
      {selectedRows.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selectedRows.map((t) => (
            <span
              key={t.id}
              className="inline-flex items-center gap-1 rounded-full border bg-primary/10 px-2 py-1 text-xs text-primary"
            >
              {t.name}
              <button
                type="button"
                onClick={() => onToggle(t.id)}
                className="text-primary/70 hover:text-destructive"
                aria-label="Remove"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}
      <Input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search consent forms (Botox, lip filler, Sculptra…)"
        className="h-9 text-sm"
      />
      <div className="max-h-56 space-y-1 overflow-y-auto rounded-md border bg-muted/20 p-1">
        {filtered.length === 0 ? (
          <p className="p-2 text-center text-xs text-muted-foreground">No matches.</p>
        ) : (
          filtered.map((t) => {
            const checked = selected.includes(t.id);
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => onToggle(t.id)}
                className={`flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left text-xs transition hover:bg-background ${checked ? "bg-background ring-1 ring-primary/40" : ""}`}
              >
                <Checkbox checked={checked} className="mt-0.5 pointer-events-none" />
                <span className="flex-1">
                  <span className="block font-medium">{t.name}</span>
                  {t.treatment_type && (
                    <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      {t.treatment_type}
                    </span>
                  )}
                </span>
                {t.is_system && (
                  <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                    template
                  </span>
                )}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}

function AftercarePicker({
  items,
  selected,
  onToggle,
}: {
  items: { id: string; name: string; delay_hours: number }[];
  selected: string[];
  onToggle: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const selectedItems = items.filter((i) => selected.includes(i.id));
  return (
    <div className="space-y-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" role="combobox" className="w-full justify-between font-normal">
            <span className="text-muted-foreground">
              {selectedItems.length === 0
                ? "Search aftercare templates…"
                : `${selectedItems.length} selected`}
            </span>
            <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
          <Command>
            <CommandInput placeholder="Search templates…" />
            <CommandList>
              <CommandEmpty>No templates found.</CommandEmpty>
              <CommandGroup>
                {items.map((t) => {
                  const isSel = selected.includes(t.id);
                  return (
                    <CommandItem key={t.id} value={t.name} onSelect={() => onToggle(t.id)}>
                      <Check className={`mr-2 h-4 w-4 ${isSel ? "opacity-100" : "opacity-0"}`} />
                      <span className="flex-1">{t.name}</span>
                      <span className="text-xs text-muted-foreground">{t.delay_hours}h</span>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {selectedItems.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selectedItems.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => onToggle(t.id)}
              className="rounded-full border bg-foreground text-background px-2.5 py-1 text-xs inline-flex items-center gap-1"
            >
              {t.name} <X className="h-3 w-3" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
