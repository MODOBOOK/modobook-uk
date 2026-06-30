import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  listMyPrescriberVisits,
  setVisitConfirmation,
} from "@/lib/clinic-visits.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CalendarDays, MapPin, Users } from "lucide-react";

export const Route = createFileRoute("/_authenticated/prescriber/visits")({
  ssr: false,
  component: PrescriberVisits,
});

function PrescriberVisits() {
  const fetchVisits = useServerFn(listMyPrescriberVisits);
  const confirm = useServerFn(setVisitConfirmation);
  const q = useQuery({ queryKey: ["my-prescriber-visits"], queryFn: () => fetchVisits() });
  const list = q.data ?? [];

  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-serif text-xl">Clinic visits</h2>
        <p className="text-sm text-muted-foreground">
          Upcoming days you'll be visiting connected clinics, with booked patients.
        </p>
      </div>

      {q.isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}

      {!q.isLoading && list.length === 0 && (
        <Card>
          <CardContent className="p-6 text-center text-sm text-muted-foreground">
            <CalendarDays className="mx-auto mb-2 h-8 w-8 opacity-60" />
            No clinic visits scheduled.
          </CardContent>
        </Card>
      )}

      <div className="space-y-2">
        {list.map((v) => {
          const booked = v.bookings.filter((b) => b.status !== "declined").length;
          const addr = [v.address_line1, v.city, v.postcode].filter(Boolean).join(", ");
          return (
            <Card key={v.visit_id} className={v.status === "cancelled" ? "opacity-60" : ""}>
              <CardContent className="space-y-3 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold">
                        {formatDate(v.visit_date)} · {v.start_time.slice(0, 5)}–
                        {v.end_time.slice(0, 5)}
                      </p>
                      {v.confirmed_by_prescriber ? (
                        <Badge className="bg-emerald-600">Confirmed</Badge>
                      ) : (
                        <Badge variant="outline">Not confirmed</Badge>
                      )}
                      {v.status === "cancelled" && <Badge variant="destructive">Cancelled</Badge>}
                    </div>
                    <p className="mt-1 text-sm">
                      <span className="font-medium">{v.clinic_name ?? "Clinic"}</span>
                      {v.location_name ? ` · ${v.location_name}` : ""}
                    </p>
                    {addr && (
                      <p className="text-xs text-muted-foreground">
                        <MapPin className="mr-1 inline h-3 w-3" />
                        {addr}
                      </p>
                    )}
                    {v.notes && <p className="mt-1 text-xs italic">{v.notes}</p>}
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <div className="flex items-center gap-1 text-sm">
                      <Users className="h-4 w-4 opacity-60" />
                      <span className="font-medium">
                        {booked}/{v.capacity}
                      </span>
                      <span className="text-muted-foreground">booked</span>
                    </div>
                    {v.status !== "cancelled" && (
                      <Button
                        size="sm"
                        variant={v.confirmed_by_prescriber ? "ghost" : "default"}
                        onClick={async () => {
                          await confirm({
                            data: { id: v.visit_id, confirmed: !v.confirmed_by_prescriber },
                          });
                          toast.success(
                            v.confirmed_by_prescriber ? "Marked unconfirmed" : "Visit confirmed",
                          );
                          q.refetch();
                        }}
                      >
                        {v.confirmed_by_prescriber ? "Unconfirm" : "Confirm"}
                      </Button>
                    )}
                  </div>
                </div>

                {v.bookings.length > 0 && (
                  <div className="rounded-md bg-muted/40 p-2 text-xs">
                    <p className="mb-1 font-medium uppercase tracking-wide text-muted-foreground">
                      Patients booked in
                    </p>
                    <ul className="space-y-0.5">
                      {v.bookings.map((b) => (
                        <li
                          key={b.referral_id}
                          className="flex items-center justify-between"
                        >
                          <span>{b.patient_name}</span>
                          <Badge variant="outline" className="text-[10px]">
                            {b.status}
                          </Badge>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function formatDate(s: string) {
  return new Date(s + "T00:00:00").toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
