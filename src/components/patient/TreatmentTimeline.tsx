import { Badge } from "@/components/ui/badge";

type Appt = {
  id: string;
  scheduled_date: string;
  start_time: string;
  status: string;
  treatments?: { name?: string; color?: string } | null;
};

export function TreatmentTimeline({ appointments }: { appointments: Appt[] }) {
  const items = [...(appointments ?? [])]
    .filter((a) => a.status !== "cancelled")
    .sort((a, b) => (a.scheduled_date + a.start_time < b.scheduled_date + b.start_time ? 1 : -1));

  if (items.length === 0) {
    return <p className="px-1 py-2 text-xs text-muted-foreground">No treatments on record yet.</p>;
  }

  const now = new Date();
  return (
    <ol className="relative ml-3 border-l-2 border-muted pl-5">
      {items.map((a) => {
        const date = new Date(a.scheduled_date + "T" + (a.start_time || "00:00"));
        const isPast = date < now;
        const color = a.treatments?.color || "hsl(var(--primary))";
        return (
          <li key={a.id} className="relative mb-5 last:mb-0">
            <span
              className="absolute -left-[27px] top-1 inline-flex h-3.5 w-3.5 items-center justify-center rounded-full border-2 border-background shadow"
              style={{ backgroundColor: color }}
              aria-hidden
            />
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
              <span className="text-sm font-semibold tracking-tight">
                {a.treatments?.name ?? "Treatment"}
              </span>
              <Badge
                variant={isPast ? "secondary" : "outline"}
                className="h-5 px-1.5 text-[10px]"
              >
                {isPast ? "Completed" : "Upcoming"}
              </Badge>
            </div>
            <div className="mt-0.5 text-xs text-muted-foreground">
              {date.toLocaleDateString(undefined, {
                weekday: "short",
                day: "2-digit",
                month: "short",
                year: "numeric",
              })}{" "}
              ·{" "}
              {date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
