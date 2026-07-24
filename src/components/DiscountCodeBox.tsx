import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { validateDiscountCode } from "@/lib/discounts.functions";
import { previewGiftCardCode } from "@/lib/gift-cards.functions";
import { previewPointsRedemption } from "@/lib/rewards.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tag, X, CheckCircle2, Gift, Sparkles } from "lucide-react";

export type AppliedDiscount = {
  id: string;
  code: string;
  kind: "percent" | "fixed";
  amount: number;
  applies_to_treatment_ids: string[];
  /** When set, this is a gift card and should be redeemed after booking. */
  giftCardPurchaseId?: string;
  isGiftCard?: boolean;
  /** When set, this is a points redemption; consume after booking. */
  isPointsRedemption?: boolean;
  pointsToUse?: number;
};


export function DiscountCodeBox({
  slug,
  treatmentIds,
  packageIds,
  total,
  brand,
  value,
  onChange,
}: {
  slug: string;
  treatmentIds: string[];
  packageIds?: string[];
  /** Current cart total, used to preview gift card credit. */
  total?: number;
  brand?: string;
  value: AppliedDiscount | null;
  onChange: (d: AppliedDiscount | null) => void;
}) {
  const validate = useServerFn(validateDiscountCode);
  const previewGc = useServerFn(previewGiftCardCode);
  const previewPoints = useServerFn(previewPointsRedemption);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function apply() {
    const raw = code.trim();
    if (!raw) return;
    setBusy(true);
    setError(null);
    try {
      // 1) Try discount codes first.
      const res = (await validate({
        data: { slug, code: raw, treatment_ids: treatmentIds },
      })) as AppliedDiscount | null;
      if (res && res.applies_to_treatment_ids?.length) {
        onChange({
          id: res.id,
          code: res.code,
          kind: res.kind,
          amount: Number(res.amount),
          applies_to_treatment_ids: res.applies_to_treatment_ids,
        });
        setCode("");
        return;
      }

      // 2) Fall back to gift card codes.
      const gc = (await previewGc({
        data: {
          slug,
          code: raw,
          total: Math.max(0, Number(total ?? 0)),
          treatment_ids: treatmentIds,
          package_ids: packageIds ?? [],
        },
      })) as
        | { id: string; code: string; kind: "value" | "treatment" | "package"; remaining: number; applied: number }
        | { error: string };
      if (!("error" in gc)) {
        onChange({
          id: gc.id,
          code: gc.code,
          kind: "fixed",
          amount: Number(gc.applied),
          // Apply against every treatment in the cart so downstream math treats
          // the gift card credit as a flat amount off the total.
          applies_to_treatment_ids: treatmentIds,
          giftCardPurchaseId: gc.id,
          isGiftCard: true,
        });
        setCode("");
        return;
      }

      // 3) Fall back to the signed-in patient's own referral code — redeem
      //    their loyalty points balance against this booking.
      try {
        const pts = await previewPoints({
          data: {
            slug,
            code: raw,
            totalPennies: Math.max(0, Math.round(Number(total ?? 0) * 100)),
          },
        });
        if (pts?.ok) {
          onChange({
            id: `points-${pts.code}`,
            code: pts.code,
            kind: "fixed",
            amount: pts.pennies / 100,
            applies_to_treatment_ids: treatmentIds,
            isPointsRedemption: true,
            pointsToUse: pts.pointsToUse,
          });
          setCode("");
          return;
        }
      } catch { /* fall through to error */ }

      setError(res ? "This code doesn't apply to your selected treatments." : gc.error);
    } catch (e) {
      setError((e as Error).message || "Could not validate code");
    } finally {
      setBusy(false);
    }
  }


  if (value) {
    const isGift = value.isGiftCard;
    const isPts = value.isPointsRedemption;
    return (
      <div className="flex items-center justify-between gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5">
        <div className="flex min-w-0 items-center gap-2 text-sm text-emerald-800">
          {isPts ? <Sparkles className="h-4 w-4 shrink-0" /> : isGift ? <Gift className="h-4 w-4 shrink-0" /> : <CheckCircle2 className="h-4 w-4 shrink-0" />}
          <span className="truncate">
            <span className="font-semibold">{value.code}</span>{" "}
            {isPts
              ? `points redeemed · £${value.amount.toFixed(2)} off${value.pointsToUse ? ` (${value.pointsToUse} pts)` : ""}`
              : isGift
              ? `gift card · £${value.amount.toFixed(2)} credit`
              : `applied · ${value.kind === "percent" ? `${value.amount}% off` : `£${value.amount.toFixed(2)} off`}`}
          </span>
        </div>

        <button
          type="button"
          onClick={() => onChange(null)}
          className="rounded-full p-1 text-emerald-700 hover:bg-emerald-100"
          aria-label="Remove code"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <div>
      <Label className="mb-1.5 flex items-center gap-1.5 text-sm">
        <Tag className="h-3.5 w-3.5" /> Promo or gift card code <span className="text-xs opacity-50">(optional)</span>
      </Label>
      <div className="flex gap-2">
        <Input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="Enter code"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void apply();
            }
          }}
        />
        <Button
          type="button"
          variant="outline"
          disabled={busy || !code.trim()}
          onClick={apply}
          style={brand ? { borderColor: `${brand}55`, color: brand } : undefined}
        >
          {busy ? "Checking…" : "Apply"}
        </Button>
      </div>
      {error && <p className="mt-1.5 text-xs text-red-600">{error}</p>}
    </div>
  );
}
