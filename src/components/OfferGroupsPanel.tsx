import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  listMyOfferGroups,
  createOfferGroup,
  updateOfferGroup,
  deleteOfferGroup,
  type OfferGroupInput,
} from "@/lib/offer-groups.functions";
import { listMyPackages } from "@/lib/packages.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SearchableMultiPicker } from "@/components/ui/searchable-multi-picker";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Timer } from "lucide-react";

type Treatment = { id: string; name: string; price: number };
type Pkg = { id: string; name: string; price: number };

type GroupRow = {
  id: string;
  name: string;
  subtitle: string | null;
  starts_at: string | null;
  ends_at: string | null;
  active: boolean;
  pricing_mode: "none" | "percent" | "item";
  discount_percent: number | null;
  items: { treatment_id: string | null; package_id: string | null; offer_price: number | null }[];
};

function toLocalInput(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function OfferGroupsPanel({ treatments }: { treatments: Treatment[] }) {
  const load = useServerFn(listMyOfferGroups);
  const loadPackages = useServerFn(listMyPackages);
  const create = useServerFn(createOfferGroup);
  const update = useServerFn(updateOfferGroup);
  const remove = useServerFn(deleteOfferGroup);

  const [groups, setGroups] = useState<GroupRow[]>([]);
  const [packages, setPackages] = useState<Pkg[]>([]);
  const [editing, setEditing] = useState<GroupRow | null>(null);
  const [open, setOpen] = useState(false);

  async function refresh() {
    try {
      const [g, p] = await Promise.all([load({}), loadPackages({})]);
      setGroups(g as GroupRow[]);
      setPackages((p as Pkg[]) ?? []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load offers");
    }
  }
  useEffect(() => {
    refresh();
  }, []);

  return (
    <div className="space-y-3 border-t pt-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Timer className="h-4 w-4" /> Time-limited service categories
          </h2>
          <p className="text-sm text-muted-foreground">
            Build and name a temporary category using any treatments or packages. It appears in your main services
            menu and hides automatically when the countdown ends.
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => {
            setEditing(null);
            setOpen(true);
          }}
        >
          <Plus className="mr-2 h-4 w-4" /> Build category
        </Button>
      </div>

      {groups.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center text-sm text-muted-foreground">
            No time-limited offers yet.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {groups.map((g) => {
            const expired = g.ends_at ? new Date(g.ends_at).getTime() <= Date.now() : false;
            return (
              <Card key={g.id}>
                <CardContent className="flex items-start justify-between gap-3 p-4">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{g.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {g.items.length} item{g.items.length === 1 ? "" : "s"} ·{" "}
                      {g.pricing_mode === "percent"
                        ? `${g.discount_percent ?? 0}% off`
                        : g.pricing_mode === "item"
                          ? "Per-item offer price"
                          : "Normal prices"}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {g.ends_at
                        ? `${expired ? "Ended" : "Ends"} ${new Date(g.ends_at).toLocaleString()}`
                        : "No end date"}
                      {!g.active && " · hidden"}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => {
                        setEditing(g);
                        setOpen(true);
                      }}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={async () => {
                        if (!confirm("Delete this offer group?")) return;
                        await remove({ data: { id: g.id } });
                        toast.success("Deleted");
                        refresh();
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        {open && (
          <OfferGroupDialog
            key={editing?.id ?? "new"}
            group={editing}
            treatments={treatments}
            packages={packages}
            onSave={async (payload) => {
              try {
                if (editing) await update({ data: { id: editing.id, ...payload } });
                else await create({ data: payload });
                toast.success("Offer saved");
                setOpen(false);
                setEditing(null);
                refresh();
              } catch (e) {
                toast.error(e instanceof Error ? e.message : "Failed to save");
              }
            }}
          />
        )}
      </Dialog>
    </div>
  );
}

function OfferGroupDialog({
  group,
  treatments,
  packages,
  onSave,
}: {
  group: GroupRow | null;
  treatments: Treatment[];
  packages: Pkg[];
  onSave: (payload: OfferGroupInput) => void;
}) {
  const [name, setName] = useState(group?.name ?? "");
  const [subtitle, setSubtitle] = useState(group?.subtitle ?? "");
  const [startsAt, setStartsAt] = useState(toLocalInput(group?.starts_at ?? null));
  const [endsAt, setEndsAt] = useState(toLocalInput(group?.ends_at ?? null));
  const [active, setActive] = useState(group?.active ?? true);
  const [pricingMode, setPricingMode] = useState<"none" | "percent" | "item">(group?.pricing_mode ?? "none");
  const [percent, setPercent] = useState<string>(
    group?.discount_percent != null ? String(group.discount_percent) : "",
  );
  const [treatmentIds, setTreatmentIds] = useState<string[]>(
    (group?.items ?? []).filter((i) => i.treatment_id).map((i) => i.treatment_id as string),
  );
  const [packageIds, setPackageIds] = useState<string[]>(
    (group?.items ?? []).filter((i) => i.package_id).map((i) => i.package_id as string),
  );
  const [prices, setPrices] = useState<Record<string, string>>(() => {
    const m: Record<string, string> = {};
    for (const i of group?.items ?? []) {
      const key = i.treatment_id ?? i.package_id;
      if (key && i.offer_price != null) m[key] = String(i.offer_price);
    }
    return m;
  });

  const selected = useMemo(
    () => [
      ...treatmentIds.map((id) => ({
        key: id,
        kind: "treatment" as const,
        label: treatments.find((t) => t.id === id)?.name ?? "Treatment",
        price: treatments.find((t) => t.id === id)?.price ?? 0,
      })),
      ...packageIds.map((id) => ({
        key: id,
        kind: "package" as const,
        label: packages.find((p) => p.id === id)?.name ?? "Package",
        price: packages.find((p) => p.id === id)?.price ?? 0,
      })),
    ],
    [treatmentIds, packageIds, treatments, packages],
  );

  return (
    <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
      <DialogHeader>
            <DialogTitle>{group ? "Edit service category" : "Build a time-limited category"}</DialogTitle>
      </DialogHeader>

      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label>Category name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Autumn packages" />
          </div>
          <div>
            <Label>Subtitle (optional)</Label>
            <Input
              value={subtitle}
              onChange={(e) => setSubtitle(e.target.value)}
              placeholder="Limited spaces · book before it ends"
            />
          </div>
          <div>
            <Label>Starts (optional)</Label>
            <Input type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
          </div>
          <div>
            <Label>Ends (countdown)</Label>
            <Input type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm">
          <Switch checked={active} onCheckedChange={setActive} />
          <span>Show on my booking page</span>
        </label>

        <div className="space-y-3 rounded-md border p-3">
          <p className="text-sm font-medium">What's included</p>
          <SearchableMultiPicker
            label="Treatments"
            emptyMessage="No treatments"
            placeholder="Add treatments"
            items={treatments.map((t) => ({ id: t.id, name: t.name, hint: `£${Number(t.price).toFixed(2)}` }))}
            selected={treatmentIds}
            onToggle={(id) =>
              setTreatmentIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
            }
          />
          <SearchableMultiPicker
            label="Packages"
            emptyMessage="No packages"
            placeholder="Add packages"
            items={packages.map((p) => ({ id: p.id, name: p.name, hint: `£${Number(p.price).toFixed(2)}` }))}
            selected={packageIds}
            onToggle={(id) =>
              setPackageIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
            }
          />
        </div>

        <div className="space-y-3 rounded-md border p-3">
          <div>
            <Label>Offer pricing</Label>
            <Select value={pricingMode} onValueChange={(v) => setPricingMode(v as typeof pricingMode)}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Keep normal prices</SelectItem>
                <SelectItem value="percent">Group-wide % off everything</SelectItem>
                <SelectItem value="item">Set an offer price per item</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {pricingMode === "percent" && (
            <div className="max-w-[160px]">
              <Label className="text-xs text-muted-foreground">Discount %</Label>
              <Input
                type="number"
                min={0}
                max={100}
                value={percent}
                onChange={(e) => setPercent(e.target.value)}
                placeholder="20"
              />
            </div>
          )}

          {pricingMode === "item" && (
            <div className="space-y-2">
              {selected.length === 0 && (
                <p className="text-xs text-muted-foreground">Add treatments or packages above first.</p>
              )}
              {selected.map((s) => (
                <div key={`${s.kind}-${s.key}`} className="flex items-center gap-2">
                  <span className="min-w-0 flex-1 truncate text-sm">
                    {s.label}{" "}
                    <span className="text-xs text-muted-foreground">(was £{Number(s.price).toFixed(2)})</span>
                  </span>
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    className="w-28"
                    value={prices[s.key] ?? ""}
                    onChange={(e) => setPrices((prev) => ({ ...prev, [s.key]: e.target.value }))}
                    placeholder="Offer £"
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <DialogFooter>
        <Button
          onClick={() => {
            if (!name.trim()) {
              toast.error("Give the offer a name");
              return;
            }
            onSave({
              name,
              subtitle: subtitle.trim() || null,
              starts_at: startsAt ? new Date(startsAt).toISOString() : null,
              ends_at: endsAt ? new Date(endsAt).toISOString() : null,
              active,
              pricing_mode: pricingMode,
              discount_percent: pricingMode === "percent" && percent !== "" ? Number(percent) : null,
              items: [
                ...treatmentIds.map((id) => ({
                  treatment_id: id,
                  package_id: null,
                  offer_price:
                    pricingMode === "item" && prices[id] !== undefined && prices[id] !== ""
                      ? Number(prices[id])
                      : null,
                })),
                ...packageIds.map((id) => ({
                  treatment_id: null,
                  package_id: id,
                  offer_price:
                    pricingMode === "item" && prices[id] !== undefined && prices[id] !== ""
                      ? Number(prices[id])
                      : null,
                })),
              ],
            });
          }}
        >
          Save category
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
