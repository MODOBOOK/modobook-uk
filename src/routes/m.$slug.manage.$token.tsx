import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { getAppointmentByToken, cancelAppointmentByToken } from "@/lib/appointments.functions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { describeCancellationRules, type CancellationRule } from "@/lib/policy";
import { useState } from "react";
import { toast } from "sonner";
import { Calendar, Clock, MapPin } from "lucide-react";
import { SafeHtml } from "@/components/SafeHtml";

export const Route = createFileRoute("/m/$slug/manage/$token")({
  loader: async ({ params }) => getAppointmentByToken({ data: { token: params.token } }),
  component: ManagePage,
  errorComponent: () => (
    <div className="mx-auto max-w-md p-8 text-center">
      <h1 className="text-xl font-bold">Appointment not found</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        This link may have expired or been used already.
      </p>
    </div>
  ),
  notFoundComponent: () => <div className="p-8">Not found</div>,
});

function ManagePage() {
  const appt = Route.useLoaderData() as {
    id: string;
    scheduled_date: string;
    start_time: string;
    end_time: string;
    patient_name: string;
    status: string;
    treatment_name: string;
    location_name: string | null;
    clinic_name: string;
    slug: string;
    cancellation_rules: CancellationRule[] | null;
    deposit_policy_text: string | null;
  };
  const { token, slug } = useParams({ from: "/m/$slug/manage/$token" });
  const [status, setStatus] = useState(appt.status);
  const [cancelling, setCancelling] = useState(false);

  async function cancel() {
    if (!confirm("Cancel this appointment? Cancellation charges may apply per the policy below.")) return;
    setCancelling(true);
    try {
      const r = await cancelAppointmentByToken({ data: { token } });
      if (r.ok) {
        setStatus("cancelled");
        toast.success("Appointment cancelled");
      } else {
        toast.error("Could not cancel");
      }
    } finally {
      setCancelling(false);
    }
  }

  const rules = describeCancellationRules(appt.cancellation_rules ?? []);

  return (
    <main className="mx-auto max-w-md space-y-4 p-4 sm:p-8">
      <h1 className="text-2xl font-bold">{appt.clinic_name}</h1>

      <Card>
        <CardHeader>
          <CardTitle>Your appointment</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="font-semibold text-base">{appt.treatment_name}</div>
          <div className="flex items-center gap-2"><Calendar className="h-4 w-4" />{new Date(appt.scheduled_date).toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</div>
          <div className="flex items-center gap-2"><Clock className="h-4 w-4" />{appt.start_time.slice(0,5)} – {appt.end_time.slice(0,5)}</div>
          {appt.location_name && <div className="flex items-center gap-2"><MapPin className="h-4 w-4" />{appt.location_name}</div>}
          <div className="pt-2">
            Status: <span className={`inline-block rounded px-2 py-0.5 text-xs font-semibold ${status === "cancelled" ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"}`}>{status}</span>
          </div>
        </CardContent>
      </Card>

      {(appt as any).has_allergies && (
        <Card className="border-red-300 bg-red-50">
          <CardHeader><CardTitle className="text-red-700 text-base">⚠ Allergies on file</CardTitle></CardHeader>
          <CardContent className="text-sm text-red-700">{(appt as any).allergies_text || "Please notify the practitioner of your allergies on arrival."}</CardContent>
        </Card>
      )}

      {(appt as any).aftercare_html && (
        <Card>
          <CardHeader><CardTitle className="text-base">Aftercare</CardTitle></CardHeader>
          <CardContent className="text-sm">
            <SafeHtml
              html={(appt as any).aftercare_html}
              className="prose prose-sm max-w-none prose-headings:mt-2 prose-headings:mb-1 prose-p:my-1 prose-ul:my-1 prose-li:my-0.5"
            />
          </CardContent>
        </Card>
      )}


      {(rules.length > 0 || appt.deposit_policy_text) && (
        <Card>
          <CardHeader><CardTitle>Policies</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {appt.deposit_policy_text && <p>{appt.deposit_policy_text}</p>}
            {rules.length > 0 && (
              <ul className="ml-4 list-disc space-y-1">
                {rules.map((r, i) => <li key={i}>{r}</li>)}
              </ul>
            )}
          </CardContent>
        </Card>
      )}

      {status !== "cancelled" && (
        <div className="flex flex-col gap-2">
          <Button asChild variant="outline">
            <Link to="/m/$slug" params={{ slug }}>Book a different time</Link>
          </Button>
          <Button variant="destructive" onClick={cancel} disabled={cancelling}>
            {cancelling ? "Cancelling…" : "Cancel appointment"}
          </Button>
        </div>
      )}
    </main>
  );
}
