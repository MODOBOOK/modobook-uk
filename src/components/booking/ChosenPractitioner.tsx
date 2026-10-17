import { useState } from "react";
import { UserRound } from "lucide-react";

type Pract = { id: string; name?: string | null; active?: boolean | null };
type Link = { practitioner_id: string; treatment_id: string };

/**
 * Shows which practitioner the booking is with, and lets the patient pick
 * (or change) them on the booking page itself.
 *
 * The practitioner decides whose Stripe account takes the deposit, so the
 * choice is always visible here — it can't silently drop between the clinic
 * page and checkout.
 */
export function eligiblePractitioners(
  practitioners: Pract[],
  links: Link[],
  treatmentIds: string[],
  match: "all" | "any" = "all",
) {
  return practitioners.filter((p) => {
    if (p.active === false) return false;
    const mine = new Set(links.filter((l) => l.practitioner_id === p.id).map((l) => l.treatment_id));
    if (mine.size === 0 || treatmentIds.length === 0) return true;
    return match === "all" ? treatmentIds.every((t) => mine.has(t)) : treatmentIds.some((t) => mine.has(t));
  });
}

export function ChosenPractitioner({
  practitioners,
  links,
  treatmentIds,
  match = "all",
  mode,
  value,
  onChange,
  brand,
}: {
  practitioners: Pract[];
  links: Link[];
  treatmentIds: string[];
  match?: "all" | "any";
  mode: "required" | "optional" | "first_available";
  value: string | null;
  onChange: (id: string | null) => void;
  brand: string;
}) {
  const [open, setOpen] = useState(false);
  const eligible = eligiblePractitioners(practitioners, links, treatmentIds, match);
  const active = practitioners.filter((p) => p.active !== false);
  // Single-practitioner clinics have nothing to choose.
  if (active.length <= 1) return null;
  const chosen = value ? practitioners.find((p) => p.id === value) : null;
  const mustChoose = mode === "required" && !chosen;
  const showList = mustChoose || open;
  if (!chosen && mode !== "required" && !open) {
    return (
      <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border bg-card px-4 py-3 text-sm">
        <UserRound className="h-4 w-4 opacity-60" />
        <span className="opacity-80">Practitioner: no preference</span>
        <button type="button" className="ml-auto text-sm font-semibold underline" style={{ color: brand }} onClick={() => setOpen(true)}>
          Choose a practitioner
        </button>
      </div>
    );
  }
  return (
    <div
      className="mb-4 rounded-xl border bg-card px-4 py-3 text-sm"
      style={mustChoose ? { borderColor: brand, borderWidth: 2 } : undefined}
      data-section="booking-practitioner"
    >
      <div className="flex flex-wrap items-center gap-2">
        <UserRound className="h-4 w-4 opacity-60" />
        {chosen ? (
          <span>
            Booking with <strong>{chosen.name ?? "your practitioner"}</strong>
          </span>
        ) : (
          <span className="font-semibold">Choose your practitioner</span>
        )}
        {chosen && eligible.length > 1 && !open && (
          <button type="button" className="ml-auto text-sm font-semibold underline" style={{ color: brand }} onClick={() => setOpen(true)}>
            Change
          </button>
        )}
      </div>
      {showList && (
        <div className="mt-3 flex flex-wrap gap-2">
          {eligible.map((p) => {
            const picked = p.id === value;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  onChange(p.id);
                  setOpen(false);
                }}
                className="rounded-full border px-4 py-1.5 text-sm font-semibold transition"
                style={picked ? { backgroundColor: brand, borderColor: brand, color: "#fff" } : { borderColor: `${brand}66`, color: brand }}
              >
                {p.name ?? "Practitioner"}
              </button>
            );
          })}
          {mode !== "required" && (
            <button
              type="button"
              onClick={() => {
                onChange(null);
                setOpen(false);
              }}
              className="rounded-full border px-4 py-1.5 text-sm"
            >
              No preference
            </button>
          )}
          {eligible.length === 0 && <p className="text-sm opacity-70">No practitioner currently offers this treatment.</p>}
        </div>
      )}
    </div>
  );
}
