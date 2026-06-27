import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getMyProfile } from "@/lib/profiles.functions";
import { createAppointmentForPatient } from "@/lib/appointments.functions";
import { createPaymentLink } from "@/lib/payment-links.functions";
import { listClients } from "@/lib/clients.functions";
import { listConsentTemplates } from "@/lib/templates.functions";
import { listMedicalTemplates } from "@/lib/templates.functions";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Check, ChevronsUpDown, UserPlus } from "lucide-react";
import { toast } from "sonner";


export const Route = createFileRoute("/_authenticated/dashboard/new-appointment")({
  ssr: false,
  loader: async () => {
    const profile = await getMyProfile();
    if (!profile) throw new Error("No profile");
    return { profile };
  },
  component: NewAppointmentPage,
});

type Treatment = { id: string; name: string; price: number | null; duration: number | null };
type Location = { id: string; name: string };

function NewAppointmentPage() {
  const { profile } = Route.useLoaderData();
  const navigate = useNavigate();
  const [treatments, setTreatments] = useState<Treatment[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [treatmentId, setTreatmentId] = useState("");
  const [locationId, setLocationId] = useState<string>("");
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [slots, setSlots] = useState<string[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [patientName, setPatientName] = useState("");
  const [patientEmail, setPatientEmail] = useState("");
  const [patientPhone, setPatientPhone] = useState("");
  const [patientDob, setPatientDob] = useState("");
  const [addrLine1, setAddrLine1] = useState("");
  const [addrCity, setAddrCity] = useState("");
  const [addrPostcode, setAddrPostcode] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [sendDeposit, setSendDeposit] = useState(false);
  const [depositAmount, setDepositAmount] = useState("");
  const [depositHours, setDepositHours] = useState("24");
  const createLink = useServerFn(createPaymentLink);

  type ClientRow = { id: string; full_name: string; email: string | null; phone: string | null; dob: string | null; address: string | null };
  type TemplateRow = { id: string; name: string };
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [clientId, setClientId] = useState<string>("");
  const [clientPickerOpen, setClientPickerOpen] = useState(false);
  const [consentTemplates, setConsentTemplates] = useState<TemplateRow[]>([]);
  const [medicalTemplates, setMedicalTemplates] = useState<TemplateRow[]>([]);
  const [pickedConsentIds, setPickedConsentIds] = useState<Set<string>>(new Set());
  const [pickedMedicalIds, setPickedMedicalIds] = useState<Set<string>>(new Set());
  const fetchClients = useServerFn(listClients);
  const fetchConsents = useServerFn(listConsentTemplates);
  const fetchMedical = useServerFn(listMedicalTemplates);

  useEffect(() => {
    (async () => {
      const { data: t } = await supabase
        .from("treatments")
        .select("id,name,price,duration")
        .eq("profile_id", profile.id)
        .eq("active", true)
        .order("name");
      setTreatments(t ?? []);
      const { data: l } = await supabase
        .from("locations")
        .select("id,name")
        .eq("profile_id", profile.id)
        .eq("active", true);
      setLocations(l ?? []);
      try {
        const [cs, cons, meds] = await Promise.all([
          fetchClients() as Promise<ClientRow[]>,
          fetchConsents() as Promise<TemplateRow[]>,
          fetchMedical() as Promise<TemplateRow[]>,
        ]);
        setClients(cs ?? []);
        setConsentTemplates((cons ?? []).map((r) => ({ id: r.id, name: r.name })));
        setMedicalTemplates((meds ?? []).map((r) => ({ id: r.id, name: r.name })));
      } catch { /* ignore */ }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile.id]);

  const selectedClient = useMemo(() => clients.find((c) => c.id === clientId) ?? null, [clients, clientId]);

  function applyClient(c: ClientRow | null) {
    setClientId(c?.id ?? "");
    if (!c) return;
    setPatientName(c.full_name ?? "");
    setPatientEmail(c.email ?? "");
    setPatientPhone(c.phone ?? "");
    setPatientDob(c.dob ?? "");
    if (c.address) {
      setAddrLine1(c.address);
    }
    setClientPickerOpen(false);
  }

  function toggle(setter: React.Dispatch<React.SetStateAction<Set<string>>>, id: string) {
    setter((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  }


  const treatment = treatments.find((t) => t.id === treatmentId);
  const duration = treatment?.duration ?? 30;

  // Recompute available slots when date/location/treatment changes
  useEffect(() => {
    if (!date) { setSlots([]); return; }
    (async () => {
      setLoadingSlots(true);
      try {
        const dow = new Date(date + "T00:00:00").getDay();
        const matchLoc = (rowLoc: string | null) => !locationId || !rowLoc || rowLoc === locationId;

        const [{ data: rules }, { data: overrides }, { data: blocked }, { data: blockedT }, { data: appts }] = await Promise.all([
          supabase.from("availability_rules").select("start_time,end_time,slot_interval,location_id,day_of_week").eq("profile_id", profile.id).eq("day_of_week", dow),
          supabase.from("availability_overrides").select("start_time,end_time,slot_interval,location_id").eq("profile_id", profile.id).eq("date", date),
          supabase.from("blocked_dates").select("location_id").eq("profile_id", profile.id).eq("date", date),
          supabase.from("blocked_times").select("start_time,end_time,location_id").eq("profile_id", profile.id).eq("date", date),
          supabase.from("appointments").select("start_time,end_time,location_id,status").eq("profile_id", profile.id).eq("scheduled_date", date).neq("status", "cancelled"),
        ]);

        const isBlocked = (blocked ?? []).some((b) => matchLoc(b.location_id));
        if (isBlocked) { setSlots([]); return; }

        const windows = [
          ...(rules ?? []).filter((r) => matchLoc(r.location_id)),
          ...(overrides ?? []).filter((o) => matchLoc(o.location_id)),
        ];
        const busy = [
          ...(appts ?? []).filter((a) => matchLoc(a.location_id)),
          ...(blockedT ?? []).filter((b) => matchLoc(b.location_id)).map((b) => ({ start_time: b.start_time, end_time: b.end_time, location_id: b.location_id })),
        ];


        const toMin = (t: string) => {
          const [h, m] = t.split(":").map(Number); return h * 60 + m;
        };
        const fromMin = (n: number) => `${String(Math.floor(n / 60)).padStart(2, "0")}:${String(n % 60).padStart(2, "0")}`;

        const candidates = new Set<string>();
        for (const w of windows) {
          const interval = w.slot_interval ?? 30;
          const s = toMin(w.start_time); const e = toMin(w.end_time);
          for (let x = s; x + duration <= e; x += interval) candidates.add(fromMin(x));
        }

        const free = [...candidates].sort().filter((time) => {
          const s = toMin(time); const e = s + duration;
          return !busy.some((b) => {
            const bs = toMin(b.start_time); const be = toMin(b.end_time);
            return s < be && e > bs;
          });
        });
        setSlots(free);
      } finally {
        setLoadingSlots(false);
      }
    })();
  }, [date, locationId, duration, profile.id]);

  function computeEnd(time: string, mins: number): string {
    const [h, m] = time.split(":").map(Number);
    const total = h * 60 + m + mins;
    return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}:00`;
  }


  async function submit() {
    if (!treatment || !date || !startTime || !patientName || !patientEmail) {
      toast.error("Fill in treatment, date, time, patient name and email");
      return;
    }
    setSaving(true);
    try {
      const result = await createAppointmentForPatient({
        data: {
          treatmentId,
          locationId: locationId || null,
          date,
          startTime: `${startTime}:00`,
          endTime: computeEnd(startTime, treatment.duration ?? 30),
          patientName,
          patientEmail,
          patientPhone: patientPhone || undefined,
          patientDob: patientDob || null,
          patientAddress: addrLine1 || addrCity || addrPostcode
            ? { line1: addrLine1, city: addrCity, postcode: addrPostcode }
            : null,
          notes: notes || undefined,
          basePrice: Number(treatment.price ?? 0),
          extraConsentTemplateIds: [...pickedConsentIds],
          medicalFormTemplateIds: [...pickedMedicalIds],
        },
      });
      const manageUrl = result.manageToken
        ? `${window.location.origin}/m/${profile.slug}/manage/${result.manageToken}`
        : null;

      let depositUrl: string | null = null;
      if (sendDeposit) {
        const amt = Math.round(parseFloat(depositAmount || "0") * 100);
        const hrs = Math.max(1, parseInt(depositHours || "24", 10));
        if (amt >= 100) {
          try {
            const link = await createLink({
              data: {
                amountCents: amt,
                description: `Deposit · ${treatment.name} · ${patientName}`,
                kind: "deposit",
                appointmentId: result.id,
                recipientEmail: patientEmail,
                recipientName: patientName,
                expiresAt: new Date(Date.now() + hrs * 3600 * 1000).toISOString(),
              },
            });
            depositUrl = (link as { stripe_url: string | null }).stripe_url;
          } catch (e) {
            toast.error(`Deposit link failed: ${(e as Error).message}`);
          }
        }
      }

      toast.success("Appointment created", {
        description: depositUrl
          ? "Deposit link copied to clipboard — paste in email/SMS to the patient."
          : manageUrl
          ? "Manage link copied to clipboard."
          : "Confirmed.",
      });
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(depositUrl ?? manageUrl ?? "");
      }
      navigate({ to: "/dashboard/bookings" });

    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Book appointment for a patient</h1>
        <p className="text-sm text-muted-foreground">
          The patient will receive a confirmation email with consent forms and a link to manage their booking.
        </p>
      </div>

      <Card>
        <CardHeader><CardTitle>Treatment</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label>Treatment *</Label>
            <Select value={treatmentId} onValueChange={setTreatmentId}>
              <SelectTrigger><SelectValue placeholder="Select treatment" /></SelectTrigger>
              <SelectContent>
                {treatments.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name} — £{Number(t.price ?? 0).toFixed(2)} · {t.duration}min
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {locations.length > 0 && (
            <div>
              <Label>Location</Label>
              <Select value={locationId} onValueChange={setLocationId}>
                <SelectTrigger><SelectValue placeholder="Select location" /></SelectTrigger>
                <SelectContent>
                  {locations.map((l) => (
                    <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div>
            <Label>Date *</Label>
            <Input type="date" value={date} onChange={(e) => { setDate(e.target.value); setStartTime(""); }} />
          </div>
          {date && (
            <div>
              <Label>Available start times *</Label>
              {loadingSlots ? (
                <p className="text-sm text-muted-foreground">Loading…</p>
              ) : slots.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No available slots for this date{treatment ? "" : " (pick a treatment to filter by duration)"}.
                  You can still type a time manually below.
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {slots.map((s) => (
                    <Button
                      key={s}
                      type="button"
                      variant={startTime === s ? "default" : "outline"}
                      size="sm"
                      onClick={() => setStartTime(s)}
                    >
                      {s}
                    </Button>
                  ))}
                </div>
              )}
              <div className="mt-2">
                <Label className="text-xs text-muted-foreground">Or set manually</Label>
                <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
              </div>
            </div>
          )}

        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Patient details</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label>Existing patient</Label>
            <div className="flex items-center gap-2">
              <Popover open={clientPickerOpen} onOpenChange={setClientPickerOpen}>
                <PopoverTrigger asChild>
                  <Button type="button" variant="outline" role="combobox" className="flex-1 justify-between font-normal">
                    {selectedClient ? selectedClient.full_name : "Search your clients…"}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Search by name, email…" />
                    <CommandList>
                      <CommandEmpty>No patients found.</CommandEmpty>
                      <CommandGroup>
                        {clients.map((c) => (
                          <CommandItem key={c.id} value={`${c.full_name} ${c.email ?? ""} ${c.phone ?? ""}`} onSelect={() => applyClient(c)}>
                            <Check className={`mr-2 h-4 w-4 ${clientId === c.id ? "opacity-100" : "opacity-0"}`} />
                            <div className="min-w-0">
                              <div className="truncate font-medium">{c.full_name}</div>
                              <div className="truncate text-xs text-muted-foreground">{c.email ?? c.phone ?? ""}</div>
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
              {selectedClient && (
                <Button type="button" variant="ghost" size="sm" onClick={() => applyClient(null)}>Clear</Button>
              )}
            </div>
            <p className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
              <UserPlus className="h-3 w-3" /> Or fill in the fields below to book a new patient.
            </p>
          </div>

          <div>
            <Label>Full name *</Label>
            <Input value={patientName} onChange={(e) => setPatientName(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Email *</Label>
              <Input type="email" value={patientEmail} onChange={(e) => setPatientEmail(e.target.value)} />
            </div>
            <div>
              <Label>Phone</Label>
              <Input type="tel" value={patientPhone} onChange={(e) => setPatientPhone(e.target.value)} />
            </div>
          </div>
          <div>
            <Label>Date of birth</Label>
            <Input type="date" value={patientDob} onChange={(e) => setPatientDob(e.target.value)} />
          </div>
          <div>
            <Label>Address line 1</Label>
            <Input value={addrLine1} onChange={(e) => setAddrLine1(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>City</Label>
              <Input value={addrCity} onChange={(e) => setAddrCity(e.target.value)} />
            </div>
            <div>
              <Label>Postcode</Label>
              <Input value={addrPostcode} onChange={(e) => setAddrPostcode(e.target.value)} />
            </div>
          </div>
          <div>
            <Label>Notes</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Deposit (optional)</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={sendDeposit} onCheckedChange={(v) => setSendDeposit(!!v)} />
            <span>Send a Stripe deposit link — auto-cancel if unpaid in time</span>
          </label>
          {sendDeposit && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Deposit (£)</Label>
                <Input type="number" inputMode="decimal" step="0.01" min="1"
                  value={depositAmount} onChange={(e) => setDepositAmount(e.target.value)}
                  placeholder="25.00" />
              </div>
              <div>
                <Label>Cancel if unpaid in (hours)</Label>
                <Input type="number" min="1" max="168"
                  value={depositHours} onChange={(e) => setDepositHours(e.target.value)} />
              </div>
              <p className="col-span-2 text-xs text-muted-foreground">
                A Stripe payment link will be created on your connected account and copied to your clipboard so you can paste it into an email or SMS.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <Button onClick={submit} disabled={saving} size="lg" className="w-full">

        {saving ? "Creating…" : "Create appointment"}
      </Button>
    </div>
  );
}
