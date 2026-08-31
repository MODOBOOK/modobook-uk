// Course grouping keys: a group key may carry a hidden uniqueness marker
// (" ~#a1b2c3") so two separately created treatments with the same display
// name (e.g. two different "Lips" treatments) never merge into one course
// row. The marker is stripped everywhere the group name is shown.
const MARKER_RE = /\s*~#[0-9a-f]{6}$/i;

export function courseGroupLabel(group: string | null | undefined): string {
  return (group ?? "").replace(MARKER_RE, "").trim();
}

export function courseGroupKeyFor(baseName: string, treatmentId: string): string {
  return `${baseName} ~#${treatmentId.replace(/-/g, "").slice(0, 6)}`;
}

export function hasCourseGroupMarker(group: string | null | undefined): boolean {
  return MARKER_RE.test(group ?? "");
}
