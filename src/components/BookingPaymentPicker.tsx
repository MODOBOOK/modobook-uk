import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo } from "react";
import { getPublicPaymentOptions, type PaymentChoice } from "@/lib/public-booking.functions";
import { CreditCard, ShieldCheck } from "lucide-react";
import { platformFeeCents, PLATFORM_FEE_LABEL } from "@/lib/platform-fee";

type BookingMode = "deposit" | "full" | "cash" | "cash_deposit" | "card_capture";

const DEFAULT_POLICY =
  "I authorise the clinic to securely store my card details and to charge the cancellation or no-show fee set out in their booking policy if I cancel late or do not attend.";

type ConfiguredOptions = {
  configured: true;
  requireDepositToConfirm: boolean;
  cardEnabled: boolean;
  fullCardEnabled: boolean;
  klarnaEnabled: boolean;
  clearpayEnabled: boolean;
  depositEnabled: boolean;
  cashEnabled: boolean;
  cashOnlyBalance: boolean;
  allowPayInClinic: boolean;
  cardCaptureEnabled: boolean;
  cardCapturePolicy: string | null;
  depositCents: number;
  depositType: "fixed" | "percent";
  depositPercent: number;
  passFees: boolean;
  surcharges: { cardPercent: number; bnplPercent: number; depositPercent: number };
  stripeFee: {
    passToPatient: boolean;
    cardPercent: number;
    cardFixedCents: number;
    bnplPercent: number;
    bnplFixedCents: number;
  };
};



type Props = {
  slug: string;
  totalAmount: number; // in currency units (£)
  value: PaymentChoice | null;
  onChange: (choice: PaymentChoice | null) => void;
  accent?: string;
  /** Optional per-treatment deposit total in pence, overrides clinic default. */
  depositOverrideCents?: number | null;
  /** When set, totalAmount is treated as the per-session amount for a split plan.
   *  Optional remainingPerSessionCents overrides the "then £X per session" copy
   *  (useful when only some treatments are split). */
  splitInfo?: { sessionCount: number; remainingPerSessionCents?: number } | null;
};


function formatGBP(pence: number) {
  return `£${(pence / 100).toFixed(2)}`;
}

export function BookingPaymentPicker({ slug, totalAmount, value, onChange, accent, depositOverrideCents, splitInfo }: Props) {
  const fn = useServerFn(getPublicPaymentOptions);
  const q = useQuery({
    queryKey: ["publicPaymentOptions", slug],
    queryFn: () => fn({ data: { slug } }),
  });

  const opts = q.data as ConfiguredOptions | { configured: false } | undefined;
  const configured = opts && "configured" in opts && opts.configured;

  const treatmentTotalCents = Math.round(totalAmount * 100);

  // Only a positive treatment-level amount counts as an override. The column
  // historically defaulted to 0, which must NOT waive the clinic deposit.
  const effectiveOverride = depositOverrideCents != null && depositOverrideCents > 0 ? depositOverrideCents : null;
  const depositWaived = false;

  const effectiveDepositCents = useMemo(() => {
    if (!configured) return 0;
    if (depositWaived) return 0;
    const o = opts as ConfiguredOptions;
    if (effectiveOverride != null) return effectiveOverride;
    if (o.depositType === "percent" && o.depositPercent > 0) {
      return Math.round((treatmentTotalCents * o.depositPercent) / 100);
    }
    return o.depositCents;
  }, [configured, opts, depositOverrideCents, depositWaived, treatmentTotalCents]);


  const availableModes = useMemo(() => {
    if (!configured) return [] as BookingMode[];
    const arr: BookingMode[] = [];
    const o = opts as ConfiguredOptions;
    // If the deposit equals or exceeds the treatment total, the deposit
    // effectively IS the full payment — hide the deposit option and only
    // offer "Pay in full".
    const depositMakesSense = !depositWaived && o.depositEnabled && effectiveDepositCents >= 100 && effectiveDepositCents < treatmentTotalCents;
    if (o.requireDepositToConfirm && !depositWaived) {
      if (depositMakesSense) arr.push("deposit");
      if (o.fullCardEnabled || o.klarnaEnabled || o.clearpayEnabled) arr.push("full");
      // Card on file secures the booking without charging now — a valid
      // alternative to a deposit when the clinic offers it.
      if (o.cardCaptureEnabled && o.cardEnabled) arr.push("card_capture");
      // Even when a deposit is required, honour the clinic's explicit
      // "Allow pay in clinic" setting so patients can still choose cash.
      if (o.cashEnabled || arr.length === 0) arr.push("cash");
      return arr;
    }
    if (depositMakesSense) arr.push("deposit");
    if (o.fullCardEnabled || o.klarnaEnabled || o.clearpayEnabled) arr.push("full");
    if (o.cardCaptureEnabled && o.cardEnabled) arr.push("card_capture");
    // Respect the clinic's "Allow pay in clinic" setting. A waived deposit no
    // longer forces the cash option on — it's only used as a last resort when
    // no online option is available at all, so booking can still complete.
    if (o.cashEnabled || arr.length === 0) arr.push("cash");
    return arr;
  }, [configured, opts, depositWaived, effectiveDepositCents, treatmentTotalCents]);



  // "Pay in full in cash" is governed by the clinic's own "Allow pay in
  // clinic" toggle — independent of deposits.
  const cashFullAvailable = !!configured && (opts as ConfiguredOptions).allowPayInClinic !== false;
  // "Pay deposit now, rest in cash" is available whenever the clinic takes
  // deposits, accepts cash at the clinic (either toggle) and the deposit is
  // smaller than the total.
  const cashDepositAvailable = !!configured
    && !depositWaived
    && !!(opts as ConfiguredOptions).depositEnabled
    && effectiveDepositCents >= 100
    && effectiveDepositCents < treatmentTotalCents
    && (cashFullAvailable || !!(opts as ConfiguredOptions).cashOnlyBalance);

  // Methods depend on the selected mode: deposits are always card-only
  // (Klarna/Clearpay can't save a reusable card on file). Full payments allow
  // any method the clinic has enabled.
  const availableMethods = useMemo(() => {
    if (!configured) return [] as Array<"card" | "klarna" | "clearpay">;
    const o = opts as ConfiguredOptions;
    const mode = value?.mode ?? availableModes[0];
    if (mode === "deposit" || mode === "cash_deposit" || mode === "card_capture") {
      return o.cardEnabled ? (["card"] as Array<"card" | "klarna" | "clearpay">) : [];
    }
    const arr: Array<"card" | "klarna" | "clearpay"> = [];
    // Card in "pay in full" mode is governed by its own toggle — a clinic can
    // take card deposits while keeping full payments Klarna/Clearpay only.
    if (o.fullCardEnabled) arr.push("card");
    if (o.klarnaEnabled) arr.push("klarna");
    if (o.clearpayEnabled) arr.push("clearpay");
    return arr;
  }, [configured, opts, value?.mode, availableModes]);

  // If the externally controlled value is no longer valid, coerce it. Required
  // deposits are always deposit + card so the server can take payment and save
  // the reusable card before the appointment is confirmed.
  useEffect(() => {
    if (!configured) return;
    // Free bookings (£0) skip payment entirely — clear any stale choice.
    if (treatmentTotalCents <= 0) {
      if (value) onChange(null);
      return;
    }
    const o = opts as ConfiguredOptions;
    if (!value && !depositWaived && o.requireDepositToConfirm && o.depositEnabled && availableMethods.includes("card")) {
      onChange({ mode: "deposit", method: "card" });
      return;
    }
    if (value?.mode === "deposit" && !depositWaived && o.requireDepositToConfirm && o.depositEnabled && availableMethods.includes("card")) {
      if (value?.mode !== "deposit" || value.method !== "card") {
        onChange({ mode: "deposit", method: "card" });
      }
      return;
    }
    if (!value) return;
    const chosenMode = value.mode === "cash_deposit"
      ? (cashDepositAvailable ? "cash_deposit" : (availableModes.includes("cash") ? "cash" : availableModes[0]))
      : availableModes.includes(value.mode) ? value.mode : availableModes[0];
    // Cash mode doesn't need a method; keep any prior method for stability.
    const needsMethod = chosenMode !== "cash" && chosenMode !== "card_capture";
    const chosenMethod = availableMethods.includes(value.method)
      ? value.method
      : (availableMethods[0] ?? value.method);
    const normalizedMode = chosenMode === "deposit" && effectiveDepositCents === treatmentTotalCents ? "full" : chosenMode;
    if (!chosenMode || (needsMethod && !chosenMethod)) {
      onChange(null);
    } else if (normalizedMode !== value.mode || chosenMethod !== value.method) {
      onChange({ ...value, mode: normalizedMode, method: chosenMethod });
    }
  }, [value, configured, opts, availableModes, availableMethods, effectiveDepositCents, treatmentTotalCents, depositWaived, onChange]);


  const chosen = useMemo(() => {
    if (!value) return null;
    const o = opts as ConfiguredOptions;
    if (value.mode === "deposit" && !depositWaived && o.requireDepositToConfirm && o.depositEnabled && availableMethods.includes("card")) {
      return { mode: "deposit" as const, method: "card" as const };
    }
    const mode = value.mode === "cash_deposit"
      ? (cashDepositAvailable ? ("cash_deposit" as const) : ((availableModes.includes("cash") ? "cash" : availableModes[0]) ?? "full"))
      : availableModes.includes(value.mode) ? value.mode : (availableModes[0] ?? "full");
    const method = availableMethods.includes(value.method) ? value.method : (availableMethods[0] ?? "card");
    // When deposit equals the full price, treat it as a full payment.
    const normalizedMode = mode === "deposit" && effectiveDepositCents === treatmentTotalCents ? "full" : mode;
    return { mode: normalizedMode, method, policyAgreed: value.policyAgreed === true };
  }, [value, opts, availableModes, availableMethods, depositWaived, effectiveDepositCents, treatmentTotalCents, cashDepositAvailable]);


  if (!configured || availableModes.length === 0) return null;
  // Method picker only required when at least one non-cash mode is available.
  const hasNonCashMode = availableModes.some((m) => m !== "cash");
  if (hasNonCashMode && availableMethods.length === 0) return null;
  // Free bookings (£0) skip payment entirely — no platform/processing fees.
  if (treatmentTotalCents <= 0) return null;

  const o = opts as ConfiguredOptions;
  const forceDepositCard = !depositWaived && o.requireDepositToConfirm && chosen?.mode === "deposit";

  const baseCents = chosen?.mode === "deposit" || chosen?.mode === "cash_deposit" ? effectiveDepositCents : treatmentTotalCents;
  // One uniform platform fee across every online payment method. Cash / pay in
  // clinic never carries it, and neither does a card-capture-only booking.
  const isOnlinePayment = !!chosen && chosen.mode !== "cash";
  const surchargeCents = isOnlinePayment ? platformFeeCents(baseCents, o.passFees) : 0;
  const totalCents = chosen ? baseCents + surchargeCents : 0;

  
  const cardStyle: React.CSSProperties = accent
    ? {
        borderColor: `color-mix(in oklab, ${accent} 40%, transparent)`,
        background: `color-mix(in oklab, ${accent} 6%, hsl(var(--background)))`,
        boxShadow: `0 1px 0 color-mix(in oklab, ${accent} 12%, transparent), 0 10px 30px -18px color-mix(in oklab, ${accent} 45%, transparent)`,
      }
    : {};
  const headingStyle: React.CSSProperties = accent ? { color: accent } : {};

  const optionStyle = (selected: boolean): React.CSSProperties => {
    if (!accent) return {};
    if (selected) {
      return {
        borderColor: accent,
        background: `color-mix(in oklab, ${accent} 14%, transparent)`,
        color: accent,
        boxShadow: `inset 0 0 0 1px ${accent}`,
      };
    }
    return {
      borderColor: `color-mix(in oklab, ${accent} 22%, transparent)`,
      background: `color-mix(in oklab, ${accent} 3%, transparent)`,
    };
  };

  const selectMode = (mode: BookingMode) => {
    const method = (mode === "deposit" && o.requireDepositToConfirm && availableMethods.includes("card")) || mode === "cash_deposit"
      ? "card"
      : availableMethods[0] ?? "card";
    if (!chosen) {
      onChange({ mode, method });
    } else {
      onChange({
        ...chosen,
        mode,
        method: mode === "deposit" || mode === "cash_deposit" || mode === "card_capture" ? method : chosen.method,
        // Consent is specific to the card-capture option; drop it otherwise.
        policyAgreed: mode === "card_capture" ? chosen.policyAgreed === true : undefined,
      });
    }
  };

  const selectMethod = (method: "card" | "klarna" | "clearpay") => {
    if (!chosen) {
      onChange({ mode: availableModes[0] ?? "full", method });
    } else {
      onChange({ ...chosen, method });
    }
  };

  const isCash = chosen?.mode === "cash";
  const isCashDeposit = chosen?.mode === "cash_deposit";
  const isCardCapture = chosen?.mode === "card_capture";
  const policyText = (o.cardCapturePolicy ?? "").trim() || DEFAULT_POLICY;

  return (
    <div className="rounded-2xl border-2 p-4 sm:p-5" style={cardStyle}>
      <div className="flex items-center gap-2 mb-3">
        <CreditCard className="h-4 w-4" style={headingStyle} />
        <h3 className="text-sm font-semibold tracking-wide uppercase" style={headingStyle}>How would you like to pay?</h3>
      </div>

      {availableModes.length > 0 && (
        <div className="mb-4">
          <div className="text-[11px] uppercase tracking-[0.14em] opacity-60 mb-2">Amount</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {availableModes.includes("deposit") && (
              <button
                type="button"
                onClick={() => selectMode("deposit")}
                className="text-left rounded-xl border-2 px-3 py-2.5 transition"
                style={optionStyle(chosen?.mode === "deposit")}
              >
                <div className="text-sm font-semibold">Pay deposit</div>
                <div className="text-xs opacity-75">{formatGBP(effectiveDepositCents)} now — card saved securely for the clinic's booking policy</div>
              </button>
            )}
            {availableModes.includes("full") && (
              <button
                type="button"
                onClick={() => selectMode("full")}
                className="text-left rounded-xl border-2 px-3 py-2.5 transition"
                style={optionStyle(chosen?.mode === "full")}
              >
                <div className="text-sm font-semibold">{splitInfo ? "Pay per session" : "Pay in full"}</div>
                <div className="text-xs opacity-75">
                  £{totalAmount.toFixed(2)} now{splitInfo ? ` — then £${((splitInfo.remainingPerSessionCents ?? Math.round(totalAmount * 100)) / 100).toFixed(2)} at each of your remaining ${splitInfo.sessionCount - 1} session${splitInfo.sessionCount - 1 === 1 ? "" : "s"}` : ""}
                </div>
              </button>
            )}
            {availableModes.includes("card_capture") && (
              <button
                type="button"
                onClick={() => selectMode("card_capture")}
                className="text-left rounded-xl border-2 px-3 py-2.5 transition sm:col-span-2"
                style={optionStyle(isCardCapture)}
              >
                <div className="text-sm font-semibold flex items-center gap-1.5">
                  <ShieldCheck className="h-3.5 w-3.5" /> Secure with card details
                </div>
                <div className="text-xs opacity-75">
                  Nothing charged today — your card is stored securely and only used if the clinic's cancellation policy applies.
                </div>
              </button>
            )}
            {availableModes.includes("cash") && (
              <button
                type="button"
                onClick={() => selectMode("cash")}
                className="text-left rounded-xl border-2 px-3 py-2.5 transition sm:col-span-2"
                style={optionStyle(chosen?.mode === "cash" || chosen?.mode === "cash_deposit")}
              >
                <div className="text-sm font-semibold">Pay in cash at your appointment</div>
                <div className="text-xs opacity-75">
                  {cashDepositAvailable
                    ? "Choose below: secure with a deposit now, or pay the full amount in cash on the day."
                    : `Nothing to pay now — please bring £${totalAmount.toFixed(2)} in cash on the day.`}
                </div>
              </button>
            )}
          </div>
          {(chosen?.mode === "cash" || chosen?.mode === "cash_deposit") && cashDepositAvailable && (
            <div className="mt-2 space-y-2">
              {([
                {
                  mode: "cash_deposit" as const,
                  title: `Pay ${formatGBP(effectiveDepositCents)} deposit now`,
                  sub: `Card payment today — remaining ${formatGBP(treatmentTotalCents - effectiveDepositCents)} in cash on the day.`,
                },
                {
                  mode: "cash" as const,
                  title: "Pay in full in cash",
                  sub: `Nothing to pay now — please bring ${formatGBP(treatmentTotalCents)} in cash on the day.`,
                },
              ]).map((opt) => {
                const selected = chosen?.mode === opt.mode;
                return (
                  <button
                    key={opt.mode}
                    type="button"
                    onClick={() => selectMode(opt.mode)}
                    className="w-full text-left rounded-xl border-2 px-3 py-2.5 transition flex items-start gap-2.5"
                    style={optionStyle(selected)}
                  >
                    <span
                      className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2"
                      style={accent ? { borderColor: accent } : {}}
                    >
                      {selected && (
                        <span className="h-2 w-2 rounded-full" style={accent ? { background: accent } : { background: "currentColor" }} />
                      )}
                    </span>
                    <span>
                      <span className="block text-sm font-semibold">{opt.title}</span>
                      <span className="block text-xs opacity-75">{opt.sub}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {!isCash && !isCardCapture && availableMethods.length > 0 && (
        <div>
          <div className="text-[11px] uppercase tracking-[0.14em] opacity-60 mb-2">Method</div>
          <div className="grid grid-cols-3 gap-2">
            {availableMethods.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => selectMethod(m)}
                disabled={forceDepositCard && m !== "card"}
                className="rounded-xl border-2 px-3 py-2 text-sm font-medium transition"
                style={optionStyle(chosen?.method === m)}
              >
                {m === "card" ? "Card" : m === "klarna" ? "Klarna" : "Clearpay"}
              </button>
            ))}
          </div>
        </div>
      )}

      {isCardCapture && (
        <label
          className="mt-4 flex items-start gap-2.5 rounded-xl border-2 px-3 py-2.5 text-xs leading-relaxed cursor-pointer"
          style={optionStyle(chosen?.policyAgreed === true)}
        >
          <input
            type="checkbox"
            className="mt-0.5 h-4 w-4 shrink-0"
            checked={chosen?.policyAgreed === true}
            onChange={(e) =>
              onChange({ mode: "card_capture", method: "card", policyAgreed: e.target.checked })
            }
          />
          <span>{policyText}</span>
        </label>
      )}

      {chosen ? (
        isCardCapture ? (
          <div
            className="mt-4 pt-3 text-sm border-t"
            style={accent ? { borderColor: `color-mix(in oklab, ${accent} 25%, transparent)` } : undefined}
          >
            <div className="flex items-baseline justify-between">
              <span className="font-medium">Due today</span>
              <span className="text-lg font-bold" style={headingStyle}>£0.00</span>
            </div>
            <p className="mt-1 text-xs opacity-70">
              {chosen.policyAgreed
                ? `You'll be taken to a secure Stripe page to save your card. ${formatGBP(treatmentTotalCents)} is due at your appointment.`
                : "Please tick the box above to continue."}
            </p>
          </div>
        ) : isCash ? (
          <div
            className="mt-4 pt-3 text-sm border-t"
            style={accent ? { borderColor: `color-mix(in oklab, ${accent} 25%, transparent)` } : undefined}
          >
            <div className="flex items-baseline justify-between">
              <span className="font-medium">Due at appointment</span>
              <span className="text-lg font-bold" style={headingStyle}>{formatGBP(treatmentTotalCents)}</span>
            </div>
            <p className="mt-1 text-xs opacity-70">You won't be charged online. Please bring cash on the day.</p>
          </div>
        ) : isCashDeposit ? (
          <div
            className="mt-4 pt-3 space-y-1.5 text-sm border-t"
            style={accent ? { borderColor: `color-mix(in oklab, ${accent} 25%, transparent)` } : undefined}
          >
            <div className="flex items-baseline justify-between">
              <span className="opacity-70">Deposit</span>
              <span>{formatGBP(effectiveDepositCents)}</span>
            </div>
            {surchargeCents > 0 && (
              <div className="flex items-baseline justify-between">
                <span className="opacity-70">{PLATFORM_FEE_LABEL}</span>
                <span>{formatGBP(surchargeCents)}</span>
              </div>
            )}
            <div
              className="flex items-baseline justify-between border-t pt-2 mt-1"
              style={accent ? { borderColor: `color-mix(in oklab, ${accent} 25%, transparent)` } : undefined}
            >
              <span className="font-medium">Deposit today</span>
              <span className="text-lg font-bold" style={headingStyle}>{formatGBP(totalCents)}</span>
            </div>
            <p className="mt-1 text-xs opacity-70">
              Remaining {formatGBP(treatmentTotalCents - effectiveDepositCents)} to pay in cash at your appointment.
            </p>
          </div>
        ) : (
          <div
            className="mt-4 pt-3 space-y-1.5 text-sm border-t"
            style={accent ? { borderColor: `color-mix(in oklab, ${accent} 25%, transparent)` } : undefined}
          >
            <div className="flex items-baseline justify-between">
              <span className="opacity-70">{chosen.mode === "deposit" ? "Deposit" : "Subtotal"}</span>
              <span>{formatGBP(baseCents)}</span>
            </div>
            {surchargeCents > 0 && (
              <div className="flex items-baseline justify-between">
                <span className="opacity-70">{PLATFORM_FEE_LABEL}</span>
                <span>{formatGBP(surchargeCents)}</span>
              </div>
            )}
            <div
              className="flex items-baseline justify-between border-t pt-2 mt-1"
              style={accent ? { borderColor: `color-mix(in oklab, ${accent} 25%, transparent)` } : undefined}
            >
              <span className="font-medium">{chosen.mode === "deposit" ? "Deposit today" : "Total today"}</span>
              <span className="text-lg font-bold" style={headingStyle}>{formatGBP(totalCents)}</span>
            </div>
          </div>
        )
      ) : (
        <div
          className="mt-4 pt-3 text-sm border-t"
          style={accent ? { borderColor: `color-mix(in oklab, ${accent} 25%, transparent)` } : undefined}
        >
          <p className="opacity-70">Select an option above to see the total.</p>
        </div>
      )}
    </div>
  );

}


