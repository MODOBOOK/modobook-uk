import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Timer, Package as PackageIcon } from "lucide-react";
import { listMyPackages, setPackageLimitedOffer } from "@/lib/packages.functions";
import { getMyPackageCategories, updateCategory } from "@/lib/categories.functions";

type Pkg = {
  id: string;
  name: string;
  price: number;
  compare_at_price: number | null;
  category_id: string | null;
  is_limited?: boolean | null;
  limited_starts_at?: string | null;
  limited_ends_at?: string | null;
  limited_quantity?: number | null;
  limited_claimed?: number | null;
  limited_book_by_only?: boolean | null;
};

type Cat = {
  id: string;
  name: string;
  is_limited?: boolean | null;
  limited_starts_at?: string | null;
  limited_ends_at?: string | null;
};

function toLocalInput(iso: string | null | undefined) {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function fromLocalInput(v: string) {
  if (!v.trim()) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function countdown(endsAt: string | null | undefined, now: number) {
  if (!endsAt) return null;
  const ms = new Date(endsAt).getTime() - now;
  if (ms <= 0) return "Ended";
  const mins = Math.floor(ms / 60000);
  const days = Math.floor(mins / 1440);
  const hours = Math.floor((mins % 1440) / 60);
  if (days > 0) return `${days}d ${hours}h left`;
  if (hours > 0) return `${hours}h ${mins % 60}m left`;
  return `${mins}m left`;
}

function OfferRow({ p, now, onSaved }: { p: Pkg; now: number; onSaved: () => void }) {
  const save = useServerFn(setPackageLimitedOffer);
  const [on, setOn] = useState(Boolean(p.is_limited));
  const [price, setPrice] = useState(String(p.price ?? ""));
  const [wasPrice, setWasPrice] = useState(p.compare_at_price == null ? "" : String(p.compare_at_price));
  const [start, setStart] = useState(toLocalInput(p.limited_starts_at));
  const [end, setEnd] = useState(toLocalInput(p.limited_ends_at));
  const [spots, setSpots] = useState(p.limited_quantity == null ? "" : String(p.limited_quantity));
  const [bookBy, setBookBy] = useState(p.limited_book_by_only !== false);
  const [saving, setSaving] = useState(false);

  const remaining =
    p.limited_quantity == null ? null : Math.max(0, Number(p.limited_quantity) - Number(p.limited_claimed ?? 0));
  const cd = on ? countdown(p.limited_ends_at, now) : null;

  async function handleSave(nextOn = on) {
    setSaving(true);
    try {
      await save({
        data: {
          id: p.id,
          is_limited: nextOn,
          limited_starts_at: fromLocalInput(start),
          limited_ends_at: fromLocalInput(end),
          limited_quantity: spots.trim() === "" ? null : Math.max(1, Number(spots) || 1),
          limited_book_by_only: bookBy,
          price: price.trim() === "" ? null : Number(price),
          compare_at_price: wasPrice.trim() === "" ? null : Number(wasPrice),
        },
      });
      toast.success("Offer saved");
      onSaved();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="rounded-2xl">
      <CardContent className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate font-semibold">{p.name}</p>
            <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px]">
              {on && cd && (
                <span className="rounded-full bg-rose-100 px-2 py-0.5 font-semibold text-rose-800">{cd}</span>
              )}
              {on && remaining != null && (
                <span className="rounded-full bg-amber-100 px-2 py-0.5 font-semibold text-amber-900">
                  {remaining} left
                </span>
              )}
              {!on && <span className="text-muted-foreground">Not on offer</span>}
            </div>
          </div>
          <Switch
            checked={on}
            onCheckedChange={(v) => {
              setOn(v);
              void handleSave(v);
            }}
          />
        </div>

        {on && (
          <div className="space-y-3 border-t pt-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Offer price (£)</Label>
                <Input type="number" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Usual price (£)</Label>
                <Input type="number" step="0.01" value={wasPrice} onChange={(e) => setWasPrice(e.target.value)} placeholder="Auto" />
              </div>
              <div>
                <Label className="text-xs">Starts</Label>
                <Input type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Ends</Label>
                <Input type="datetime-local" value={end} onChange={(e) => setEnd(e.target.value)} />
              </div>
            </div>
            <div>
              <Label className="text-xs">Spots available (blank = unlimited)</Label>
              <Input type="number" min={1} value={spots} onChange={(e) => setSpots(e.target.value)} placeholder="Unlimited" />
            </div>
            <div className="flex items-start justify-between gap-3 rounded-xl border p-3">
              <div className="text-xs">
                <p className="font-medium">Booking window only</p>
                <p className="text-muted-foreground">
                  Clients must book before the end date, but their appointment can be any later date.
                </p>
              </div>
              <Switch checked={bookBy} onCheckedChange={setBookBy} />
            </div>
            <Button className="w-full rounded-full" disabled={saving} onClick={() => handleSave()}>
              {saving ? "Saving…" : "Save offer"}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function CategoryRow({ c, onSaved }: { c: Cat; onSaved: () => void }) {
  const patch = useServerFn(updateCategory);
  const [on, setOn] = useState(Boolean(c.is_limited));
  const [start, setStart] = useState(toLocalInput(c.limited_starts_at));
  const [end, setEnd] = useState(toLocalInput(c.limited_ends_at));
  const [saving, setSaving] = useState(false);

  async function save(nextOn = on) {
    setSaving(true);
    try {
      await patch({
        data: {
          id: c.id,
          is_limited: nextOn,
          limited_starts_at: nextOn ? fromLocalInput(start) : null,
          limited_ends_at: nextOn ? fromLocalInput(end) : null,
        },
      });
      toast.success("Category updated");
      onSaved();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="rounded-2xl">
      <CardContent className="space-y-3 p-4">
        <div className="flex items-center justify-between gap-3">
          <p className="truncate font-semibold">{c.name}</p>
          <Switch
            checked={on}
            onCheckedChange={(v) => {
              setOn(v);
              void save(v);
            }}
          />
        </div>
        {on && (
          <div className="space-y-3 border-t pt-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Starts</Label>
                <Input type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Ends</Label>
                <Input type="datetime-local" value={end} onChange={(e) => setEnd(e.target.value)} />
              </div>
            </div>
            <Button className="w-full rounded-full" disabled={saving} onClick={() => save()}>
              {saving ? "Saving…" : "Save category window"}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function LimitedOffersPanel() {
  const fetchPkgs = useServerFn(listMyPackages);
  const fetchCats = useServerFn(getMyPackageCategories);
  const pkgs = useQuery({ queryKey: ["my-packages", "offers"], queryFn: () => fetchPkgs() });
  const cats = useQuery({ queryKey: ["my-package-categories", "offers"], queryFn: () => fetchCats() });

  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  const list = (pkgs.data ?? []) as unknown as Pkg[];
  const live = useMemo(() => list.filter((p) => p.is_limited), [list]);
  const rest = useMemo(() => list.filter((p) => !p.is_limited), [list]);

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border p-4">
        <div className="flex items-center gap-2">
          <Timer className="h-4 w-4" />
          <h2 className="font-semibold">Limited time offers</h2>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Turn any package into a timed offer. Clients see a live countdown badge on the package in your booking page,
          and the offer disappears automatically when it ends or sells out.
        </p>
      </div>

      {pkgs.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : list.length === 0 ? (
        <Card className="rounded-2xl">
          <CardContent className="space-y-3 p-6 text-center">
            <PackageIcon className="mx-auto h-6 w-6 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Create a package first, then run it as a limited offer.</p>
            <Link to="/dashboard/packages" className="inline-block">
              <Button className="rounded-full">Go to Packages</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <>
          {live.length > 0 && (
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Running</p>
              {live.map((p) => (
                <OfferRow key={p.id} p={p} now={now} onSaved={() => pkgs.refetch()} />
              ))}
            </div>
          )}
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Other packages</p>
            {rest.map((p) => (
              <OfferRow key={p.id} p={p} now={now} onSaved={() => pkgs.refetch()} />
            ))}
          </div>
        </>
      )}

      {(cats.data ?? []).length > 0 && (
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Limited time package categories
          </p>
          <p className="text-xs text-muted-foreground">
            Run a whole category as a timed drop — everything inside it hides when the window closes.
          </p>
          {((cats.data ?? []) as unknown as Cat[]).map((c) => (
            <CategoryRow key={c.id} c={c} onSaved={() => cats.refetch()} />
          ))}
        </div>
      )}
    </div>
  );
}
