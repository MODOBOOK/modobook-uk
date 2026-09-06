import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Check, Sparkles } from "lucide-react";
import { courseGroupLabel } from "@/lib/course-group-label";

export type CourseOption = {
  id: string;
  name: string;
  /** Live price the client pays (already discounted). */
  price: number;
  /** Original price before any active discount. */
  base_price?: number;
  discount_percent?: number;
  show_was_now?: boolean;
  discount_label?: string | null;
  duration: number;
  session_count: number;
  allow_split_payment: boolean;
  interval_days?: number | null;
  recommended?: boolean;
  description?: string | null;
  picture_url?: string | null;
  full?: boolean;
  unit_label?: string | null;
  cta_label?: string | null;
  option_label?: string | null;
};

function treatmentName(name: string) {
  return name
    .replace(/\s*[—-]\s*(?:single|\d+)\s+sessions?$/i, "")
    .replace(/\s+(?:single|\d+)\s+sessions?$/i, "")
    // Strip unit-count suffixes like "— 1 Vial x", "- 2 areas x", "1 vial x"
    // ("x" optional so "— 1 Vial" is removed too)
    .replace(/\s*[—-]\s*\d+\s+[a-z]+\s*x?\s*$/i, "")
    .replace(/\s+\d+\s+[a-z]+\s*x\s*$/i, "")
    // Only strip a standalone trailing "x" (e.g. "Sculptra x"), never the last
    // letter of a word like "Botox" or "Dermalux".
    .replace(/\s+x\s*$/i, "")
    .trim();
}

function optionName(name: string, groupName: string, sessionCount: number, unit: string, optionLabel?: string | null) {
  const savedLabel = (optionLabel ?? "").trim();
  if (savedLabel) return savedLabel;
  const trimmed = name.trim();
  const prefixPattern = new RegExp(`^${groupName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*[—-]\\s*`, "i");
  const enteredName = trimmed.replace(prefixPattern, "").trim();
  return enteredName || `${sessionCount} ${sessionCount === 1 ? unit.replace(/s$/i, "") || unit : unit}`;
}

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
  size,
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
  size: "sm" | "md" | "lg";
  bold: boolean;
  isSelected: (id: string) => boolean;
  onToggle: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const unitRaw = (options.find((o) => (o.unit_label ?? "").trim())?.unit_label ?? "sessions").trim();
  const unitPlural = unitRaw || "sessions";
  const unitSingular = unitPlural.replace(/s$/i, "") || unitPlural;
  const unitOf = (n: number) => (n === 1 ? unitSingular : unitPlural);
  const ctaRaw = (options.find((o) => (o.cta_label ?? "").trim())?.cta_label ?? "").trim();
  const cta = ctaRaw || `Choose your ${unitPlural}`;
  const sorted = [...options].sort((a, b) => a.session_count - b.session_count || a.price - b.price);
  const single = sorted.find((o) => o.session_count <= 1) ?? sorted[0];
  const groupLabel = courseGroupLabel(groupName);
  const displayName = groupLabel || treatmentName(single?.name ?? "");
  const chosen = sorted.filter((o) => isSelected(o.id));
  const blurb = single?.description ?? sorted.find((o) => o.description)?.description ?? null;
  const anySplit = sorted.some((o) => o.allow_split_payment && o.session_count > 1);
  const bookable = sorted.filter((o) => !o.full);
  const priceList = bookable.length ? bookable : sorted;
  const fromPrice = priceList.reduce((min, o) => Math.min(min, o.price), Number.POSITIVE_INFINITY);
  const cheapest = priceList.find((o) => o.price === fromPrice) ?? priceList[0];
  const maxPercent = Math.max(0, ...sorted.map((o) => Number(o.discount_percent ?? 0)));
  const fromWas =
    cheapest && Number(cheapest.discount_percent ?? 0) > 0 && cheapest.show_was_now !== false
      ? Number(cheapest.base_price ?? cheapest.price)
      : null;
  const offerLabel = sorted.find((o) => (o.discount_label ?? "").trim())?.discount_label ?? null;
  const spacingLabel = (days?: number | null) => {
    if (!days || days <= 0) return null;
    if (days % 7 === 0) {
      const w = days / 7;
      return `${w} week${w === 1 ? "" : "s"} apart`;
    }
    return `${days} day${days === 1 ? "" : "s"} apart`;
  };
  const recommended = sorted.find((o) => o.recommended);
  const detailOption = single;
  const detailPicture = sorted.find((o) => o.picture_url)?.picture_url ?? null;
  const hasLongDescription = (detailOption?.description ?? "").length > 0 || !!detailPicture;
  const padding = size === "lg" ? "p-4 sm:p-5" : size === "md" ? "p-4" : "p-3.5";
  const nameSize = size === "lg" ? "text-lg sm:text-xl" : size === "md" ? "text-base sm:text-lg" : "text-[15px] sm:text-base";
  const actionSize = size === "lg" ? "text-lg" : size === "md" ? "text-base" : "text-[15px]";
  const checkSize = size === "lg" ? "h-5 w-5" : "h-4 w-4";
  const tickSize = size === "lg" ? "h-3 w-3" : "h-2.5 w-2.5";

  return (
    <>
      <div
        role="button"
        tabIndex={0}
        onClick={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") setOpen(true);
        }}
        className={`group flex w-full items-start gap-3 rounded-xl border text-left transition hover:shadow-sm ${padding}`}
        style={{
          backgroundColor: cardBg,
          borderColor: chosen.length ? brand : cardBorder,
          boxShadow: chosen.length ? `0 0 0 1.5px ${brand}` : undefined,
        }}
      >
        <span
          className={`mt-0.5 flex shrink-0 self-start items-center justify-center rounded-full border ${checkSize}`}
          style={chosen.length
            ? { backgroundColor: brand, borderColor: brand, color: "white" }
            : { borderColor: `${brand}66` }}
          aria-hidden="true"
        >
          {chosen.length > 0 && <Check className={tickSize} />}
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className={`leading-tight ${nameSize} ${bold ? "font-bold" : "font-medium"}`} style={{ color: nameColor }}>
                {displayName}
              </div>
              <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm text-muted-foreground">
                {Number.isFinite(fromPrice) && (
                  <span className="flex items-center gap-1.5 font-bold" style={{ color: priceColor }}>
                    <span className="text-xs font-semibold opacity-70">from </span>
                    {fromWas != null && fromWas > fromPrice && (
                      <span className="text-xs font-medium line-through opacity-60">£{fromWas.toFixed(2)}</span>
                    )}
                    £{fromPrice.toFixed(2)}
                  </span>
                )}
                {maxPercent > 0 && (
                  <span className="rounded-full bg-rose-100 px-2 py-px text-[11px] font-bold uppercase tracking-wide text-rose-700">
                    {offerLabel || `${Math.round(maxPercent)}% off`}
                  </span>
                )}
                {single?.duration ? <span>· {single.duration} min</span> : null}
                {anySplit && (
                  <span className="rounded-full bg-emerald-100 px-2 py-px text-[11px] font-semibold text-emerald-700">
                    Split payment
                  </span>
                )}
              </div>
            </div>
            <span
              className={`shrink-0 self-center rounded-full px-3 py-1.5 text-xs font-semibold ${actionSize === "text-lg" ? "sm:px-4 sm:py-2 sm:text-sm" : ""}`}
              style={{ backgroundColor: `${brand}14`, color: brand }}
            >
              {cta}
            </span>
          </div>

          {blurb && <p className="mt-1 line-clamp-2 text-sm leading-snug text-muted-foreground">{blurb}</p>}
          {chosen.length > 0 && (
            <div className="mt-1 text-sm font-semibold" style={{ color: brand }}>
              Added: {chosen.map((c) => optionName(c.name, groupName, c.session_count, unitPlural, c.option_label)).join(", ")}
            </div>
          )}
          {hasLongDescription && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setDetailsOpen(true);
              }}
              className="mt-1 text-xs font-semibold"
              style={{ color: brand }}
            >
              Read more
            </button>
          )}
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] w-[calc(100vw-1.5rem)] max-w-lg overflow-y-auto p-4 sm:p-6">
          <DialogHeader className="text-left">
            <DialogTitle className="text-base sm:text-lg" style={{ color: brand }}>
              {cta}
            </DialogTitle>
            <DialogDescription className="text-sm">
              {displayName} — pick as many options as you like.
              {recommended ? ` We recommend ${optionName(recommended.name, groupName, recommended.session_count, unitPlural, recommended.option_label)} for best results.` : ""}
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
                        {optionName(o.name, groupName, o.session_count, unitPlural, o.option_label)}
                      </div>
                      <div className="text-xs opacity-70">
                        {o.duration ? `${o.duration} min each` : ""}
                        {o.full ? " · fully booked" : ""}
                      </div>
                      {o.description && o.description !== blurb && (
                        <p className="mt-1 whitespace-pre-line text-xs leading-relaxed opacity-80">{o.description}</p>
                      )}
                      {o.session_count > 1 && (
                        <p className="mt-1 text-xs opacity-70">
                          £{perSession.toFixed(2)} per {unitSingular}
                          {spacingLabel(o.interval_days) ? ` · ${spacingLabel(o.interval_days)}` : ""}
                        </p>
                      )}
                      {!o.allow_split_payment && o.session_count > 1 && (
                        <p className="mt-0.5 text-xs opacity-70">Paid in full up front</p>
                      )}
                      {o.allow_split_payment && o.session_count > 1 && (
                        <p className="mt-0.5 text-xs font-medium" style={{ color: brand }}>
                          Split payment available — £{perSession.toFixed(2)} per {unitSingular}, paid as you go
                        </p>
                      )}
                    </div>
                    <div className="shrink-0 text-right">
                      {Number(o.discount_percent ?? 0) > 0 && o.show_was_now !== false && Number(o.base_price ?? 0) > o.price && (
                        <div className="text-xs font-medium line-through opacity-60">£{Number(o.base_price).toFixed(2)}</div>
                      )}
                      <div className="text-base font-bold" style={{ color: brand }}>£{o.price.toFixed(2)}</div>
                      {Number(o.discount_percent ?? 0) > 0 && (
                        <div className="text-[10px] font-bold uppercase tracking-wide text-rose-700">
                          {Math.round(Number(o.discount_percent))}% off
                        </div>
                      )}
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

      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-h-[85vh] w-[calc(100vw-1.5rem)] max-w-lg overflow-y-auto p-4 sm:p-6">
          <DialogHeader className="text-left">
            <DialogTitle className="text-base sm:text-lg" style={{ color: brand }}>
              {displayName}
            </DialogTitle>
            <DialogDescription className="text-sm">
              Course information and available session options.
            </DialogDescription>
          </DialogHeader>

          {detailPicture && (
            <div className="overflow-hidden rounded-xl bg-muted">
              <img
                src={detailPicture}
                alt={displayName}
                className="max-h-64 w-full object-cover"
                loading="lazy"
              />
            </div>
          )}

          {detailOption?.description && (
            <div className="whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
              {detailOption.description}
            </div>
          )}

          <div className="space-y-2">
            <h4 className="text-sm font-semibold" style={{ color: nameColor }}>
              Available options
            </h4>
            {sorted.map((o) => {
              return (
                <div
                  key={o.id}
                  className="flex items-center justify-between rounded-xl border p-3 text-sm"
                  style={{ borderColor: `${brand}26` }}
                >
                  <div className="min-w-0">
                    <div className="font-semibold">
                      {optionName(o.name, groupName, o.session_count, unitPlural, o.option_label)}
                      {o.recommended && (
                        <span
                          className="ml-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white"
                          style={{ backgroundColor: brand }}
                        >
                          <Sparkles className="h-3 w-3" /> Recommended
                        </span>
                      )}
                    </div>
                    <div className="text-xs opacity-70">
                      {o.duration ? `${o.duration} min each` : null}
                      {spacingLabel(o.interval_days) ? ` · ${spacingLabel(o.interval_days)}` : ""}
                    </div>
                    {o.description && o.description !== blurb && (
                      <p className="mt-1 whitespace-pre-line text-xs leading-relaxed opacity-80">{o.description}</p>
                    )}
                    {o.allow_split_payment && o.session_count > 1 && (
                      <div className="mt-0.5 text-xs font-medium" style={{ color: brand }}>
                        Split payment available
                      </div>
                    )}
                  </div>
                  <div className="shrink-0 text-right font-bold" style={{ color: brand }}>
                    {Number(o.discount_percent ?? 0) > 0 && o.show_was_now !== false && Number(o.base_price ?? 0) > o.price && (
                      <span className="mr-1.5 text-xs font-medium line-through opacity-60">£{Number(o.base_price).toFixed(2)}</span>
                    )}
                    £{o.price.toFixed(2)}
                  </div>
                </div>
              );
            })}
          </div>

          <Button className="w-full modo-btn" onClick={() => { setDetailsOpen(false); setOpen(true); }}>
            Choose your sessions
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default CourseGroupRow;
