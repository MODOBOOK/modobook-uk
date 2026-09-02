/**
 * Single, uniform platform fee.
 *
 * UK Payment Services Regulations 2017 ban charging consumers extra for using a
 * particular payment instrument (card, Klarna, Clearpay). So the fee here is a
 * FIXED rate applied identically to every online payment method — it is never
 * varied by rail. Practitioners choose only whether they absorb it themselves
 * or pass it on to the client.
 *
 * It is not applied to cash / pay-in-clinic bookings or to card-capture
 * (card-on-file) authorisations, where no money is taken online.
 */
export const PLATFORM_FEE_PERCENT = 5.4;
export const PLATFORM_FEE_FIXED_CENTS = 20;
export const PLATFORM_FEE_LABEL = "Platform fee";

/** Human-readable description of the rate, e.g. "5.4% + 20p". */
export const PLATFORM_FEE_DESCRIPTION = `${PLATFORM_FEE_PERCENT}% + ${PLATFORM_FEE_FIXED_CENTS}p`;

/**
 * Fee in pence for an online payment of `amountCents`.
 * Returns 0 when the practitioner absorbs the fee, or the amount is zero.
 */
export function platformFeeCents(amountCents: number, passToCustomer: boolean): number {
  if (!passToCustomer) return 0;
  const amount = Math.max(0, Math.round(Number(amountCents) || 0));
  if (amount <= 0) return 0;
  return Math.ceil((amount * PLATFORM_FEE_PERCENT) / 100) + PLATFORM_FEE_FIXED_CENTS;
}
