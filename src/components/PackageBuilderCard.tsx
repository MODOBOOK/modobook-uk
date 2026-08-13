import { useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Minus, Plus, Sparkles, Wand2 } from "lucide-react";
import { buildCustomPackage } from "@/lib/package-builder.functions";
import {
  computeBuilderPrice,
  describeBuilder,
  validateSelection,
  type BuilderRules,
} from "@/lib/package-builder-pricing";

export type PublicBuilder = BuilderRules & {
  id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  category_id: string | null;
  show_in_packages: boolean;
  items: { treatment_id: string; max_qty: number; sort_order: number }[];
};

type Treat = { id: string; name: string; price: number | null; duration: number | null };

export function PackageBuilderCard({
  builder,
  treatments,
  slug,
  brand,
  accent,
  locationId,
}: {
  builder: PublicBuilder;
  treatments: Treat[];
  slug: string;
  brand: string;
  accent: string;
  locationId?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [qty, setQty] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const build = useServerFn(buildCustomPackage);

  const options = useMemo(() => {
    const byId = new Map(treatments.map((t) => [t.id, t]));
    return [...builder.items]
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((i) => ({ ...i, treatment: byId.get(i.treatment_id) }))
      .filter((i): i is typeof i & { treatment: Treat } => Boolean(i.treatment));
  }, [builder.items, treatments]);

  const selection = options
    .map((o) => ({ treatment_id: o.treatment_id, qty: qty[o.treatment_id] ?? 0, price: Number(o.treatment.price ?? 0) }))
    .filter((s) => s.qty > 0);

  const { base, total, saving } = computeBuilderPrice(builder, selection);
  const problem = selection.length ? validateSelection(builder, selection) : "Pick your treatments";
  const summary = describeBuilder(builder);

  const bump = (id: string, delta: number, max: number) =>
    setQty((prev) => {
      const next = Math.min(max, Math.max(0, (prev[id] ?? 0) + delta));
      return { ...prev, [id]: next };
    });

  const submit = async () => {
    if (problem) return;
    setBusy(true);
    try {
      const res = await build({
        data: {
          slug,
          builderId: builder.id,
          selections: selection.map((s) => ({ treatment_id: s.treatment_id, qty: s.qty })),
        },
      });
      setOpen(false);
      navigate({
        to: "/m/$slug/book-multi",
        params: { slug },
        search: { pkgs: res.packageId, ...(locationId ? { locationId } : {}) },
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not build your package");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Card
        className="overflow-hidden border-2"
        style={{ borderColor: `${brand}40`, background: `linear-gradient(135deg, ${brand}0d, ${accent}08)` }}
      >
        {builder.image_url && (
          <img src={builder.image_url} alt={builder.name} className="h-36 w-full object-cover" />
        )}
        <CardContent className="p-4">
          <div className="flex items-center gap-2">
            <Wand2 className="h-4 w-4" style={{ color: brand }} />
            <span
              className="rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide"
              style={{ backgroundColor: `${brand}1a`, color: brand }}
            >
              Build your own
            </span>
          </div>
          <h3 className="mt-2 text-lg font-semibold" style={{ color: brand }}>{builder.name}</h3>
          {builder.description && <p className="mt-1 text-sm opacity-75">{builder.description}</p>}
          <p className="mt-2 flex items-center gap-1.5 text-sm font-medium">
            <Sparkles className="h-3.5 w-3.5" style={{ color: brand }} />
            {summary}
          </p>
          <Button className="mt-3 w-full modo-btn" onClick={() => setOpen(true)}>
            Start building
          </Button>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle style={{ color: brand }}>{builder.name}</DialogTitle>
            <DialogDescription>{summary}</DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            {options.map((o) => {
              const n = qty[o.treatment_id] ?? 0;
              return (
                <div
                  key={o.treatment_id}
                  className="flex items-center justify-between gap-3 rounded-xl border p-3"
                  style={{ borderColor: n > 0 ? brand : `${brand}26`, backgroundColor: n > 0 ? `${brand}0d` : undefined }}
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{o.treatment.name}</div>
                    <div className="text-xs opacity-70">
                      £{Number(o.treatment.price ?? 0).toFixed(2)}
                      {o.treatment.duration ? ` · ${o.treatment.duration} min` : ""}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <Button
                      type="button" size="icon" variant="outline" className="h-8 w-8"
                      disabled={n === 0}
                      onClick={() => bump(o.treatment_id, -1, o.max_qty)}
                      aria-label={`Remove one ${o.treatment.name}`}
                    >
                      <Minus className="h-3.5 w-3.5" />
                    </Button>
                    <span className="w-6 text-center text-sm font-semibold">{n}</span>
                    <Button
                      type="button" size="icon" variant="outline" className="h-8 w-8"
                      disabled={n >= o.max_qty}
                      onClick={() => bump(o.treatment_id, 1, o.max_qty)}
                      aria-label={`Add one ${o.treatment.name}`}
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              );
            })}
            {options.length === 0 && <p className="text-sm opacity-70">Nothing available to build with yet.</p>}
          </div>

          <div className="sticky bottom-0 -mx-6 mt-2 border-t bg-background px-6 pt-3">
            <div className="flex items-center justify-between text-sm">
              <span className="opacity-70">
                {selection.reduce((s, x) => s + x.qty, 0)} item
                {selection.reduce((s, x) => s + x.qty, 0) === 1 ? "" : "s"}
              </span>
              <span className="text-lg font-semibold" style={{ color: brand }}>
                {saving > 0 && <span className="mr-2 text-xs font-normal opacity-50 line-through">£{base.toFixed(2)}</span>}
                £{total.toFixed(2)}
              </span>
            </div>
            {saving > 0 && (
              <p className="text-xs font-medium" style={{ color: brand }}>You save £{saving.toFixed(2)}</p>
            )}
            <Button className="mt-2 mb-2 w-full modo-btn" disabled={Boolean(problem) || busy} onClick={submit}>
              {busy ? "Building…" : problem ? problem : `Continue to booking · £${total.toFixed(2)}`}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
