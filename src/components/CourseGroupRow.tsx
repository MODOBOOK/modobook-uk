import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Check, Clock, Sparkles } from "lucide-react";

export type CourseOption = {
  id: string;
  name: string;
  price: number;
  duration: number;
  session_count: number;
  allow_split_payment: boolean;
  recommended?: boolean;
  description?: string | null;
  full?: boolean;
};

/**
 * One menu row for a treatment offered as a course (1 / 3 / 6 sessions).
 * The row carries the treatment info; the pop-up is purely "choose your
 * sessions". Picking an option ticks it into the normal booking selection so
 * the client can carry on adding other treatments and checkout is unchanged.
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
  const single = sorted.find((o) => o.session_count <= 1) ?? sorted[0];
  const from = Math.min(...sorted.map((o) => o.price));
  const chosen = sorted.filter((o) => isSelected(o.id));
  const blurb = single?.description ?? sorted.find((o) => o.description)?.description ?? null;
  const anySplit = sorted.some((o) => o.allow_split_payment && o.session_count > 1);
  const recommended = sorted.find((o) => o.recommended);

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
            <div className={`leading-tight ${bold ? "font-bold" : "font-medium"}`} style={{ color: nameColor }}>
              {groupName}
            </div>
            {blurb && <p className="mt-1 text-xs opacity-70 line-clamp-2">{blurb}</p>}
            <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
              {single?.duration ? (
                <span className="inline-flex items-center gap-1">
                  <Clock className="h-3 w-3" /> {single.duration} min
                </span>
              ) : null}
              <span>· {sorted.map((o) => o.session_count).join(" / ")} sessions available</span>
              {anySplit && (
                <span className="rounded-full bg-emerald-100 px-2 py-0.5 font-semibold text-emerald-700">
                  Split payment
                </span>
              )}
            </div>
            {chosen.length > 0 && (
              <div className="mt-1.5 text-xs font-semibold" style={{ color: brand }}>
                Added: {chosen.map((c) => `${c.session_count} session${c.session_count === 1 ? "" : "s"}`).join(", ")}
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
          Choose your sessions →
        </div>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] w-[calc(100vw-1.5rem)] max-w-lg overflow-y-auto p-4 sm:p-6">
          <DialogHeader className="text-left">
            <DialogTitle className="text-base sm:text-lg" style={{ color: brand }}>
              Choose your sessions
            </DialogTitle>
            <DialogDescription className="text-sm">
              {groupName}
              {recommended ? ` — we recommend ${recommended.session_count} sessions for best results.` : ""}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            {sorted.map((o) => {
              const active = isSelected(o.id);
              const perSession = o.price / Math.max(1, o.session_count);
              return (
                <button
                  key={o.id}
                  type="button"
                  disabled={o.full}
                  onClick={() => onToggle(o.id)}
                  className="relative w-full rounded-xl border p-3 text-left transition disabled:opacity-50"
                  style={{
                    borderColor: active ? brand : o.recommended ? `${brand}66` : `${brand}26`,
                    backgroundColor: active ? `${brand}0d` : undefined,
                  }}
                >
                  {o.recommended && (
                    <span
                      className="absolute -top-2 right-3 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white"
                      style={{ backgroundColor: brand }}
                    >
                      <Sparkles className="h-3 w-3" /> Recommended
                    </span>
                  )}
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 text-sm font-semibold">
                        {active && <Check className="h-3.5 w-3.5" style={{ color: brand }} />}
                        {o.session_count} session{o.session_count === 1 ? "" : "s"}
                      </div>
                      <div className="text-xs opacity-70">
                        {o.name}
                        {o.duration ? ` · ${o.duration} min each` : ""}
                        {o.full ? " · fully booked" : ""}
                      </div>
                      {o.session_count > 1 && (
                        <p className="mt-1 text-xs opacity-70">£{perSession.toFixed(2)} per session</p>
                      )}
                      {o.allow_split_payment && o.session_count > 1 && (
                        <p className="mt-0.5 text-xs font-medium" style={{ color: brand }}>
                          Split payment available — pay per session
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

          <p className="text-xs text-muted-foreground">
            {chosen.length
              ? "Added to your booking — close this to keep adding other treatments."
              : "Tap an option to add it to your booking."}
          </p>

          <Button className="w-full modo-btn" onClick={() => setOpen(false)}>
            {chosen.length ? "Done — keep browsing" : "Close"}
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default CourseGroupRow;
