import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { listMyAppointments } from "@/lib/availability.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Loader2, Mail, Phone, Calendar } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard/patients")({
  ssr: false,
  component: PatientsPage,
});

type Appt = Awaited<ReturnType<typeof listMyAppointments>>[number];

function PatientsPage() {
  const fetchAppointments = useServerFn(listMyAppointments);
  const [appts, setAppts] = useState<Appt[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    (async () => {
      const data = await fetchAppointments();
      setAppts(data as Appt[]);
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const patients = useMemo(() => {
    const map = new Map<string, { key: string; name: string; email: string; phone: string | null; bookings: Appt[]; last: string }>();
    for (const a of appts) {
      const key = (a.patient_email || a.patient_name || "unknown").toLowerCase();
      const entry = map.get(key) ?? {
        key,
        name: a.patient_name || "(no name)",
        email: a.patient_email || "",
        phone: a.patient_phone,
        bookings: [],
        last: a.scheduled_date,
      };
      entry.bookings.push(a);
      if (a.scheduled_date > entry.last) entry.last = a.scheduled_date;
      if (!entry.phone && a.patient_phone) entry.phone = a.patient_phone;
      map.set(key, entry);
    }
    const list = Array.from(map.values());
    list.forEach((p) => p.bookings.sort((a, b) => (a.scheduled_date < b.scheduled_date ? 1 : -1)));
    list.sort((a, b) => (a.last < b.last ? 1 : -1));
    const q = search.trim().toLowerCase();
    return q
      ? list.filter((p) => p.name.toLowerCase().includes(q) || p.email.toLowerCase().includes(q) || (p.phone ?? "").toLowerCase().includes(q))
      : list;
  }, [appts, search]);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Patients</h1>
        <p className="text-sm text-muted-foreground">
          Everyone who has booked with you, with their booking history.
        </p>
      </div>

      <Input
        placeholder="Search by name, email or phone…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : patients.length === 0 ? (
        <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">No patients yet.</CardContent></Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Accordion type="multiple" className="w-full">
              {patients.map((p) => (
                <AccordionItem key={p.key} value={p.key} className="px-4">
                  <AccordionTrigger className="hover:no-underline">
                    <div className="flex w-full items-center justify-between gap-3 pr-2 text-left">
                      <div className="min-w-0">
                        <div className="truncate font-medium">{p.name}</div>
                        <div className="truncate text-xs text-muted-foreground">
                          {p.email}{p.phone ? ` · ${p.phone}` : ""}
                        </div>
                      </div>
                      <Badge variant="secondary" className="shrink-0">
                        {p.bookings.length} booking{p.bookings.length === 1 ? "" : "s"}
                      </Badge>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-3 pb-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                          {p.email && <span className="inline-flex items-center gap-1"><Mail className="h-3 w-3" />{p.email}</span>}
                          {p.phone && <span className="inline-flex items-center gap-1"><Phone className="h-3 w-3" />{p.phone}</span>}
                        </div>
                        <PatientConsultLink name={p.name} email={p.email} phone={p.phone} />
                      </div>
                      <div className="space-y-2">
                        {p.bookings.map((b) => (
                          <div key={b.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-3 text-sm">
                            <div>
                              <div className="font-medium">
                                {(b as Appt & { treatments?: { name?: string } | null }).treatments?.name ?? "Treatment"}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                <Calendar className="mr-1 inline h-3 w-3" />
                                {b.scheduled_date} · {String(b.start_time).slice(0, 5)}
                                {(b as Appt & { locations?: { name?: string } | null }).locations?.name
                                  ? ` · ${(b as Appt & { locations?: { name?: string } | null }).locations?.name}`
                                  : ""}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge variant={b.status === "cancelled" ? "destructive" : "outline"}>{b.status}</Badge>
                              {b.total_amount != null && (
                                <span className="text-xs">£{Number(b.total_amount).toFixed(2)}</span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                      <PatientConsultations email={p.email} name={p.name} />
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
