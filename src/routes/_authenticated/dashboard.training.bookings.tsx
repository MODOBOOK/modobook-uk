import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listMyTrainingBookings, updateBookingStatus } from "@/lib/training.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Loader2, Mail, Phone } from "lucide-react";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";

type BookingStatus = Database["public"]["Enums"]["training_booking_status"];

export const Route = createFileRoute("/_authenticated/dashboard/training/bookings")({
  component: TrainingBookings,
});

const STATUS_COLOR: Record<BookingStatus, string> = {
  pending: "bg-amber-100 text-amber-900",
  confirmed: "bg-emerald-100 text-emerald-900",
  cancelled: "bg-rose-100 text-rose-900",
  completed: "bg-sky-100 text-sky-900",
};

function TrainingBookings() {
  const qc = useQueryClient();
  const listFn = useServerFn(listMyTrainingBookings);
  const statusFn = useServerFn(updateBookingStatus);

  const q = useQuery({
    queryKey: ["training-bookings"],
    queryFn: () => listFn(),
  });

  const setStatus = useMutation({
    mutationFn: (v: { id: string; status: BookingStatus }) =>
      statusFn({ data: v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["training-bookings"] }),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const rows = (q.data ?? []) as Array<{
    id: string;
    trainee_name: string;
    trainee_email: string;
    trainee_phone: string | null;
    status: BookingStatus;
    created_at: string;
    appointment_date: string | null;
    appointment_start: string | null;
    notes: string | null;
    training_courses: { name: string; mode: string } | null;
  }>;

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 md:p-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Training bookings</h1>
      </div>

      {q.isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : rows.length === 0 ? (
        <Card><CardContent className="p-10 text-center text-muted-foreground">No training bookings yet.</CardContent></Card>
      ) : (
        <div className="space-y-3">
          {rows.map((b) => (
            <Card key={b.id}>
              <CardContent className="space-y-2 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold">{b.trainee_name}</span>
                  <Badge className={STATUS_COLOR[b.status]}>{b.status}</Badge>
                  {b.training_courses && <Badge variant="outline">{b.training_courses.name}</Badge>}
                </div>
                <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                  <a href={`mailto:${b.trainee_email}`} className="inline-flex items-center gap-1 hover:underline">
                    <Mail className="h-3 w-3" /> {b.trainee_email}
                  </a>
                  {b.trainee_phone && (
                    <a href={`tel:${b.trainee_phone}`} className="inline-flex items-center gap-1 hover:underline">
                      <Phone className="h-3 w-3" /> {b.trainee_phone}
                    </a>
                  )}
                  {b.appointment_date && (
                    <span>Preferred: {b.appointment_date}{b.appointment_start ? ` @ ${b.appointment_start.slice(0, 5)}` : ""}</span>
                  )}
                </div>
                {b.notes && <p className="text-sm text-muted-foreground">{b.notes}</p>}
                <div className="flex flex-wrap gap-2 pt-1">
                  {b.status !== "confirmed" && (
                    <Button size="sm" variant="outline" onClick={() => setStatus.mutate({ id: b.id, status: "confirmed" })}>Confirm</Button>
                  )}
                  {b.status !== "completed" && (
                    <Button size="sm" variant="outline" onClick={() => setStatus.mutate({ id: b.id, status: "completed" })}>Mark completed</Button>
                  )}
                  {b.status !== "cancelled" && (
                    <Button size="sm" variant="ghost" onClick={() => setStatus.mutate({ id: b.id, status: "cancelled" })}>Cancel</Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
