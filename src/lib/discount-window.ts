/** Plain-English wording for a code limited to appointments within a date window. */
function fmt(d: string) {
  return new Date(d + "T12:00:00Z").toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
}

export function appointmentWindowMessage(start: string | null, end: string | null): string {
  if (start && end) return `This code is only valid for appointments from ${fmt(start)} to ${fmt(end)}.`;
  if (start) return `This code is only valid for appointments from ${fmt(start)}.`;
  if (end) return `This code is only valid for appointments up to ${fmt(end)}.`;
  return "This code isn't valid for the selected date.";
}

/** True when an appointment date (YYYY-MM-DD) falls inside the optional window. */
export function appointmentInWindow(date: string | null | undefined, start: string | null, end: string | null): boolean {
  if (!start && !end) return true;
  if (!date) return false;
  if (start && date < start) return false;
  if (end && date > end) return false;
  return true;
}
