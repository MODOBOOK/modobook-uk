import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  listMyLocations,
  upsertLocation,
  deleteLocation,
} from "@/lib/locations.functions";
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
import { ExternalLink, MapPin, Pencil, Plus, Star, Trash2 } from "lucide-react";
import { mapsUrl } from "@/lib/maps";
import { toast } from "sonner";

type Location = Awaited<ReturnType<typeof listMyLocations>>[number];

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
  };
}

function LocationsPage() {
  const router = useRouter();
  const fetchLocations = useServerFn(listMyLocations);
  const save = useServerFn(upsertLocation);
  const remove = useServerFn(deleteLocation);

  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Partial<Location>>(emptyDraft());
  const [saving, setSaving] = useState(false);

  async function refresh() {
    setLoading(true);
    try {
      const rows = await fetchLocations();
      setLocations(rows);
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

  function openEdit(loc: Location) {
    setDraft(loc);
    setOpen(true);
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Locations</h1>
          <p className="text-sm text-muted-foreground">
            Manage the clinic addresses where you offer treatments. Per-location pricing
            can be set from each treatment.
          </p>
        </div>
        <Button onClick={openNew}>
          <Plus className="mr-2 h-4 w-4" />
          Add location
        </Button>
      </div>

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
                  <CardTitle className="flex items-center gap-2 text-base">
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
                  </CardTitle>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {[loc.address_line1, loc.address_line2, loc.city, loc.postcode, loc.country]
                      .filter(Boolean)
                      .join(", ") || "No address"}
                    {loc.phone && <> · {loc.phone}</>}
                  </p>
                </div>
                <div className="flex gap-1">
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
                  Visible on your MODO Book page.
                </p>
              </div>
              <Switch
                checked={draft.active !== false}
                onCheckedChange={(v) => setDraft((d) => ({ ...d, active: v }))}
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
    </div>
  );
}
