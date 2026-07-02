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
};

function formatGBP(pence: number) {
  return `£${(pence / 100).toFixed(2)}`;
}

export function BookingPaymentPicker({ slug, totalAmount, value, onChange, accent }: Props) {
  const fn = useServerFn(getPublicPaymentOptions);
  const q = useQuery({
    queryKey: ["publicPaymentOptions", slug],
    queryFn: () => fn({ data: { slug } }),
  });

  const opts = q.data as ConfiguredOptions | { configured: false } | undefined;
  const configured = opts && "configured" in opts && opts.configured;

  const availableModes = useMemo(() => {
    if (!configured) return [] as Array<"deposit" | "full">;
    const arr: Array<"deposit" | "full"> = [];
    const o = opts as ConfiguredOptions;
    if (o.depositEnabled && o.depositCents >= 100) arr.push("deposit");
    if (o.cardEnabled || o.klarnaEnabled || o.clearpayEnabled) arr.push("full");
    return arr;
  }, [configured, opts]);

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

  if (!configured || availableModes.length === 0 || availableMethods.length === 0) return null;

  const o = opts as ConfiguredOptions;
  const chosen = value ?? {
    mode: availableModes[0],
    method: availableMethods[0],
  };

  const baseCents = chosen.mode === "deposit" ? o.depositCents : Math.round(totalAmount * 100);
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

  const styleAccent = accent ? { borderColor: accent, color: accent } : undefined;

  return (
    <div className="rounded-2xl border bg-background/60 p-4 sm:p-5">
      <div className="flex items-center gap-2 mb-3">
        <CreditCard className="h-4 w-4 opacity-70" />
        <h3 className="text-sm font-semibold">How would you like to pay?</h3>
      </div>

      {availableModes.length > 1 && (
        <div className="mb-4">
          <div className="text-xs uppercase tracking-wide opacity-60 mb-2">Amount</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {availableModes.includes("deposit") && (
              <button
                type="button"
                onClick={() => onChange({ ...chosen, mode: "deposit" })}
                className={`text-left rounded-lg border px-3 py-2 transition ${chosen.mode === "deposit" ? "ring-2" : "opacity-80 hover:opacity-100"}`}
                style={chosen.mode === "deposit" ? styleAccent : undefined}
              >
                <div className="text-sm font-medium">Pay deposit</div>
                <div className="text-xs opacity-70">{formatGBP(o.depositCents)} now — balance at your appointment</div>
              </button>
            )}
            {availableModes.includes("full") && (
              <button
                type="button"
                onClick={() => onChange({ ...chosen, mode: "full" })}
                className={`text-left rounded-lg border px-3 py-2 transition ${chosen.mode === "full" ? "ring-2" : "opacity-80 hover:opacity-100"}`}
                style={chosen.mode === "full" ? styleAccent : undefined}
              >
                <div className="text-sm font-medium">Pay in full</div>
                <div className="text-xs opacity-70">£{totalAmount.toFixed(2)} now</div>
              </button>
            )}
          </div>
        </div>
      )}

      {availableMethods.length > 1 && (
        <div>
          <div className="text-xs uppercase tracking-wide opacity-60 mb-2">Method</div>
          <div className="grid grid-cols-3 gap-2">
            {availableMethods.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => onChange({ ...chosen, method: m })}
                className={`rounded-lg border px-3 py-2 text-sm transition ${chosen.method === m ? "ring-2" : "opacity-80 hover:opacity-100"}`}
                style={chosen.method === m ? styleAccent : undefined}
              >
                {m === "card" ? "Card" : m === "klarna" ? "Klarna" : "Clearpay"}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="mt-4 border-t pt-3 space-y-1.5 text-sm">
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
            <span className="opacity-70">
              Card processing ({stripePct}%{stripeFixed > 0 ? ` + ${formatGBP(stripeFixed)}` : ""})
            </span>
            <span>{formatGBP(stripeFeeCents)}</span>
          </div>
        )}
        <div className="flex items-baseline justify-between border-t pt-2 mt-1">
          <span className="font-medium">{chosen.mode === "deposit" ? "Deposit today" : "Total today"}</span>
          <span className="text-lg font-semibold">{formatGBP(totalCents)}</span>
        </div>
      </div>
    </div>
  );
}
