/** Keep option-specific wording, without repeating shared treatment copy. */
export function courseOptionDescription(
  description: string | null | undefined,
  descriptions: readonly (string | null | undefined)[],
): string | null {
  const text = description?.trim();
  if (!text) return null;
  const key = text.replace(/\s+/g, " ");
  const matches = descriptions.filter((value) => value?.trim().replace(/\s+/g, " ") === key);
  return matches.length === 1 ? text : null;
}