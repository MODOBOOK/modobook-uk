export type DisplayNameMode = "clinic" | "practitioner" | "both";

export function resolveDisplayNames(profile: {
  clinic_name?: string | null;
  full_name?: string | null;
  display_name_mode?: string | null;
}): { primary: string; secondary: string | null } {
  const mode = (profile.display_name_mode ?? "both") as DisplayNameMode;
  const clinic = (profile.clinic_name ?? "").trim();
  const practitioner = (profile.full_name ?? "").trim();

  if (mode === "clinic") {
    return { primary: clinic || practitioner || "Your clinic", secondary: null };
  }
  if (mode === "practitioner") {
    return { primary: practitioner || clinic || "Your clinic", secondary: null };
  }
  // both
  const primary = clinic || practitioner || "Your clinic";
  const secondary = clinic && practitioner && clinic !== practitioner ? practitioner : null;
  return { primary, secondary };
}
