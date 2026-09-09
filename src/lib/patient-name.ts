/** Shared rules for patient names captured at booking.
 *  A patient must give a real first and last name — never an email address. */

export function cleanPatientName(raw: string | null | undefined): string {
  return (raw ?? "").replace(/\s+/g, " ").trim();
}

export function isFullName(raw: string | null | undefined): boolean {
  const name = cleanPatientName(raw);
  if (!name) return false;
  if (name.includes("@")) return false;
  const parts = name.split(" ").filter((p) => p.replace(/[^\p{L}'-]/gu, "").length >= 2);
  return parts.length >= 2;
}

export const FULL_NAME_MESSAGE = "Please enter your first and last name";
