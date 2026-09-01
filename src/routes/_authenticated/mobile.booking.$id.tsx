import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Loader2, Phone, Mail, MapPin, Clock } from "lucide-react";
import { listMyAppointments } from "@/lib/availability.functions";
import { Button } from "@/components/ui/button";
import { shortTime } from "./mobile.index";

export const Route = createFileRoute("/_authenticated/mobile/booking/$id")({
  ssr: false,
  component: MobileBookingDetail,
});

function Row({ icon: Icon, children }: { icon: any; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 py-3">
      <Icon className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
      <div className="min-w-0 text-lg">{children}</div>
    </div>
  );
}

function MobileBookingDetail() {
  const { id } = Route.useParams();
  const list = useServerFn(listMyAppointments);
  const q = useQuery({ queryKey: ["mobile-appointments"], queryFn: () => list() });
  const appt = (q.data ?? []).find((a: any) => a.id === id) as any;

  if (q.isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!appt) {
    return (
      <div className="py-10 text-center">
        <p className="text-lg">Booking not found.</p>
        <Link to="/mobile" className="mt-4 inline-block text-base underline">
          Back to today
        </Link>
      </div>
    );
  }

  const date = new Date(`${appt.scheduled_date}T00:00:00`).toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <div>
      <Link to="/mobile" className="inline-flex items-center gap-2 text-base text-muted-foreground">
        <ArrowLeft className="h-5 w-5" /> Today
      </Link>

      <h1 className="mt-4 font-serif text-3xl leading-tight">{appt.patient_name}</h1>
      <p className="mt-1 text-lg text-muted-foreground">{appt.treatments?.name ?? "Appointment"}</p>

      <div className="mt-3 flex flex-wrap gap-2">
        <span className="rounded-full border px-3 py-1 text-sm capitalize">{appt.status}</span>
        {appt.payment_status && (
          <span className="rounded-full border px-3 py-1 text-sm capitalize">{appt.payment_status}</span>
        )}
      </div>

      <div className="mt-6 divide-y rounded-2xl border bg-card px-4">
        <Row icon={Clock}>
          {date}
          <div className="text-base text-muted-foreground">
            {shortTime(appt.start_time)}
            {appt.end_time ? ` – ${shortTime(appt.end_time)}` : ""}
          </div>
        </Row>
        {appt.locations?.name && <Row icon={MapPin}>{appt.locations.name}</Row>}
        {appt.patient_phone && (
          <Row icon={Phone}>
            <a href={`tel:${appt.patient_phone}`} className="underline">
              {appt.patient_phone}
            </a>
          </Row>
        )}
        {appt.patient_email && (
          <Row icon={Mail}>
            <a href={`mailto:${appt.patient_email}`} className="break-all underline">
              {appt.patient_email}
            </a>
          </Row>
        )}
      </div>

      {(appt.notes || appt.practitioner_notes) && (
        <div className="mt-6 rounded-2xl border bg-card p-4">
          <div className="text-sm uppercase tracking-widest text-muted-foreground">Notes</div>
          {appt.notes && <p className="mt-2 whitespace-pre-wrap text-lg">{appt.notes}</p>}
          {appt.practitioner_notes && (
            <p className="mt-2 whitespace-pre-wrap text-lg text-muted-foreground">{appt.practitioner_notes}</p>
          )}
        </div>
      )}

      {appt.patient_phone && (
        <a href={`tel:${appt.patient_phone}`} className="mt-6 block">
          <Button className="h-14 w-full text-lg">
            <Phone className="mr-2 h-5 w-5" /> Call client
          </Button>
        </a>
      )}
    </div>
  );
}
