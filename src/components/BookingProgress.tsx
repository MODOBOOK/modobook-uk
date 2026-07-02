import { Check } from "lucide-react";

export type BookingStepKey = "treatment" | "location" | "datetime" | "details" | "payment";

export type BookingStep = {
  key: BookingStepKey;
  label: string;
  done: boolean;
  active?: boolean;
};

type Props = {
  steps: BookingStep[];
  accent?: string;
};

/**
 * Subtle progress indicator inspired by Apple checkout flows.
 * Renders a horizontal row of checked/unchecked steps with an
 * animated progress bar underneath.
 */
export function BookingProgress({ steps, accent }: Props) {
  const brand = accent || "currentColor";
  const doneCount = steps.filter((s) => s.done).length;
  const pct = steps.length > 0 ? Math.min(100, (doneCount / steps.length) * 100) : 0;

  return (
    <div className="mb-6 animate-fade-in">
      <div
        className="rounded-2xl border p-4 sm:p-5"
        style={{
          borderColor: `color-mix(in oklab, ${brand} 22%, transparent)`,
          background: `color-mix(in oklab, ${brand} 4%, transparent)`,
        }}
      >
        <div className="flex items-start justify-between gap-2 sm:gap-4">
          {steps.map((s, i) => {
            const isDone = s.done;
            const isActive = !isDone && (s.active ?? (i === doneCount));
            return (
              <div key={s.key} className="flex flex-1 flex-col items-center text-center">
                <div
                  className="relative flex h-7 w-7 items-center justify-center rounded-full border-2 transition-all duration-300 ease-out"
                  style={{
                    borderColor: isDone || isActive ? brand : `color-mix(in oklab, ${brand} 25%, transparent)`,
                    background: isDone ? brand : "transparent",
                    boxShadow: isActive && !isDone ? `0 0 0 4px color-mix(in oklab, ${brand} 15%, transparent)` : undefined,
                  }}
                  aria-current={isActive ? "step" : undefined}
                >
                  {isDone ? (
                    <Check className="h-3.5 w-3.5 animate-scale-in" style={{ color: "#fff" }} strokeWidth={3} />
                  ) : (
                    <span
                      className="h-1.5 w-1.5 rounded-full"
                      style={{ background: isActive ? brand : `color-mix(in oklab, ${brand} 35%, transparent)` }}
                    />
                  )}
                </div>
                <div
                  className="mt-2 text-[10px] font-semibold uppercase tracking-[0.12em] sm:text-[11px] transition-opacity duration-300"
                  style={{
                    color: isDone || isActive ? brand : `color-mix(in oklab, ${brand} 55%, transparent)`,
                    opacity: isDone || isActive ? 1 : 0.7,
                  }}
                >
                  {s.label}
                </div>
              </div>
            );
          })}
        </div>

        <div
          className="mt-4 h-1 overflow-hidden rounded-full"
          style={{ background: `color-mix(in oklab, ${brand} 12%, transparent)` }}
        >
          <div
            className="h-full rounded-full transition-[width] duration-500 ease-out"
            style={{
              width: `${pct}%`,
              background: `linear-gradient(90deg, color-mix(in oklab, ${brand} 70%, transparent), ${brand})`,
            }}
          />
        </div>
      </div>
    </div>
  );
}
