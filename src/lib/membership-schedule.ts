// Shared wording for how often a membership's included treatment is due and
// any minimum term. Used on the practitioner plan list, the public
// memberships page and the invite email.

export function treatmentFrequencyLabel(months: number | null | undefined): string | null {
  const n = Math.round(Number(months ?? 1));
  if (!Number.isFinite(n) || n <= 0) return null;
  if (n === 1) return "Treatment every month";
  if (n === 12) return "Treatment once a year";
  return `Treatment every ${n} months`;
}

export function minCommitmentLabel(months: number | null | undefined): string | null {
  const n = Math.round(Number(months ?? 0));
  if (!Number.isFinite(n) || n <= 0) return null;
  return n === 1 ? "Minimum 1 month" : `Minimum ${n} months`;
}

export function membershipScheduleText(
  frequencyMonths: number | null | undefined,
  commitmentMonths: number | null | undefined,
): string | null {
  const parts = [treatmentFrequencyLabel(frequencyMonths), minCommitmentLabel(commitmentMonths)].filter(
    Boolean,
  ) as string[];
  return parts.length ? parts.join(" · ") : null;
}
