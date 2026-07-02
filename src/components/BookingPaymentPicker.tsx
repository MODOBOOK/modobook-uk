import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo } from "react";
import { getPublicPaymentOptions, type PaymentChoice } from "@/lib/public-booking.functions";
import { CreditCard } from "lucide-react";

type ConfiguredOptions = {
  configured: true;
  cardEnabled: boolean;
  klarnaEnabled: boolean;
  clearpayEnabled: boolean;
  depositEnabled: boolean;
  depositCents: number;
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
};


function formatGBP(pence: number) {
  return `£${(pence / 100).toFixed(2)}`;
}

export function BookingPaymentPicker({ slug, totalAmount, value, onChange, accent, depositOverrideCents }: Props) {
  const fn = useServerFn(getPublicPaymentOptions);
  const q = useQuery({
    queryKey: ["publicPaymentOptions", slug],
    queryFn: () => fn({ data: { slug } }),
  });

  const opts = q.data as ConfiguredOptions | { configured: false } | undefined;
  const configured = opts && "configured" in opts && opts.configured;

  const effectiveDepositCents = useMemo(() => {
    if (!configured) return 0;
    const o = opts as ConfiguredOptions;
    return depositOverrideCents != null && depositOverrideCents > 0 ? depositOverrideCents : o.depositCents;
  }, [configured, opts, depositOverrideCents]);

  const treatmentTotalCents = Math.round(totalAmount * 100);

  const availableModes = useMemo(() => {
    if (!configured) return [] as Array<"deposit" | "full">;
    const arr: Array<"deposit" | "full"> = [];
    const o = opts as ConfiguredOptions;
    if (o.depositEnabled && effectiveDepositCents >= 100 && effectiveDepositCents < treatmentTotalCents) arr.push("deposit");
    if (o.cardEnabled || o.klarnaEnabled || o.clearpayEnabled) arr.push("full");
    return arr;
  }, [configured, opts, effectiveDepositCents, treatmentTotalCents]);


  const availableMethods = useMemo(() => {
    if (!configured) return [] as Array<"card" | "klarna" | "clearpay">;
    const o = opts as ConfiguredOptions;
    const arr: Array<"card" | "klarna" | "clearpay"> = [];
    if (o.cardEnabled) arr.push("card");
    if (o.klarnaEnabled) arr.push("klarna");
    if (o.clearpayEnabled) arr.push("clearpay");
    return arr;
  }, [configured, opts]);

  // Initialise defaults once options load
  useEffect(() => {
    if (!configured || value) return;
    if (availableModes.length === 0 || availableMethods.length === 0) return;
    onChange({
      mode: availableModes.includes("deposit") ? "deposit" : "full",
      method: availableMethods[0],
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [configured, availableModes.join(","), availableMethods.join(",")]);

  // If the externally controlled value is no longer valid (e.g. deposit now equals full price), coerce it.
  useEffect(() => {
    if (!value || !configured) return;
    const chosenMode = availableModes.includes(value.mode) ? value.mode : availableModes[0];
    const chosenMethod = availableMethods.includes(value.method) ? value.method : availableMethods[0];
    const normalizedMode = chosenMode === "deposit" && effectiveDepositCents === treatmentTotalCents ? "full" : chosenMode;
    if (normalizedMode !== value.mode || chosenMethod !== value.method) {
      onChange({ mode: normalizedMode, method: chosenMethod });
    }
  }, [value, configured, availableModes, availableMethods, effectiveDepositCents, treatmentTotalCents, onChange]);

  const chosen = useMemo(() => {
    const mode = value && availableModes.includes(value.mode) ? value.mode : availableModes[0];
    const method = value && availableMethods.includes(value.method) ? value.method : availableMethods[0];
    // When deposit equals the full price, treat it as a full payment.
    const normalizedMode = mode === "deposit" && effectiveDepositCents === treatmentTotalCents ? "full" : mode;
    return { mode: normalizedMode, method };
  }, [value, availableModes, availableMethods, effectiveDepositCents, treatmentTotalCents]);

  if (!configured || availableModes.length === 0 || availableMethods.length === 0) return null;

  const o = opts as ConfiguredOptions;

  const baseCents = chosen.mode === "deposit" ? effectiveDepositCents : treatmentTotalCents;
  const pct = chosen.mode === "deposit"
    ? o.surcharges.depositPercent
    : chosen.method === "card"
      ? o.surcharges.cardPercent
      : o.surcharges.bnplPercent;
  const clinicFeeCents = pct > 0 ? Math.ceil((baseCents * pct) / 100) : 0;

  const isBnpl = chosen.method === "klarna" || chosen.method === "clearpay";
  const stripePct = o.stripeFee.passToPatient ? (isBnpl ? o.stripeFee.bnplPercent : o.stripeFee.cardPercent) : 0;
  const stripeFixed = o.stripeFee.passToPatient ? (isBnpl ? o.stripeFee.bnplFixedCents : o.stripeFee.cardFixedCents) : 0;
  const stripeFeeCents = o.stripeFee.passToPatient
    ? Math.ceil((baseCents * stripePct) / 100) + Math.max(0, stripeFixed)
    : 0;

  const surchargeCents = clinicFeeCents + stripeFeeCents;
  const totalCents = baseCents + surchargeCents;

  const accentColor = accent || "currentColor";
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

  return (
    <div className="rounded-2xl border-2 p-4 sm:p-5" style={cardStyle}>
      <div className="flex items-center gap-2 mb-3">
        <CreditCard className="h-4 w-4" style={headingStyle} />
        <h3 className="text-sm font-semibold tracking-wide uppercase" style={headingStyle}>How would you like to pay?</h3>
      </div>

      {availableModes.length > 1 && (
        <div className="mb-4">
          <div className="text-[11px] uppercase tracking-[0.14em] opacity-60 mb-2">Amount</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {availableModes.includes("deposit") && (
              <button
                type="button"
                onClick={() => onChange({ ...chosen, mode: "deposit" })}
                className="text-left rounded-xl border-2 px-3 py-2.5 transition"
                style={optionStyle(chosen.mode === "deposit")}
              >
                <div className="text-sm font-semibold">Pay deposit</div>
                <div className="text-xs opacity-75">{formatGBP(effectiveDepositCents)} now — balance at your appointment</div>
              </button>
            )}
            {availableModes.includes("full") && (
              <button
                type="button"
                onClick={() => onChange({ ...chosen, mode: "full" })}
                className="text-left rounded-xl border-2 px-3 py-2.5 transition"
                style={optionStyle(chosen.mode === "full")}
              >
                <div className="text-sm font-semibold">Pay in full</div>
                <div className="text-xs opacity-75">£{totalAmount.toFixed(2)} now</div>
              </button>
            )}
          </div>
        </div>
      )}

      {availableMethods.length > 1 && (
        <div>
          <div className="text-[11px] uppercase tracking-[0.14em] opacity-60 mb-2">Method</div>
          <div className="grid grid-cols-3 gap-2">
            {availableMethods.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => onChange({ ...chosen, method: m })}
                className="rounded-xl border-2 px-3 py-2 text-sm font-medium transition"
                style={optionStyle(chosen.method === m)}
              >
                {m === "card" ? "Card" : m === "klarna" ? "Klarna" : "Clearpay"}
              </button>
            ))}
          </div>
        </div>
      )}

      <div
        className="mt-4 pt-3 space-y-1.5 text-sm border-t"
        style={accent ? { borderColor: `color-mix(in oklab, ${accent} 25%, transparent)` } : undefined}
      >
        <div className="flex items-baseline justify-between">
          <span className="opacity-70">{chosen.mode === "deposit" ? "Deposit" : "Subtotal"}</span>
          <span>{formatGBP(baseCents)}</span>
        </div>
        {clinicFeeCents > 0 && (
          <div className="flex items-baseline justify-between">
            <span className="opacity-70">Platform fee ({pct}%)</span>
            <span>{formatGBP(clinicFeeCents)}</span>
          </div>
        )}
        {stripeFeeCents > 0 && (
          <div className="flex items-baseline justify-between">
            <span className="opacity-70">Platform fee</span>
            <span>{formatGBP(stripeFeeCents)}</span>
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
    </div>
  );
}

