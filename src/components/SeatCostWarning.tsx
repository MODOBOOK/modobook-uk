import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { AlertTriangle } from "lucide-react";

const money = (cents: number, currency = "gbp") =>
  new Intl.NumberFormat("en-GB", { style: "currency", currency: currency.toUpperCase() }).format((cents ?? 0) / 100);



export type SeatSummary = {
  comped: boolean;
  trialActive: boolean;
  liveSub: boolean;
  currency: string;
  interval: string;
  nextBillingDate: string | null;
  monthlyTotalCents: number;
  practitioners: { used: number; allowed: number; freeExtras: number; billable: number; addonCents: number };
  locations: { used: number; allowed: number; freeExtras: number; billable: number; addonCents: number };
  associates?: {
    enabled: boolean;
    used: number;
    included: number;
    blockSize?: number;
    covered?: number;
    billable: number;
    moduleCents: number;
    moduleActive: boolean;
    addonCents: number;
  };
};

export type SeatKind = "location" | "practitioner" | "associate";

/** What adding one more seat of this kind would add to the plan, in cents. */
export function seatChargeCents(seats: SeatSummary | null, kind: SeatKind) {
  if (!seats || seats.comped) return 0;
  if (kind === "associate") {
    const a = seats.associates;
    if (!a) return 0;
    const moduleCents = a.moduleActive ? 0 : a.moduleCents; // first time switches the service on
    // Seats are sold in blocks: the module covers the first block, and every
    // further block of 5 associates costs one add-on fee.
    const covered = a.covered ?? a.included;
    const seatCents = a.used + 1 > covered ? a.addonCents : 0;
    return moduleCents + seatCents;
  }
  if (kind === "location" && FREE_EXTRA_LOCATIONS) return 0; // promo: extra locations free
  const s = kind === "location" ? seats.locations : seats.practitioners;
  return s.used + 1 > 1 + s.freeExtras ? s.addonCents : 0;
}

/** True when creating one more seat of this kind would add a charge. */
export function seatWillCharge(seats: SeatSummary | null, kind: SeatKind) {
  return seatChargeCents(seats, kind) > 0;
}


/**
 * Shown before a practitioner adds a chargeable extra location or team member.
 * The plan price is collated from what's on the account, so this is the moment
 * to be explicit about the new total and when it will actually be collected.
 */
export function SeatCostWarning({
  open,
  onOpenChange,
  kind,
  seats,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  kind: SeatKind;
  seats: SeatSummary | null;
  onConfirm: () => void;
}) {
  if (!seats) return null;
  const isAssoc = kind === "associate";
  const a = seats.associates;
  const s = kind === "location" ? seats.locations : seats.practitioners;
  const noun = isAssoc ? "associate" : kind === "location" ? "location" : "practitioner";
  const delta = seatChargeCents(seats, kind);
  const newTotal = seats.monthlyTotalCents + delta;
  const when = seats.nextBillingDate ? new Date(seats.nextBillingDate).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) : null;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-600" />
            This adds {money(delta, seats.currency)} to your plan
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3 text-sm">
              {isAssoc && a ? (
                <p>
                  {a.moduleActive ? null : (
                    <>
                      Turning on the Associates service adds <strong>{money(a.moduleCents, seats.currency)}</strong>/
                      {seats.interval} to your plan, which covers your first {a.included} associates.{" "}
                    </>
                  )}
                  You currently have {a.used} associate{a.used === 1 ? "" : "s"}.
                  {a.used + 1 > (a.covered ?? a.included) ? (
                    <>
                      {" "}That's beyond the {a.covered ?? a.included} you're covered for, so this unlocks the next block
                      of {a.blockSize ?? 5} associates for a further{" "}
                      <strong>{money(a.addonCents, seats.currency)}</strong>/{seats.interval}.
                    </>
                  ) : (
                    <>
                      {" "}This one is covered — every further block of {a.blockSize ?? 5} associates adds{" "}
                      {money(a.addonCents, seats.currency)}/{seats.interval}.
                    </>
                  )}
                </p>
              ) : (
                <p>
                  You currently have {s.used} {noun}
                  {s.used === 1 ? "" : "s"}. Your plan includes {1 + s.freeExtras} at no extra cost, so adding another
                  {" "}{noun} adds an extra {noun} seat at{" "}
                  <strong>{money(s.addonCents, seats.currency)}</strong>/{seats.interval}.
                </p>
              )}

              <div className="rounded-lg border bg-muted/50 p-3">
                <div className="flex items-center justify-between">
                  <span>Plan today</span>
                  <span>{money(seats.monthlyTotalCents, seats.currency)}/{seats.interval}</span>
                </div>
                <div className="mt-1 flex items-center justify-between font-medium text-foreground">
                  <span>New total</span>
                  <span>{money(newTotal, seats.currency)}/{seats.interval}</span>
                </div>
              </div>
              {seats.liveSub ? (
                <p>
                  Nothing is charged today. Your direct debit updates automatically and collects the new amount from
                  your next billing date{when ? ` (${when})` : ""}.
                </p>
              ) : seats.trialActive ? (
                <p>
                  You're still on your free trial, so nothing is charged now — the seat is reserved and included when
                  your direct debit starts{when ? ` on ${when}` : ""}.
                </p>
              ) : (
                <p>The seat is added to your plan and billed when your direct debit is set up.</p>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>Add {noun} &amp; update plan</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
