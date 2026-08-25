import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Check, Layers } from "lucide-react";

export type CourseOption = {
  id: string;
  name: string;
  price: number;
  duration: number;
  session_count: number;
  allow_split_payment: boolean;
  description?: string | null;
  full?: boolean;
};

/**
 * One menu row that stands in for a family of course options (e.g. 1 / 3 / 6
 * sessions of the same treatment). Tapping it opens a pop-up where the client
 * picks the course; picking one simply ticks that treatment into the existing
 * booking selection, so split payment and checkout behave exactly as before.
 */
export function CourseGroupRow({
  groupName,
  options,
  brand,
  cardBg,
  cardBorder,
  nameColor,
  priceColor,
  bold,
  isSelected,
  onToggle,
}: {
  groupName: string;
  options: CourseOption[];
  brand: string;
  cardBg: string;
  cardBorder: string;
  nameColor: string;
  priceColor: string;
  bold: boolean;
  isSelected: (id: string) => boolean;
  onToggle: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const sorted = [...options].sort((a, b) => a.session_count - b.session_count || a.price - b.price);
  const from = Math.min(...sorted.map((o) => o.price));
  const chosen = sorted.filter((o) => isSelected(o.id));

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full rounded-xl border p-3 text-left shadow-sm transition hover:shadow"
        style={{ backgroundColor: cardBg, borderColor: chosen.length ? brand : cardBorder }}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className={`flex items-center gap-1.5 leading-tight ${bold ? "font-bold" : "font-medium"}`} style={{ color: nameColor }}>
              <Layers className="h-4 w-4 shrink-0 opacity-70" />
              <span className="truncate">{groupName}</span>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
              <span>{sorted.map((o) => o.session_count).join(" / ")} sessions</span>
              {sorted.some((o) => o.allow_split_payment) && (
                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                  Split payment available
                </span>
              )}
            </div>
            {chosen.length > 0 && (
              <div className="mt-1 text-xs font-semibold" style={{ color: brand }}>
                Added: {chosen.map((c) => c.name).join(", ")}
              </div>
            )}
          </div>
          <div className="shrink-0 text-right leading-tight">
            <div className="text-[11px] uppercase tracking-wide opacity-60">From</div>
            <div className={`whitespace-nowrap ${bold ? "font-bold" : "font-semibold"}`} style={{ color: priceColor }}>
              £{from.toFixed(2)}
            </div>
          </div>
        </div>
        <div className="mt-2 text-xs font-semibold" style={{ color: brand }}>
          Choose your course →
        </div>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] w-[calc(100vw-1.5rem)] max-w-lg overflow-y-auto p-4 sm:p-6">
          <DialogHeader className="text-left">
            <DialogTitle className="text-base sm:text-lg" style={{ color: brand }}>{groupName}</DialogTitle>
            <DialogDescription className="text-sm">Pick the option that suits you.</DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            {sorted.map((o) => {
              const active = isSelected(o.id);
              return (
                <button
                  key={o.id}
                  type="button"
                  disabled={o.full}
                  onClick={() => onToggle(o.id)}
                  className="w-full rounded-xl border p-3 text-left transition disabled:opacity-50"
                  style={{
                    borderColor: active ? brand : `${brand}26`,
                    backgroundColor: active ? `${brand}0d` : undefined,
                  }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 text-sm font-semibold">
                        {active && <Check className="h-3.5 w-3.5" style={{ color: brand }} />}
                        {o.name}
                      </div>
                      <div className="text-xs opacity-70">
                        {o.session_count} session{o.session_count === 1 ? "" : "s"}
                        {o.duration ? ` · ${o.duration} min each` : ""}
                        {o.full ? " · fully booked" : ""}
                      </div>
                      {o.description && <p className="mt-1 text-xs opacity-60 line-clamp-2">{o.description}</p>}
                      {o.allow_split_payment && o.session_count > 1 && (
                        <p className="mt-1 text-xs font-medium" style={{ color: brand }}>
                          Split payment — £{(o.price / o.session_count).toFixed(2)} per session
                        </p>
                      )}
                    </div>
                    <div className="shrink-0 text-base font-bold" style={{ color: brand }}>
                      £{o.price.toFixed(2)}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          <Button className="mt-2 w-full modo-btn" onClick={() => setOpen(false)}>
            {chosen.length ? "Done" : "Close"}
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default CourseGroupRow;
