/** Include retained team accounts even when the clinic has no Stripe connection. */
export function confirmationAccountIds(
  clinicAccountId: string | null | undefined,
  staffAccountIds: Array<string | null | undefined>,
): string[] {
  return [...new Set([clinicAccountId, ...staffAccountIds].filter(
    (id): id is string => typeof id === "string" && id.length > 0,
  ))];
}