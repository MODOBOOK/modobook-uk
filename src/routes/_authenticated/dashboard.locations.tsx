import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  listMyLocations,
  upsertLocation,
  deleteLocation,
  reorderLocation,
  getLocationPriceList,
  setTreatmentLocationPricing,
} from "@/lib/locations.functions";
import { getMyProfile } from "@/lib/profiles.functions";
import { getSeatSummary } from "@/lib/practitioner-billing.functions";
import { SeatCostWarning, seatWillCharge, type SeatSummary } from "@/components/SeatCostWarning";
import { ImageUploader } from "@/components/ImageUploader";

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
  DialogTrigger,
} from "@/components/ui/dialog";
import { ArrowDown, ArrowUp, Clock3, EyeOff, ExternalLink, MapPin, Pencil, Plus, Star, Tag, Trash2 } from "lucide-react";
import { mapsUrl } from "@/lib/maps";
import { toast } from "sonner";

type Location = Awaited<ReturnType<typeof listMyLocations>>[number];
type PriceRow = Awaited<ReturnType<typeof getLocationPriceList>>[number];

export const Route = createFileRoute("/_authenticated/dashboard/locations")({
  component: LocationsPage,
});

function emptyDraft(): Partial<Location> {
  return {
    name: "",
    address_line1: "",
    address_line2: "",
    city: "",
    postcode: "",
    country: "",
    phone: "",
    notes: "",
    is_primary: false,
    active: true,
    is_public: true,
    coming_soon: false,
    coming_soon_label: "",
  };
}

function LocationsPage() {
  const router = useRouter();
  const fetchLocations = useServerFn(listMyLocations);
  const fetchProfile = useServerFn(getMyProfile);
  const save = useServerFn(upsertLocation);
  const remove = useServerFn(deleteLocation);
  const reorder = useServerFn(reorderLocation);
  const fetchPriceList = useServerFn(getLocationPriceList);
  const savePricing = useServerFn(setTreatmentLocationPricing);
  const fetchSeats = useServerFn(getSeatSummary);


  const [locations, setLocations] = useState<Location[]>([]);
  const [profileId, setProfileId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Partial<Location>>(emptyDraft());
  const [saving, setSaving] = useState(false);
  const [seats, setSeats] = useState<SeatSummary | null>(null);
  const [warnOpen, setWarnOpen] = useState(false);

  // Price list dialog state
  const [priceOpen, setPriceOpen] = useState(false);
  const [priceLoc, setPriceLoc] = useState<Location | null>(null);
  const [priceRows, setPriceRows] = useState<PriceRow[]>([]);
  const [priceLoading, setPriceLoading] = useState(false);

  async function refresh() {
    setLoading(true);
    try {
      const [rows, profile, seatInfo] = await Promise.all([
        fetchLocations(),
        fetchProfile(),
        fetchSeats().catch(() => null),
      ]);
      setLocations(rows);
      setSeats((seatInfo as SeatSummary | null) ?? null);
      if (profile && typeof profile === "object" && "id" in profile) {
        setProfileId((profile as { id: string }).id);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function openNew() {
    setDraft({ ...emptyDraft(), is_primary: locations.length === 0 });
    setOpen(true);
  }

  /** Warn about the price change first when this location adds a paid seat. */
  function requestNew() {
    if (seatWillCharge(seats, "location")) setWarnOpen(true);
    else openNew();
  }


  function openEdit(loc: Location) {
    setDraft(loc);
    setOpen(true);
  }

  async function openPriceList(loc: Location) {
    setPriceLoc(loc);
    setPriceOpen(true);
    setPriceLoading(true);
    try {
      const rows = await fetchPriceList({ data: { location_id: loc.id } });
      setPriceRows(rows);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load price list");
    } finally {
      setPriceLoading(false);
    }
  }

  function updatePriceRow(id: string, patch: Partial<PriceRow>) {
    setPriceRows((prev) => prev.map((r) => (r.treatment_id === id ? { ...r, ...patch } : r)));
  }

  async function savePriceRow(row: PriceRow) {
    if (!priceLoc) return;
    try {
      await savePricing({
        data: {
          treatment_id: row.treatment_id,
          location_id: priceLoc.id,
          price_cents: row.price_cents,
          duration_minutes: row.duration_minutes,
          available: row.available,
        },
      });
      toast.success("Saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save");
    }
  }

  async function handleSave() {
    if (!draft.name?.trim()) {
      toast.error("Name is required");
      return;
    }
    setSaving(true);
    try {
      await save({
        data: {
          id: draft.id,
          name: draft.name!,
          address_line1: draft.address_line1 ?? null,
          address_line2: draft.address_line2 ?? null,
          city: draft.city ?? null,
          postcode: draft.postcode ?? null,
          country: draft.country ?? null,
          phone: draft.phone ?? null,
          notes: draft.notes ?? null,
          is_primary: !!draft.is_primary,
          active: draft.active !== false,
          is_public: draft.is_public !== false,
          image_url: draft.image_url ?? null,
          coming_soon: !!draft.coming_soon,
          coming_soon_label: draft.coming_soon_label ?? null,
        },
      });
      toast.success("Location saved");
      setOpen(false);
      await refresh();
      router.invalidate();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function move(id: string, direction: "up" | "down") {
    try {
      await reorder({ data: { id, direction } });
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to reorder");
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this location? Appointments will be unlinked.")) return;
    try {
      await remove({ data: { id } });
      toast.success("Location deleted");
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to delete");
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold">Locations</h1>
          <p className="text-sm text-muted-foreground">
            Manage clinic addresses. Use "Price list" to set a private price sheet per location — great for
            hidden locations you only book by message.
          </p>
        </div>
        <Button className="shrink-0" onClick={requestNew}>
          <Plus className="mr-2 h-4 w-4" />
          <span className="sm:hidden">Add</span><span className="hidden sm:inline">Add location</span>
        </Button>
      </div>

      <SeatCostWarning
        open={warnOpen}
        onOpenChange={setWarnOpen}
        kind="location"
        seats={seats}
        onConfirm={() => { setWarnOpen(false); openNew(); }}
      />

      {seats && !seats.comped && seats.locations.used > 0 && (
        <p className="text-xs text-muted-foreground">
          Your plan price is worked out from your account: {seats.locations.used} location
          {seats.locations.used === 1 ? "" : "s"} ({1 + seats.locations.freeExtras} included
          {seats.locations.billable > 0 ? `, ${seats.locations.billable} charged` : ""}).
        </p>
      )}


      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : locations.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <MapPin className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              No locations yet. Add your first clinic to start scheduling.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {locations.map((loc) => (
            <Card key={loc.id}>
              <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                <div>
                  <CardTitle className="flex items-center flex-wrap gap-2 text-base">
                    {loc.name}
                    {loc.is_primary && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                        <Star className="h-3 w-3" /> Primary
                      </span>
                    )}
                    {!loc.active && (
                      <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                        Hidden
                      </span>
                    )}
                    {loc.coming_soon && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                        <Clock3 className="h-3 w-3" /> {loc.coming_soon_label || "Coming soon"}
                      </span>
                    )}
                    {loc.active && loc.is_public === false && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-400">
                        <EyeOff className="h-3 w-3" /> Private
                      </span>
                    )}
                  </CardTitle>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {[loc.address_line1, loc.address_line2, loc.city, loc.postcode, loc.country]
                      .filter(Boolean)
                      .join(", ") || "No address"}
                    {loc.phone && <> · {loc.phone}</>}
                  </p>
                </div>
                <div className="flex gap-1">
                  <div className="flex flex-col">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      aria-label="Move up"
                      disabled={locations.indexOf(loc) === 0}
                      onClick={() => move(loc.id, "up")}
                    >
                      <ArrowUp className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      aria-label="Move down"
                      disabled={locations.indexOf(loc) === locations.length - 1}
                      onClick={() => move(loc.id, "down")}
                    >
                      <ArrowDown className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => openPriceList(loc)} title="Per-location price list">
                    <Tag className="mr-1 h-4 w-4" /> Price list
                  </Button>
                  {mapsUrl(loc) && (
                    <a
                      href={mapsUrl(loc)!}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Open in Maps"
                    >
                      <Button variant="ghost" size="icon">
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    </a>
                  )}
                  <Button variant="ghost" size="icon" onClick={() => openEdit(loc)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(loc.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger className="hidden" />
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{draft.id ? "Edit location" : "Add location"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                value={draft.name ?? ""}
                onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                placeholder="Main clinic"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="addr1">Address line 1</Label>
              <Input
                id="addr1"
                value={draft.address_line1 ?? ""}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, address_line1: e.target.value }))
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="addr2">Address line 2</Label>
              <Input
                id="addr2"
                value={draft.address_line2 ?? ""}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, address_line2: e.target.value }))
                }
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="city">City</Label>
                <Input
                  id="city"
                  value={draft.city ?? ""}
                  onChange={(e) => setDraft((d) => ({ ...d, city: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="postcode">Postcode</Label>
                <Input
                  id="postcode"
                  value={draft.postcode ?? ""}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, postcode: e.target.value }))
                  }
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="country">Country</Label>
                <Input
                  id="country"
                  value={draft.country ?? ""}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, country: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  value={draft.phone ?? ""}
                  onChange={(e) => setDraft((d) => ({ ...d, phone: e.target.value }))}
                />
              </div>
            </div>
            {profileId && (
              <ImageUploader
                label="Location photo (shown to patients)"
                value={draft.image_url ?? null}
                onChange={(url) => setDraft((d) => ({ ...d, image_url: url }))}
                profileId={profileId}
                folder={`locations`}
                previewClass="mt-2 h-24 w-24 object-cover rounded-full"
              />
            )}
            <div className="space-y-1.5">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={draft.notes ?? ""}
                onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))}
                placeholder="Parking info, entrance details, etc."
                rows={3}
              />
            </div>
            <div className="rounded-md border p-3 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Coming soon</p>
                  <p className="text-xs text-muted-foreground">
                    Show this location to patients but stop bookings until it opens.
                  </p>
                </div>
                <Switch
                  checked={!!draft.coming_soon}
                  onCheckedChange={(v) => setDraft((d) => ({ ...d, coming_soon: v }))}
                />
              </div>
              {draft.coming_soon && (
                <div className="space-y-1.5">
                  <Label htmlFor="cslabel">Badge text</Label>
                  <Input
                    id="cslabel"
                    value={draft.coming_soon_label ?? ""}
                    onChange={(e) => setDraft((d) => ({ ...d, coming_soon_label: e.target.value }))}
                    placeholder="Coming soon"
                  />
                </div>
              )}
            </div>
            <div className="flex items-center justify-between rounded-md border p-3">
              <div>
                <p className="text-sm font-medium">Primary location</p>
                <p className="text-xs text-muted-foreground">
                  Shown first to patients.
                </p>
              </div>
              <Switch
                checked={!!draft.is_primary}
                onCheckedChange={(v) => setDraft((d) => ({ ...d, is_primary: v }))}
              />
            </div>
            <div className="flex items-center justify-between rounded-md border p-3">
              <div>
                <p className="text-sm font-medium">Active</p>
                <p className="text-xs text-muted-foreground">
                  Master on/off. Turn off to hide from your dashboard too.
                </p>
              </div>
              <Switch
                checked={draft.active !== false}
                onCheckedChange={(v) => setDraft((d) => ({ ...d, active: v }))}
              />
            </div>
            <div className="flex items-center justify-between rounded-md border p-3">
              <div>
                <p className="text-sm font-medium">Show on public booking page</p>
                <p className="text-xs text-muted-foreground">
                  Turn off for private/message-only locations. You can still book patients in from the dashboard.
                </p>
              </div>
              <Switch
                checked={draft.is_public !== false}
                onCheckedChange={(v) => setDraft((d) => ({ ...d, is_public: v }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={priceOpen} onOpenChange={setPriceOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              Price list — {priceLoc?.name}
            </DialogTitle>
            <p className="text-xs text-muted-foreground">
              Override price, duration, or availability for each treatment at this location. Blank = use the treatment default.
            </p>
          </DialogHeader>
          {priceLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : priceRows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No treatments yet.</p>
          ) : (
            <div className="space-y-2">
              <div className="grid grid-cols-12 gap-2 px-2 pb-1 text-xs font-medium text-muted-foreground">
                <div className="col-span-5">Treatment</div>
                <div className="col-span-3">Price (£)</div>
                <div className="col-span-2">Mins</div>
                <div className="col-span-2 text-right">Available</div>
              </div>
              {priceRows.map((r) => (
                <div key={r.treatment_id} className="grid grid-cols-12 items-center gap-2 rounded-md border p-2">
                  <div className="col-span-5">
                    <p className="text-sm font-medium leading-tight">{r.name}</p>
                    <p className="text-xs text-muted-foreground">
                      Default £{r.base_price.toFixed(2)}
                      {r.base_duration ? ` · ${r.base_duration}m` : ""}
                    </p>
                  </div>
                  <div className="col-span-3">
                    <Input
                      type="number"
                      inputMode="decimal"
                      step="0.01"
                      min="0"
                      placeholder={r.base_price.toFixed(2)}
                      value={r.price_cents == null ? "" : (r.price_cents / 100).toString()}
                      onChange={(e) => {
                        const v = e.target.value.trim();
                        updatePriceRow(r.treatment_id, {
                          price_cents: v === "" ? null : Math.round(parseFloat(v) * 100),
                        });
                      }}
                      onBlur={() => savePriceRow(r)}
                    />
                  </div>
                  <div className="col-span-2">
                    <Input
                      type="number"
                      min="0"
                      step="5"
                      placeholder={r.base_duration ? String(r.base_duration) : "—"}
                      value={r.duration_minutes ?? ""}
                      onChange={(e) => {
                        const v = e.target.value.trim();
                        updatePriceRow(r.treatment_id, {
                          duration_minutes: v === "" ? null : parseInt(v, 10),
                        });
                      }}
                      onBlur={() => savePriceRow(r)}
                    />
                  </div>
                  <div className="col-span-2 flex justify-end">
                    <Switch
                      checked={r.available !== false}
                      onCheckedChange={(v) => {
                        updatePriceRow(r.treatment_id, { available: v });
                        savePriceRow({ ...r, available: v });
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setPriceOpen(false)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
