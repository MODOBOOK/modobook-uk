import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, CalendarDays, ChevronRight } from "lucide-react";
import { listMyAppointments } from "@/lib/availability.functions";

export const Route = createFileRoute("/_authenticated/mobile/")({
  ssr: false,
  component: MobileToday,
});

export function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function shortTime(t?: string | null) {
  if (!t) return "";
  return t.slice(0, 5);
}

function MobileToday() {
  const list = useServerFn(listMyAppointments);
  const q = useQuery({ queryKey: ["mobile-appointments"], queryFn: () => list(), refetchInterval: 60_000 });

  const iso = todayIso();
  const todays = (q.data ?? [])
    .filter((a: any) => a.scheduled_date === iso && a.status !== "cancelled")
    .sort((a: any, b: any) => String(a.start_time).localeCompare(String(b.start_time)));

  const pretty = new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });

  return (
    <div>
      <h1 className="font-serif text-3xl leading-tight">Today’s diary</h1>
      <p className="mt-1 text-base text-muted-foreground">{pretty}</p>

      {q.isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : todays.length === 0 ? (
        <div className="mt-10 rounded-2xl border border-dashed p-8 text-center">
          <CalendarDays className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-3 text-lg font-medium">No bookings today</p>
          <p className="mt-1 text-base text-muted-foreground">Enjoy the quiet one.</p>
        </div>
      ) : (
        <ul className="mt-6 space-y-3">
          {todays.map((a: any) => (
            <li key={a.id}>
              <Link
                to="/mobile/booking/$id"
                params={{ id: a.id }}
                className="flex items-center gap-4 rounded-2xl border bg-card p-4 active:bg-muted"
              >
                <div className="w-16 shrink-0 text-lg font-semibold tabular-nums">{shortTime(a.start_time)}</div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-lg font-medium">{a.patient_name}</div>
                  <div className="truncate text-base text-muted-foreground">
                    {a.treatments?.name ?? "Appointment"}
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
