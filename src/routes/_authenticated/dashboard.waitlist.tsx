import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  listPatientWaitlist,
  updateWaitlistStatus,
  removeWaitlistEntry,
  type WaitlistEntry,
} from "@/lib/patient-waitlist.functions";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, Loader2, Mail, Phone, Trash2, Check, CalendarCheck } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/dashboard/waitlist")({
  component: WaitlistPage,
});

const STATUS_STYLES: Record<string, string> = {
  waiting: "bg-amber-100 text-amber-800",
  contacted: "bg-blue-100 text-blue-800",
  booked: "bg-emerald-100 text-emerald-800",
};

function WaitlistPage() {
  const [entries, setEntries] = useState<WaitlistEntry[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function load() {
    try {
      setEntries(await listPatientWaitlist());
    } catch {
      toast.error("Couldn't load the waitlist");
      setEntries([]);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function setStatus(id: string, status: string) {
    setBusyId(id);
    try {
      await updateWaitlistStatus({ data: { id, status } });
      await load();
    } catch {
      toast.error("Couldn't update that entry");
    } finally {
      setBusyId(null);
    }
  }

  async function remove(id: string) {
    setBusyId(id);
    try {
      await removeWaitlistEntry({ data: { id } });
      toast.success("Removed from the waitlist");
      await load();
    } catch {
      toast.error("Couldn't remove that entry");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4">
      <div>
        <h1 className="text-2xl font-bold">Patient waitlist</h1>
        <p className="text-sm text-muted-foreground">
          Patients who joined the list when no appointment times were free. Contact them yourself when a space opens up.
        </p>
      </div>

      {entries === null ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : entries.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Nobody is on the waitlist yet. When your diary has no free times, patients will be able to join it from your booking page.
          </CardContent>
        </Card>
      ) : (
        entries.map((e) => (
          <Card key={e.id}>
            <CardContent className="space-y-3 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2 font-semibold">
                    {e.full_name}
                    <Badge className={STATUS_STYLES[e.status] ?? "bg-muted text-foreground"}>
                      {e.status}
                    </Badge>
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {e.treatment_name ?? "Any treatment"}
                    {e.urgency ? ` · ${e.urgency}` : ""}
                    {" · joined "}
                    {new Date(e.created_at).toLocaleDateString(undefined, { day: "numeric", month: "short" })}
                  </p>
                </div>
                {busyId === e.id && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
              </div>

              <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                <a href={`mailto:${e.email}`} className="flex items-center gap-1 text-primary hover:underline">
                  <Mail className="h-3.5 w-3.5" /> {e.email}
                </a>
                {e.phone && (
                  <a href={`tel:${e.phone}`} className="flex items-center gap-1 text-primary hover:underline">
                    <Phone className="h-3.5 w-3.5" /> {e.phone}
                  </a>
                )}
              </div>

              {(e.preferred_times || e.notes) && (
                <div className="space-y-1 rounded-md bg-muted/50 p-3 text-xs">
                  {e.preferred_times && (
                    <p className="flex items-start gap-1.5">
                      <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0" /> Prefers: {e.preferred_times}
                    </p>
                  )}
                  {e.notes && <p className="text-muted-foreground">“{e.notes}”</p>}
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                {e.status === "waiting" && (
                  <Button size="sm" variant="outline" disabled={busyId === e.id} onClick={() => setStatus(e.id, "contacted")}>
                    <Check className="mr-1 h-3.5 w-3.5" /> Mark contacted
                  </Button>
                )}
                {e.status !== "booked" && (
                  <Button size="sm" variant="outline" disabled={busyId === e.id} onClick={() => setStatus(e.id, "booked")}>
                    <CalendarCheck className="mr-1 h-3.5 w-3.5" /> Mark booked
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-destructive"
                  disabled={busyId === e.id}
                  onClick={() => remove(e.id)}
                >
                  <Trash2 className="mr-1 h-3.5 w-3.5" /> Remove
                </Button>
              </div>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}
