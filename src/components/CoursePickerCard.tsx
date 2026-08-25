import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Check, Layers } from "lucide-react";

export type CourseOption = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  session_count: number;
  duration_minutes: number | null;
  compare_at_price: number | null;
  allow_split_payment: boolean;
};

/**
 * Groups every "course of X" package for one treatment into a single card.
 * The client opens a dialog and picks the course length instead of scrolling
 * through one card per session count. Split payment info is shown per option
 * and the normal package checkout is reused, so payment behaviour is unchanged.
 */
export function CoursePickerCard({
  treatmentName,
  imageUrl,
  options,
  slug,
  treatmentId,
  brand,
  accent,
  locationId,
}: {
  treatmentName: string;
  imageUrl: string | null;
  options: CourseOption[];
  slug: string;
  treatmentId: string;
  brand: string;
  accent: string;
  locationId?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [pickedId, setPickedId] = useState<string | null>(null);

  const sorted = [...options].sort((a, b) => a.session_count - b.session_count);
  const picked = sorted.find((o) => o.id === pickedId) ?? null;
  const from = Math.min(...sorted.map((o) => o.price));

  return (
    <>
      <Card className="overflow-hidden rounded-2xl border-2" style={{ borderColor: `${brand}33` }}>
        {imageUrl ? (
          <div className="aspect-[16/9] w-full overflow-hidden bg-muted">
            <img src={imageUrl} alt={treatmentName} className="h-full w-full object-cover" loading="lazy" />
          </div>
        ) : (
          <div
            className="flex h-28 w-full items-center justify-center"
            style={{ background: `linear-gradient(135deg, ${brand}22, ${accent}11)` }}
          >
            <Layers className="h-8 w-8 opacity-70" style={{ color: brand }} />
          </div>
        )}
        <CardContent className="p-4">
          <span
            className="rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide"
            style={{ backgroundColor: `${brand}1a`, color: brand }}
          >
            Course of treatments
          </span>
          <h3 className="mt-2 text-lg font-semibold" style={{ color: brand }}>{treatmentName}</h3>
          <p className="mt-1 text-sm opacity-70">
            {sorted.length} course option{sorted.length === 1 ? "" : "s"} ·{" "}
            {sorted.map((o) => `${o.session_count}`).join(" / ")} sessions
          </p>
          <p className="mt-2 text-sm font-semibold" style={{ color: brand }}>From £{from.toFixed(2)}</p>
          {sorted.some((o) => o.allow_split_payment) && (
            <p className="mt-1 text-xs opacity-70">Split payment available</p>
          )}
          <Button className="mt-3 w-full modo-btn" onClick={() => setOpen(true)}>
            Choose your course
          </Button>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] w-[calc(100vw-1.5rem)] max-w-lg overflow-y-auto p-4 sm:p-6">
          <DialogHeader className="text-left">
            <DialogTitle className="text-base sm:text-lg" style={{ color: brand }}>{treatmentName}</DialogTitle>
            <DialogDescription className="text-sm">Pick the course that suits you.</DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            {sorted.map((o) => {
              const active = o.id === pickedId;
              const usual = o.compare_at_price != null ? Number(o.compare_at_price) : null;
              const saving = usual && usual > o.price ? usual - o.price : 0;
              return (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => setPickedId(o.id)}
                  className="w-full rounded-xl border p-3 text-left transition"
                  style={{
                    borderColor: active ? brand : `${brand}26`,
                    backgroundColor: active ? `${brand}0d` : undefined,
                  }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 text-sm font-semibold">
                        {active && <Check className="h-3.5 w-3.5" style={{ color: brand }} />}
                        {o.session_count} session{o.session_count === 1 ? "" : "s"}
                      </div>
                      <div className="text-xs opacity-70">
                        {o.name}
                        {o.duration_minutes ? ` · ${o.duration_minutes} min each` : ""}
                      </div>
                      {o.description && <p className="mt-1 text-xs opacity-60 line-clamp-2">{o.description}</p>}
                      {o.allow_split_payment && o.session_count > 1 && (
                        <p className="mt-1 text-xs font-medium" style={{ color: brand }}>
                          Split payment — £{(o.price / o.session_count).toFixed(2)} per session
                        </p>
                      )}
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="text-base font-bold" style={{ color: brand }}>£{o.price.toFixed(2)}</div>
                      {saving > 0 && (
                        <div className="text-[11px] opacity-60 line-through">£{usual!.toFixed(2)}</div>
                      )}
                      {saving > 0 && (
                        <div className="text-[11px] font-semibold text-emerald-700">Save £{saving.toFixed(2)}</div>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="sticky bottom-0 -mx-4 mt-2 border-t bg-background px-4 pt-3 sm:-mx-6 sm:px-6">
            {picked ? (
              <Link
                to="/m/$slug/book-multi"
                params={{ slug }}
                search={{ pkgs: picked.id, ...(locationId ? { locationId } : {}) }}
                className="modo-btn mb-2 flex w-full items-center justify-center px-4 py-2.5 text-sm font-semibold"
                onClick={() => setOpen(false)}
              >
                Continue · £{picked.price.toFixed(2)}
              </Link>
            ) : (
              <Button className="mb-2 w-full modo-btn" disabled>
                Pick a course
              </Button>
            )}
            <p className="mb-2 text-center text-[11px] opacity-60">
              You can book your remaining sessions after your first appointment.
            </p>
          </div>
          <p className="sr-only">{treatmentId}</p>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default CoursePickerCard;
