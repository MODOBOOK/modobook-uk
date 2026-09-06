import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Compass, Handshake, Mail, MapPin, Phone, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import {
  getMyDirectoryListing,
  saveMyDirectoryListing,
  listConnectRequests,
  respondToConnectRequest,
  PRESCRIBER_SERVICE_OPTIONS,
} from "@/lib/prescriber-directory.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/prescriber/directory")({
  ssr: false,
  component: DirectoryPage,
});

function DirectoryPage() {
  const qc = useQueryClient();
  const fetchListing = useServerFn(getMyDirectoryListing);
  const fetchRequests = useServerFn(listConnectRequests);
  const save = useServerFn(saveMyDirectoryListing);
  const respond = useServerFn(respondToConnectRequest);

  const q = useQuery({ queryKey: ["prescriber-directory"], queryFn: () => fetchListing() });
  const reqsQ = useQuery({ queryKey: ["connect-requests"], queryFn: () => fetchRequests(), refetchInterval: 60_000 });

  const [form, setForm] = useState({
    display_name: "",
    bio: "",
    town: "",
    postcode_area: "",
    travel_radius_miles: 25,
    services: [] as string[],
    availability: "",
    day_rate: "" as string,
    rates_on_request: true,
    contact_email: "",
    contact_phone: "",
    is_listed: false,
  });

  useEffect(() => {
    const d = q.data;
    if (!d) return;
    if (d.listing) {
      setForm({
        display_name: d.listing.display_name,
        bio: d.listing.bio,
        town: d.listing.town,
        postcode_area: d.listing.postcode_area,
        travel_radius_miles: d.listing.travel_radius_miles,
        services: d.listing.services,
        availability: d.listing.availability,
        day_rate: d.listing.day_rate != null ? String(d.listing.day_rate) : "",
        rates_on_request: d.listing.rates_on_request,
        contact_email: d.listing.contact_email,
        contact_phone: d.listing.contact_phone,
        is_listed: d.listing.is_listed,
      });
    } else {
      setForm((f) => ({ ...f, display_name: d.defaultName || f.display_name }));
    }
  }, [q.data]);

  const saveMut = useMutation({
    mutationFn: () =>
      save({
        data: {
          display_name: form.display_name.trim(),
          bio: form.bio.trim(),
          town: form.town.trim(),
          postcode_area: form.postcode_area.trim(),
          travel_radius_miles: form.travel_radius_miles,
          services: form.services,
          availability: form.availability.trim(),
          day_rate: form.day_rate === "" ? null : Number(form.day_rate),
          rates_on_request: form.rates_on_request,
          contact_email: form.contact_email.trim() || null,
          contact_phone: form.contact_phone.trim() || null,
          is_listed: form.is_listed,
        },
      }),
    onSuccess: () => {
      toast.success(form.is_listed ? "You're live in the directory" : "Listing saved");
      qc.invalidateQueries({ queryKey: ["prescriber-directory"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not save"),
  });

  const respondMut = useMutation({
    mutationFn: (v: { id: string; action: "accept" | "decline" }) => respond({ data: v }),
    onSuccess: (_d, v) => {
      toast.success(v.action === "accept" ? "Accepted — your contact details were shared" : "Declined");
      qc.invalidateQueries({ queryKey: ["connect-requests"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not update"),
  });

  const received = (reqsQ.data ?? []).filter((r) => r.direction === "received");
  const pending = received.filter((r) => r.status === "pending");

  if (q.isLoading) return <div className="p-8 text-center text-muted-foreground">Loading…</div>;

  if (q.data && !q.data.approved) {
    return (
      <Card className="mx-auto max-w-xl">
        <CardContent className="p-8 text-center">
          <Compass className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
          <p className="font-medium">Directory listing unlocks once your prescriber account is approved.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-serif text-2xl sm:text-3xl">Discovery</h2>
        <p className="text-sm text-muted-foreground">
          List yourself so clinics near you can find you and request to connect. Your contact details are only shared when you accept a request.
        </p>
      </div>

      {/* Connection requests */}
      {received.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Handshake className="h-5 w-5" /> Connection requests
              {pending.length > 0 && <Badge>{pending.length} new</Badge>}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {received.map((r) => (
              <div key={r.id} className="rounded-xl border p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="font-medium">{r.clinic_name ?? r.practitioner_name ?? "A clinic"}</div>
                    <div className="text-xs text-muted-foreground">
                      {r.practitioner_name ?? ""} · {new Date(r.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                    </div>
                  </div>
                  <Badge variant={r.status === "pending" ? "default" : r.status === "accepted" ? "secondary" : "outline"}>
                    {r.status}
                  </Badge>
                </div>
                <p className="mt-2 whitespace-pre-line text-sm">{r.message}</p>
                {(r.practitioner_email || r.practitioner_phone) && (
                  <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
                    {r.practitioner_email && <span className="flex items-center gap-1"><Mail className="h-3.5 w-3.5" />{r.practitioner_email}</span>}
                    {r.practitioner_phone && <span className="flex items-center gap-1"><Phone className="h-3.5 w-3.5" />{r.practitioner_phone}</span>}
                  </div>
                )}
                {r.status === "pending" && (
                  <div className="mt-3 flex gap-2">
                    <Button size="sm" className="rounded-lg" disabled={respondMut.isPending}
                      onClick={() => respondMut.mutate({ id: r.id, action: "accept" })}>
                      Accept & share my contact details
                    </Button>
                    <Button size="sm" variant="outline" className="rounded-lg" disabled={respondMut.isPending}
                      onClick={() => respondMut.mutate({ id: r.id, action: "decline" })}>
                      Decline
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Listing editor */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="text-lg">Your listing</CardTitle>
            <div className="flex items-center gap-2">
              {form.is_listed ? <Eye className="h-4 w-4 text-primary" /> : <EyeOff className="h-4 w-4 text-muted-foreground" />}
              <Switch checked={form.is_listed} onCheckedChange={(v) => setForm((f) => ({ ...f, is_listed: v }))} />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            {form.is_listed ? "You're visible to every clinic on MODO." : "Switch on to appear in the directory."}
          </p>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Display name</Label>
              <Input value={form.display_name} maxLength={80}
                onChange={(e) => setForm((f) => ({ ...f, display_name: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Town / city</Label>
              <Input value={form.town} maxLength={80} placeholder="e.g. Glasgow"
                onChange={(e) => setForm((f) => ({ ...f, town: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Postcode area <span className="text-muted-foreground">(optional)</span></Label>
              <Input value={form.postcode_area} maxLength={8} placeholder="e.g. G1"
                onChange={(e) => setForm((f) => ({ ...f, postcode_area: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Travel radius (miles)</Label>
              <Input type="number" min={1} max={500} value={form.travel_radius_miles}
                onChange={(e) => setForm((f) => ({ ...f, travel_radius_miles: Number(e.target.value) || 25 }))} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>About you <span className="text-muted-foreground">(shown to clinics)</span></Label>
            <Textarea value={form.bio} maxLength={600} rows={3}
              placeholder="Experience, how you like to work, anything clinics should know…"
              onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))} />
          </div>

          <div className="space-y-2">
            <Label>What you prescribe</Label>
            <div className="flex flex-wrap gap-2">
              {PRESCRIBER_SERVICE_OPTIONS.map((s) => {
                const on = form.services.includes(s);
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() =>
                      setForm((f) => ({ ...f, services: on ? f.services.filter((x) => x !== s) : [...f.services, s] }))
                    }
                    className={cn(
                      "rounded-full border px-3.5 py-1.5 text-sm transition",
                      on ? "border-primary bg-primary text-primary-foreground" : "text-muted-foreground hover:border-primary/50",
                    )}
                  >
                    {s}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Typical availability</Label>
              <Input value={form.availability} maxLength={200} placeholder="e.g. Weekdays, 2 weeks' notice"
                onChange={(e) => setForm((f) => ({ ...f, availability: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Day rate (£) <span className="text-muted-foreground">(optional)</span></Label>
              <Input type="number" min={0} value={form.day_rate} placeholder="Leave blank if on request"
                disabled={form.rates_on_request}
                onChange={(e) => setForm((f) => ({ ...f, day_rate: e.target.value }))} />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={form.rates_on_request}
              onCheckedChange={(v) => setForm((f) => ({ ...f, rates_on_request: !!v, day_rate: v ? "" : f.day_rate }))} />
            Rates on request — don't show a price
          </label>

          <div className="space-y-3 rounded-xl border border-dashed p-4">
            <p className="text-sm font-medium">Contact details</p>
            <p className="text-xs text-muted-foreground">
              Only shared with a clinic <strong>after you accept</strong> their request.
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Email</Label>
                <Input type="email" value={form.contact_email} maxLength={255}
                  onChange={(e) => setForm((f) => ({ ...f, contact_email: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Phone</Label>
                <Input value={form.contact_phone} maxLength={30}
                  onChange={(e) => setForm((f) => ({ ...f, contact_phone: e.target.value }))} />
              </div>
            </div>
          </div>

          <Button
            className="h-11 w-full rounded-xl sm:w-auto"
            disabled={saveMut.isPending || !form.display_name.trim() || !form.town.trim()}
            onClick={() => saveMut.mutate()}
          >
            {saveMut.isPending ? "Saving…" : form.is_listed ? "Save & stay listed" : "Save listing"}
          </Button>
        </CardContent>
      </Card>

      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <MapPin className="h-3.5 w-3.5" /> Registration numbers are never shown on your public listing.
      </p>
    </div>
  );
}
