import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { validateDiscountCode } from "@/lib/discounts.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tag, X, CheckCircle2 } from "lucide-react";

export type AppliedDiscount = {
  id: string;
  code: string;
  kind: "percent" | "fixed";
  amount: number;
  applies_to_treatment_ids: string[];
};

export function DiscountCodeBox({
  slug,
  treatmentIds,
  brand,
  value,
  onChange,
}: {
  slug: string;
  treatmentIds: string[];
  brand?: string;
  value: AppliedDiscount | null;
  onChange: (d: AppliedDiscount | null) => void;
}) {
  const validate = useServerFn(validateDiscountCode);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function apply() {
    if (!code.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const res = (await validate({
        data: { slug, code: code.trim(), treatment_ids: treatmentIds },
      })) as AppliedDiscount | null;
      if (!res) {
        setError("Code not found or no longer valid.");
        return;
      }
      if (!res.applies_to_treatment_ids || res.applies_to_treatment_ids.length === 0) {
        setError("This code doesn't apply to your selected treatments.");
        return;
      }
      onChange({
        id: res.id,
        code: res.code,
        kind: res.kind,
        amount: Number(res.amount),
        applies_to_treatment_ids: res.applies_to_treatment_ids,
      });
      setCode("");
    } catch (e) {
      setError((e as Error).message || "Could not validate code");
    } finally {
      setBusy(false);
    }
  }

  if (value) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5">
        <div className="flex min-w-0 items-center gap-2 text-sm text-emerald-800">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span className="truncate">
            <span className="font-semibold">{value.code}</span> applied ·{" "}
            {value.kind === "percent" ? `${value.amount}% off` : `£${value.amount.toFixed(2)} off`}
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
        <Tag className="h-3.5 w-3.5" /> Promo code <span className="text-xs opacity-50">(optional)</span>
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
