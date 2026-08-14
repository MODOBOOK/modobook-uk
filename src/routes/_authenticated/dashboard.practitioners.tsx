import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  listMyPractitioners,
  upsertPractitioner,
  deletePractitioner,
} from "@/lib/practitioners.functions";
import { getSeatSummary, reserveExtraSeat } from "@/lib/practitioner-billing.functions";
import { SeatCostWarning, seatWillCharge, type SeatSummary } from "@/components/SeatCostWarning";

import { listMyLocations } from "@/lib/locations.functions";
import { getMyProfile, updateProfile } from "@/lib/profiles.functions";
import { ImageUploader } from "@/components/ImageUploader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Pencil, Plus, Trash2, Users } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

type Loc = Awaited<ReturnType<typeof listMyLocations>>[number];
type Pract = Awaited<ReturnType<typeof listMyPractitioners>>["practitioners"][number];

export const Route = createFileRoute("/_authenticated/dashboard/practitioners")({
  component: PractitionersPage,
});

type Draft = Partial<Pract> & { location_ids?: string[] };

function emptyDraft(): Draft {
  return { name: "", professional_title: "", photo_url: null, bio: "", active: true, location_ids: [] };
}

function PractitionersPage() {
  const fetchList = useServerFn(listMyPractitioners);
  const fetchLocs = useServerFn(listMyLocations);
  const fetchProfile = useServerFn(getMyProfile);
  const save = useServerFn(upsertPractitioner);
  const remove = useServerFn(deletePractitioner);
  const saveProfile = useServerFn(updateProfile);
  const fetchSeats = useServerFn(getSeatSummary);
  const reserveSeat = useServerFn(reserveExtraSeat);

  const [practitioners, setPractitioners] = useState<Pract[]>([]);
  const [links, setLinks] = useState<{ location_id: string; practitioner_id: string }[]>([]);
  const [locations, setLocations] = useState<Loc[]>([]);
  const [profileId, setProfileId] = useState<string>("");
  const [selectionMode, setSelectionMode] = useState<"required" | "optional" | "first_available">("optional");
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>(emptyDraft());
  const [saving, setSaving] = useState(false);
  const [seats, setSeats] = useState<Awaited<ReturnType<typeof getSeatSummary>> | null>(null);
  const [reserving, setReserving] = useState(false);
  const [warnOpen, setWarnOpen] = useState(false);


  async function refresh() {
    setLoading(true);
    try {
      const [list, locs, profile, seatInfo] = await Promise.all([
        fetchList(),
        fetchLocs(),
        fetchProfile(),
        fetchSeats().catch(() => null),
      ]);
      setPractitioners(list.practitioners);
      setLinks(list.links);
      setLocations(locs);
      setSeats(seatInfo);
      if (profile && "id" in profile) {
        setProfileId((profile as { id: string }).id);
        const m = (profile as { practitioner_selection_mode?: string }).practitioner_selection_mode;
        if (m === "required" || m === "optional" || m === "first_available") setSelectionMode(m);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { refresh(); }, []);

  const seatsUsed = seats?.practitioners.used ?? practitioners.length;
  const seatsAllowed = seats?.practitioners.allowed ?? 1;
  const seatsFull = Boolean(seats && !seats.comped && seatsUsed >= seatsAllowed);
  const canReserve = Boolean(seats && !seats.comped && seats.trialActive && !seats.liveSub);

  async function handleReserveSeat() {
    setReserving(true);
    try {
      await reserveSeat({ data: { kind: "practitioner" } });
      toast.success("Seat added — it'll be included when your billing starts.");
      await refresh();
      openNew();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not add a seat");
    } finally {
      setReserving(false);
    }
  }

  function openNew() {
    setDraft(emptyDraft());
    setOpen(true);
  }

  /** Confirm the price change first whenever this practitioner adds a paid seat. */
  function requestNew() {
    if (seatWillCharge(seats as unknown as SeatSummary, "practitioner")) setWarnOpen(true);
    else if (seatsFull && canReserve) handleReserveSeat();
    else openNew();
  }

  function confirmSeatCost() {
    setWarnOpen(false);
    if (seatsFull && canReserve) handleReserveSeat();
    else openNew();
  }

  function openEdit(p: Pract) {
    setDraft({
      ...p,
      location_ids: links.filter((l) => l.practitioner_id === p.id).map((l) => l.location_id),
    });
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
          professional_title: draft.professional_title ?? null,
          photo_url: draft.photo_url ?? null,
          bio: draft.bio ?? null,
          active: draft.active !== false,
          location_ids: draft.location_ids ?? [],
        },
      });
      toast.success("Practitioner saved");
      setOpen(false);
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this practitioner?")) return;
    try {
      await remove({ data: { id } });
      toast.success("Deleted");
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to delete");
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Practitioners</h1>
          <p className="text-sm text-muted-foreground">
            Add the team members who work at your clinic and assign them to locations. They appear under each location on your booking page.
          </p>
        </div>
        <Button onClick={requestNew} disabled={reserving}>
          <Plus className="mr-2 h-4 w-4" />
          {reserving ? "Adding seat…" : "Add practitioner"}
        </Button>
      </div>

      <SeatCostWarning
        open={warnOpen}
        onOpenChange={setWarnOpen}
        kind="practitioner"
        seats={seats as unknown as SeatSummary}
        onConfirm={confirmSeatCost}
      />


      {seats && !seats.comped && (
        <Card className={seatsFull ? "border-amber-500/50 bg-amber-500/5" : undefined}>
          <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
            <div className="text-sm">
              <p className="font-medium">
                {seatsUsed} of {seatsAllowed} practitioner {seatsAllowed === 1 ? "seat" : "seats"} used
              </p>
              <p className="text-xs text-muted-foreground">
                {seatsFull
                  ? "Your plan price is worked out from your account — adding another practitioner adds a seat automatically, and your direct debit updates from your next billing date."
                  : "You can add another practitioner right now at no extra cost."}
              </p>

            </div>
            <Button asChild variant="outline" size="sm">
              <Link to="/dashboard/billing">Plan &amp; billing</Link>
            </Button>
          </CardContent>
        </Card>
      )}


      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Patient selection mode</CardTitle>
          <p className="text-xs text-muted-foreground">
            Controls how patients choose a practitioner on your booking page once they've picked a location.
          </p>
        </CardHeader>
        <CardContent>
          <Select
            value={selectionMode}
            onValueChange={async (v) => {
              const mode = v as "required" | "optional" | "first_available";
              setSelectionMode(mode);
              if (!profileId) return;
              try {
                await saveProfile({ data: { id: profileId, practitioner_selection_mode: mode } });
                toast.success("Saved");
              } catch (e) {
                toast.error(e instanceof Error ? e.message : "Failed to save");
              }
            }}
          >
            <SelectTrigger className="w-full sm:w-80"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="optional">Optional — patient can pick a practitioner or skip</SelectItem>
              <SelectItem value="required">Required — patient must pick a practitioner</SelectItem>
              <SelectItem value="first_available">First available — auto-assign, hide picker</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>


      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : practitioners.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Users className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">No practitioners yet.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {practitioners.map((p) => {
            const locIds = links.filter((l) => l.practitioner_id === p.id).map((l) => l.location_id);
            const locNames = locations.filter((l) => locIds.includes(l.id)).map((l) => l.name);
            return (
              <Card key={p.id}>
                <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                  <div className="flex items-center gap-3">
                    {p.photo_url ? (
                      <img src={p.photo_url} alt={p.name} className="h-12 w-12 rounded-full object-cover" />
                    ) : (
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-sm font-bold">
                        {p.name.charAt(0)}
                      </div>
                    )}
                    <div>
                      <CardTitle className="text-base">
                        {p.name} {!p.active && <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-xs">Hidden</span>}
                      </CardTitle>
                      {p.professional_title && (
                        <p className="text-sm text-muted-foreground">{p.professional_title}</p>
                      )}
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {locNames.length > 0 ? locNames.join(" · ") : "No locations assigned"}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(p)}><Pencil className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(p.id)}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </CardHeader>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{draft.id ? "Edit practitioner" : "Add practitioner"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="name">Name *</Label>
              <Input id="name" value={draft.name ?? ""} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="title">Professional title</Label>
              <Input id="title" placeholder="e.g. Aesthetic Nurse Practitioner"
                value={draft.professional_title ?? ""}
                onChange={(e) => setDraft((d) => ({ ...d, professional_title: e.target.value }))} />
            </div>
            {profileId && (
              <ImageUploader
                label="Photo"
                value={draft.photo_url ?? null}
                onChange={(url) => setDraft((d) => ({ ...d, photo_url: url }))}
                profileId={profileId}
                folder="practitioners"
                previewClass="mt-2 h-24 w-24 object-cover rounded-full"
              />
            )}
            <div className="space-y-1.5">
              <Label htmlFor="bio">Short bio</Label>
              <Textarea id="bio" rows={3} value={draft.bio ?? ""} onChange={(e) => setDraft((d) => ({ ...d, bio: e.target.value }))} />
            </div>
            <div className="space-y-2 rounded-md border p-3">
              <p className="text-sm font-medium">Assigned locations</p>
              {locations.length === 0 ? (
                <p className="text-xs text-muted-foreground">Add a location first.</p>
              ) : (
                <div className="space-y-2">
                  {locations.map((loc) => {
                    const checked = (draft.location_ids ?? []).includes(loc.id);
                    return (
                      <label key={loc.id} className="flex items-center gap-2 text-sm">
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(v) => {
                            setDraft((d) => {
                              const cur = new Set(d.location_ids ?? []);
                              if (v) cur.add(loc.id); else cur.delete(loc.id);
                              return { ...d, location_ids: Array.from(cur) };
                            });
                          }}
                        />
                        {loc.name}
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
            <div className="flex items-center justify-between rounded-md border p-3">
              <div>
                <p className="text-sm font-medium">Active</p>
                <p className="text-xs text-muted-foreground">Visible on your booking page.</p>
              </div>
              <Switch checked={draft.active !== false} onCheckedChange={(v) => setDraft((d) => ({ ...d, active: v }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
