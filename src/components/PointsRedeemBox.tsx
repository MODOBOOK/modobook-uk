import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { previewMyPointsRedemption } from "@/lib/rewards.functions";
import { Sparkles } from "lucide-react";
import type { AppliedDiscount } from "@/components/DiscountCodeBox";

/**
 * Lets a signed-in patient spend their loyalty points on this booking with a
 * single tick — no need to remember their personal code. Applying sets the
 * same `AppliedDiscount` shape the checkout already understands, so the
 * booking flow consumes the points after the appointment is created.
 */
export function PointsRedeemBox({
  slug,
  patientUserId,
  totalPennies,
  treatmentIds,
  value,
  onChange,
}: {
  slug: string;
  patientUserId: string | null;
  totalPennies: number;
  treatmentIds: string[];
  value: AppliedDiscount | null;
  onChange: (d: AppliedDiscount | null) => void;
}) {
  const preview = useServerFn(previewMyPointsRedemption);
  const q = useQuery({
    queryKey: ["my-points-redeem", slug, patientUserId, totalPennies],
    enabled: Boolean(patientUserId) && totalPennies > 0,
    staleTime: 30_000,
    queryFn: () => preview({ data: { slug, totalPennies } }),
  });

  const data = q.data;
  if (!data || data.ok !== true) return null;

  const applied = Boolean(value?.isPointsRedemption);
  // Another code (promo or gift card) is already in play.
  if (value && !applied) return null;

  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-emerald-200 bg-emerald-50/60 p-3 text-sm">
      <input
        type="checkbox"
        className="mt-0.5 h-4 w-4"
        checked={applied}
        onChange={(e) => {
          if (!e.target.checked) {
            onChange(null);
            return;
          }
          onChange({
            id: `points-${data.code}`,
            code: data.code,
            kind: "fixed",
            amount: data.pennies / 100,
            applies_to_treatment_ids: treatmentIds,
            isPointsRedemption: true,
            pointsToUse: data.pointsToUse,
          });
        }}
      />
      <span>
        <span className="flex items-center gap-1.5 font-medium text-emerald-900">
          <Sparkles className="h-4 w-4" /> Use my loyalty points
        </span>
        <span className="mt-0.5 block text-xs text-emerald-800">
          You have {data.pointsBalance.toLocaleString()} points — spend {data.pointsToUse.toLocaleString()}{" "}
          for £{(data.pennies / 100).toFixed(2)} off this booking.
        </span>
      </span>
    </label>
  );
}
