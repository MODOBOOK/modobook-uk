import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { previewLinkFee } from "@/lib/payment-links.functions";

/**
 * Live preview of the platform & processing fee that will be added to a
 * payment link, so the practitioner sees the exact figure before creating it.
 */
export function useLinkFee(amountCents: number, enabled: boolean) {
  const preview = useServerFn(previewLinkFee);
  const [feeCents, setFeeCents] = useState(0);

  useEffect(() => {
    if (!enabled || !Number.isFinite(amountCents) || amountCents < 100) {
      setFeeCents(0);
      return;
    }
    let cancelled = false;
    const t = setTimeout(() => {
      preview({ data: { amountCents } })
        .then((r) => {
          if (!cancelled) setFeeCents(Number(r?.surcharge_cents ?? 0));
        })
        .catch(() => {
          if (!cancelled) setFeeCents(0);
        });
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [amountCents, enabled]);

  return feeCents;
}
