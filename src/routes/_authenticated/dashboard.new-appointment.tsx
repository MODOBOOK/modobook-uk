import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getMyProfile } from "@/lib/profiles.functions";
import { createAppointmentForPatient } from "@/lib/appointments.functions";
import { createPaymentLink, emailPaymentLink } from "@/lib/payment-links.functions";
import { listMyModelSlots } from "@/lib/discounts.functions";
import { listClients } from "@/lib/clients.functions";
import { listConsentTemplates } from "@/lib/templates.functions";
import { listMedicalTemplates } from "@/lib/templates.functions";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup, SelectLabel } from "@/components/ui/select";
import { TreatmentPicker } from "@/components/TreatmentPicker";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Check, ChevronsUpDown, UserPlus, CalendarIcon, Sparkles, ChevronDown, Plus, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { toast } from "sonner";


export const Route = createFileRoute("/_authenticated/dashboard/new-appointment")({
  ssr: false,
  validateSearch: (search: Record<string, unknown>): { clientId?: string } => ({
    clientId: typeof search.clientId === "string" ? search.clientId : undefined,
  }),
  loader: async () => {
    const profile = await getMyProfile();
    if (!profile) throw new Error("No profile");
    return { profile };
  },
  component: NewAppointmentPage,
});

type Treatment = { id: string; name: string; price: number | null; duration: number | null; category_id: string | null };
type Location = { id: string; name: string };
type Category = { id: string; name: string; sort_order: number | null };
type ModelSlot = {
  id: string;
  treatment_id: string;
  location_id: string | null;
  slot_date: string;
  start_time: string;
  end_time: string;
  price_mode: "fixed" | "percent";
  price_value: number;
  notes: string | null;
  booked_appointment_id: string | null;
  active: boolean;
  category: string | null;
};

type BookingItem = {
  key: string;
  treatmentId: string;
  startTime: string; // HH:MM
  duration: number;  // minutes
  price: number;     // £
  modelSlotId: string | null;
};

function newKey() {
  return Math.random().toString(36).slice(2);
}

function toMin(t: string) { const [h, m] = t.split(":").map(Number); return h * 60 + m; }
function fromMin(n: number) { return `${String(Math.floor(n / 60)).padStart(2, "0")}:${String(n % 60).padStart(2, "0")}`; }

function NewAppointmentPage() {
  const { profile } = Route.useLoaderData();
  const { clientId: preselectClientId } = Route.useSearch();
  const navigate = useNavigate();
  const [treatments, setTreatments] = useState<Treatment[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [locationId, setLocationId] = useState<string>("");
  const [date, setDate] = useState("");
  const [items, setItems] = useState<BookingItem[]>([]);
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
  const submitLockRef = useRef(false);
  type PaidMode = "none" | "deposit_paid" | "full_paid" | "send_link";
  const [paidMode, setPaidMode] = useState<PaidMode>("none");
  const [depositAmount, setDepositAmount] = useState("");
  const [depositHours, setDepositHours] = useState("24");
  const [paidMethod, setPaidMethod] = useState<"cash" | "card_in_person" | "bank_transfer" | "other">("cash");
  const [paidReference, setPaidReference] = useState("");
  const createLink = useServerFn(createPaymentLink);
  const emailLink = useServerFn(emailPaymentLink);
  const fetchModelSlots = useServerFn(listMyModelSlots);
  const [modelSlots, setModelSlots] = useState<ModelSlot[]>([]);
  const [modelExpanded, setModelExpanded] = useState(true);


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
        .select("id,name,price,duration,category_id")
        .eq("profile_id", profile.id)
        .eq("active", true)
        .order("name");
      setTreatments((t ?? []) as Treatment[]);
      const { data: cats } = await supabase
        .from("treatment_categories")
        .select("id,name,sort_order")
        .eq("profile_id", profile.id)
        .eq("kind", "treatment")
        .order("sort_order")
        .order("name");
      setCategories((cats ?? []) as Category[]);
      const { data: l } = await supabase
        .from("locations")
        .select("id,name")
        .eq("profile_id", profile.id)
        .eq("active", true);
      setLocations(l ?? []);
      try {
        const [cs, cons, meds, ms] = await Promise.all([
          fetchClients() as Promise<ClientRow[]>,
          fetchConsents() as Promise<TemplateRow[]>,
          fetchMedical() as Promise<TemplateRow[]>,
          fetchModelSlots() as Promise<ModelSlot[]>,
        ]);
        setClients(cs ?? []);
        setConsentTemplates((cons ?? []).map((r) => ({ id: r.id, name: r.name })));
        setMedicalTemplates((meds ?? []).map((r) => ({ id: r.id, name: r.name })));
        const todayIso = new Date().toISOString().slice(0, 10);
        setModelSlots(
          (ms ?? [])
            .filter((s) => s.active && !s.booked_appointment_id && s.slot_date >= todayIso)
            .sort((a, b) => (a.slot_date + a.start_time).localeCompare(b.slot_date + b.start_time)),
        );
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

  // Preselect a patient when arriving via ?clientId= from the patient profile.
  const preselectAppliedRef = useRef(false);
  useEffect(() => {
    if (preselectAppliedRef.current || !preselectClientId || clients.length === 0) return;
    const match = clients.find((c) => c.id === preselectClientId);
    if (match) {
      applyClient(match);
      preselectAppliedRef.current = true;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preselectClientId, clients]);


  function toggle(setter: React.Dispatch<React.SetStateAction<Set<string>>>, id: string) {
    setter((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  }

  // Longest duration across selected items — used to filter available start slots
  const primaryDuration = items[0]?.duration ?? 30;

  // Recompute available slots when date/location changes
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

        const candidates = new Set<string>();
        for (const w of windows) {
          const interval = w.slot_interval ?? 30;
          const s = toMin(w.start_time); const e = toMin(w.end_time);
          for (let x = s; x + primaryDuration <= e; x += interval) candidates.add(fromMin(x));
        }

        const free = [...candidates].sort().filter((time) => {
          const s = toMin(time); const e = s + primaryDuration;
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
  }, [date, locationId, primaryDuration, profile.id]);

  function computeEndFromStart(time: string, mins: number): string {
    const [h, m] = time.split(":").map(Number);
    const total = h * 60 + m + mins;
    return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}:00`;
  }

  // Chain start times: given the list, ensure each item starts at end of the previous
  function chainStarts(list: BookingItem[]): BookingItem[] {
    if (list.length === 0) return list;
    const out = [...list];
    for (let i = 1; i < out.length; i++) {
      const prev = out[i - 1];
      if (!prev.startTime) continue;
      const nextStart = fromMin(toMin(prev.startTime) + (prev.duration || 0));
      out[i] = { ...out[i], startTime: nextStart };
    }
    return out;
  }

  function addTreatmentRow(treatmentId: string) {
    const t = treatments.find((x) => x.id === treatmentId);
    if (!t) return;
    setItems((prev) => {
      const nextStart = (() => {
        if (prev.length === 0) return "";
        const last = prev[prev.length - 1];
        if (!last.startTime) return "";
        return fromMin(toMin(last.startTime) + (last.duration || 0));
      })();
      return [
        ...prev,
        {
          key: newKey(),
          treatmentId,
          startTime: nextStart,
          duration: t.duration ?? 30,
          price: Number(t.price ?? 0),
          modelSlotId: null,
        },
      ];
    });
  }

  function updateItem(key: string, patch: Partial<BookingItem>) {
    setItems((prev) => chainStarts(prev.map((it) => (it.key === key ? { ...it, ...patch } : it))));
  }

  function removeItem(key: string) {
    setItems((prev) => chainStarts(prev.filter((it) => it.key !== key)));
  }

  function applyModelSlot(s: ModelSlot) {
    const t = treatments.find((x) => x.id === s.treatment_id);
    if (!t) return;
    const base = Number(t.price ?? 0);
    const final = s.price_mode === "fixed" ? Number(s.price_value) : Math.max(0, base * (1 - Number(s.price_value) / 100));
    setLocationId(s.location_id ?? "");
    setDate(s.slot_date);
    setItems([
      {
        key: newKey(),
        treatmentId: t.id,
        startTime: s.start_time.slice(0, 5),
        duration: t.duration ?? 30,
        price: final,
        modelSlotId: s.id,
      },
    ]);
  }


  async function submit() {
    if (submitLockRef.current) return;
    if (items.length === 0 || !date || !patientName || !patientEmail) {
      toast.error("Add at least one treatment and fill patient name, email and date");
      return;
    }
    if (items.some((it) => !it.treatmentId || !it.startTime)) {
      toast.error("Each treatment needs a start time");
      return;
    }
    submitLockRef.current = true;
    setSaving(true);
    try {
      const address = addrLine1 || addrCity || addrPostcode
        ? { line1: addrLine1, city: addrCity, postcode: addrPostcode }
        : null;

      const totalPriceCents = Math.round(
        items.reduce((s, it) => s + (Number.isFinite(it.price) ? it.price : 0), 0) * 100,
      );
      const depositCents = Math.round(parseFloat(depositAmount || "0") * 100);

      const created: { id: string; manageToken: string | null; treatmentName: string }[] = [];
      for (let i = 0; i < items.length; i++) {
        const it = items[i];
        const t = treatments.find((x) => x.id === it.treatmentId);
        if (!t) continue;
        // Attach payment-received record to the first appointment only.
        const attachPayment =
          i === 0 && (paidMode === "deposit_paid" || paidMode === "full_paid");
        const paymentReceived = attachPayment
          ? {
              kind: paidMode === "full_paid" ? ("full" as const) : ("deposit" as const),
              amountCents: paidMode === "full_paid" ? totalPriceCents : depositCents,
              method: paidMethod,
              reference: paidReference || null,
            }
          : null;
        const result = await createAppointmentForPatient({
          data: {
            treatmentId: it.treatmentId,
            locationId: locationId || null,
            date,
            startTime: `${it.startTime}:00`,
            endTime: computeEndFromStart(it.startTime, it.duration),
            patientName,
            patientEmail,
            patientPhone: patientPhone || undefined,
            patientDob: patientDob || null,
            patientAddress: address,
            notes: notes || undefined,
            basePrice: it.price,
            extraConsentTemplateIds: [...pickedConsentIds],
            medicalFormTemplateIds: [...pickedMedicalIds],
            modelSlotId: it.modelSlotId,
            paymentReceived,
          },
        });
        created.push({ id: result.id, manageToken: result.manageToken, treatmentName: t.name });
      }

      const primary = created[0];
      const manageUrl = primary?.manageToken
        ? `${window.location.origin}/m/${profile.slug}/manage/${primary.manageToken}`
        : null;

      let depositUrl: string | null = null;
      let depositEmailed = false;
      if (paidMode === "send_link" && primary) {
        const amt = depositCents;
        const hrs = Math.max(1, parseInt(depositHours || "24", 10));
        if (amt >= 100) {
          const expiresAt = new Date(Date.now() + hrs * 3600 * 1000).toISOString();
          try {
            const link = await createLink({
              data: {
                amountCents: amt,
                description: `Deposit · ${created.map((c) => c.treatmentName).join(" + ")} · ${patientName}`,
                kind: "deposit",
                appointmentId: primary.id,
                recipientEmail: patientEmail,
                recipientName: patientName,
                expiresAt,
              },
            });
            depositUrl = (link as { stripe_url: string | null }).stripe_url;
            const totalCents = Number((link as { total_cents?: number }).total_cents ?? amt);
            if (depositUrl && patientEmail) {
              const res = await emailLink({
                data: {
                  url: depositUrl,
                  recipientEmail: patientEmail,
                  recipientName: patientName,
                  amountCents: totalCents,
                  description: created.map((c) => c.treatmentName).join(" + "),
                  kind: "deposit",
                  expiresAt,
                },
              });
              depositEmailed = !!(res as { ok?: boolean }).ok;
              if (!depositEmailed) {
                toast.error(`Deposit link created but email failed: ${(res as { error?: string }).error ?? "unknown error"}`);
              }
            }
          } catch (e) {
            toast.error(`Deposit link failed: ${(e as Error).message}`);
          }
        } else {
          toast.error("Deposit amount must be at least £1.00 — no link was sent");
        }
      }

      toast.success(`Created ${created.length} appointment${created.length === 1 ? "" : "s"}`, {
        description: depositEmailed
          ? `Deposit link emailed to ${patientEmail} and copied to clipboard.`
          : depositUrl
          ? "Deposit link copied to clipboard."
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
      submitLockRef.current = false;
    }
  }

  // Grouped treatment options for the "Add treatment" dropdown
  const treatmentGroups = useMemo(() => {
    const byCat = new Map<string | null, Treatment[]>();
    for (const t of treatments) {
      const k = t.category_id ?? null;
      if (!byCat.has(k)) byCat.set(k, []);
      byCat.get(k)!.push(t);
    }
    const groups: { key: string; name: string; items: Treatment[] }[] = [];
    for (const c of categories) {
      const items = byCat.get(c.id);
      if (items && items.length) groups.push({ key: c.id, name: c.name, items });
    }
    const uncategorised = byCat.get(null);
    if (uncategorised && uncategorised.length) {
      groups.push({ key: "uncategorised", name: "Uncategorised", items: uncategorised });
    }
    return groups;
  }, [treatments, categories]);

  const totalPrice = items.reduce((sum, it) => sum + (Number.isFinite(it.price) ? it.price : 0), 0);
  const totalDuration = items.reduce((sum, it) => sum + (it.duration || 0), 0);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Book appointment for a patient</h1>
        <p className="text-sm text-muted-foreground">
          Add one or more treatments — each with its own time and price. The patient will receive a confirmation email with consent forms and a link to manage their booking.
        </p>
      </div>

      {modelSlots.length > 0 && (() => {
        const treatById = new Map(treatments.map((t) => [t.id, t]));
        const visible = modelSlots.filter((s) => treatById.has(s.treatment_id));
        if (visible.length === 0) return null;
        return (
          <div className="rounded-2xl border-2 border-fuchsia-400/40 bg-fuchsia-50/40 p-3 dark:bg-fuchsia-950/10">
            <button
              type="button"
              onClick={() => setModelExpanded((v) => !v)}
              className="flex w-full items-center gap-2 text-left"
            >
              <Sparkles className="h-4 w-4 text-fuchsia-600" />
              <h3 className="text-sm font-bold text-fuchsia-700 dark:text-fuchsia-300">Model slots</h3>
              <span className="text-xs opacity-60">Discounted dates & times</span>
              <span className="ml-auto rounded-full bg-fuchsia-600/10 px-2 py-0.5 text-[11px] font-medium text-fuchsia-700 dark:text-fuchsia-300">
                {visible.length}
              </span>
              <ChevronDown className={`h-4 w-4 text-fuchsia-600 transition-transform ${modelExpanded ? "rotate-180" : ""}`} />
            </button>
            {modelExpanded && (
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {visible.map((s) => {
                  const t = treatById.get(s.treatment_id)!;
                  const base = Number(t.price ?? 0);
                  const final = s.price_mode === "fixed"
                    ? Number(s.price_value)
                    : Math.max(0, base * (1 - Number(s.price_value) / 100));
                  const selected = items.some((it) => it.modelSlotId === s.id);
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => applyModelSlot(s)}
                      className={`rounded-xl border p-3 text-left transition ${selected ? "border-fuchsia-500 bg-white shadow-sm ring-2 ring-fuchsia-300" : "border-border bg-white hover:border-fuchsia-300"}`}
                    >
                      <p className="text-sm font-semibold">{t.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(s.slot_date + "T00:00:00").toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" })} · {s.start_time.slice(0,5)}–{s.end_time.slice(0,5)}
                      </p>
                      <p className="mt-1 text-sm">
                        <span className="line-through text-muted-foreground">£{base.toFixed(2)}</span>{" "}
                        <span className="font-bold text-emerald-600">£{final.toFixed(2)}</span>
                      </p>
                      {s.notes && <p className="mt-1 text-xs italic text-muted-foreground">{s.notes}</p>}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );
      })()}


      <Card>
        <CardHeader>
          <CardTitle>Treatments</CardTitle>
          <p className="text-xs text-muted-foreground">
            Add multiple treatments to a single visit. Time and price for each can be edited.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
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
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  className={cn("w-full justify-start text-left font-normal", !date && "text-muted-foreground")}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {date ? format(new Date(date + "T00:00:00"), "PPP") : <span>Pick a date</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 pointer-events-auto" align="start">
                <Calendar
                  mode="single"
                  selected={date ? new Date(date + "T00:00:00") : undefined}
                  onSelect={(d) => {
                    if (!d) return;
                    const yyyy = d.getFullYear();
                    const mm = String(d.getMonth() + 1).padStart(2, "0");
                    const dd = String(d.getDate()).padStart(2, "0");
                    setDate(`${yyyy}-${mm}-${dd}`);
                    setItems((prev) => prev.map((it, i) => (i === 0 ? { ...it, startTime: "" } : it)));
                  }}
                  disabled={(d) => d < new Date(new Date().setHours(0, 0, 0, 0))}
                  initialFocus
                  className="p-3 pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          </div>

          {date && items.length > 0 && !items[0].startTime && (
            <div>
              <Label>Available start times for first treatment</Label>
              {loadingSlots ? (
                <p className="text-sm text-muted-foreground">Loading…</p>
              ) : slots.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No available slots for this date. You can still type a time manually below.
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {slots.map((s) => (
                    <Button
                      key={s}
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => updateItem(items[0].key, { startTime: s })}
                    >
                      {s}
                    </Button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Item rows */}
          <div className="space-y-3">
            {items.map((it, idx) => {
              const t = treatments.find((x) => x.id === it.treatmentId);
              return (
                <div key={it.key} className="rounded-2xl border bg-card/50 p-4 space-y-3 shadow-sm">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Treatment {idx + 1}</div>
                      <div className="font-semibold truncate">{t?.name ?? "—"}</div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {it.modelSlotId && (
                        <span className="rounded-full bg-fuchsia-600/10 px-2 py-0.5 text-[11px] font-medium text-fuchsia-700 dark:text-fuchsia-300">
                          Model slot
                        </span>
                      )}
                      <Button type="button" variant="ghost" size="icon" onClick={() => removeItem(it.key)} aria-label="Remove treatment">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="space-y-1">
                      <Label className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground whitespace-nowrap">Start</Label>
                      <Input
                        type="time"
                        className="h-10 tabular-nums"
                        value={it.startTime}
                        onChange={(e) => updateItem(it.key, { startTime: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground whitespace-nowrap">Duration</Label>
                      <div className="relative">
                        <Input
                          type="number"
                          min="5"
                          step="5"
                          className="h-10 pr-10 tabular-nums"
                          value={it.duration}
                          onChange={(e) => updateItem(it.key, { duration: Math.max(0, parseInt(e.target.value || "0", 10)) })}
                        />
                        <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-muted-foreground">min</span>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground whitespace-nowrap">Price</Label>
                      <div className="relative">
                        <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-xs text-muted-foreground">£</span>
                        <Input
                          type="number"
                          inputMode="decimal"
                          step="0.01"
                          min="0"
                          className="h-10 pl-6 tabular-nums"
                          value={it.price}
                          onChange={(e) => updateItem(it.key, { price: Math.max(0, parseFloat(e.target.value || "0")) })}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Add treatment dropdown — searchable + grouped by category */}
          <div>
            <Label>Add treatment</Label>
            <TreatmentPicker
              treatments={treatments}
              categories={categories}
              placeholder="Search or select treatment to add"
              clearAfterSelect
              onSelect={(id) => addTreatmentRow(id)}
            />
          </div>

          {items.length > 0 && (
            <div className="flex items-center justify-between rounded-lg bg-muted px-3 py-2 text-sm">
              <span className="text-muted-foreground">
                {items.length} treatment{items.length === 1 ? "" : "s"} · {totalDuration} min total
              </span>
              <span className="font-semibold">£{totalPrice.toFixed(2)}</span>
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
        <CardHeader>
          <CardTitle>Send forms with confirmation</CardTitle>
          <p className="text-xs text-muted-foreground">
            Forms linked to the treatment send automatically. Search and select any extras to include in the patient's confirmation email.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <SearchableFormPicker
            label="Medical forms"
            emptyMessage="No medical forms yet. Create one under Forms."
            items={medicalTemplates}
            selected={pickedMedicalIds}
            onToggle={(id) => toggle(setPickedMedicalIds, id)}
          />
          <SearchableFormPicker
            label="Consent forms"
            emptyMessage="No consent forms yet."
            items={consentTemplates}
            selected={pickedConsentIds}
            onToggle={(id) => toggle(setPickedConsentIds, id)}
          />
        </CardContent>
      </Card>



      <Card>
        <CardHeader><CardTitle>Payment</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Record a payment you've already taken (cash / bank transfer / card in person), or send a Stripe deposit link.
          </p>
          <div className="grid gap-2">
            {([
              { v: "none", label: "No payment recorded" },
              { v: "deposit_paid", label: "Deposit already paid" },
              { v: "full_paid", label: "Full amount already paid" },
              { v: "send_link", label: "Send a Stripe deposit link" },
            ] as { v: PaidMode; label: string }[]).map((opt) => (
              <label key={opt.v} className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="paidMode"
                  checked={paidMode === opt.v}
                  onChange={() => setPaidMode(opt.v)}
                />
                <span>{opt.label}</span>
              </label>
            ))}
          </div>

          {(paidMode === "deposit_paid" || paidMode === "full_paid") && (
            <div className="grid grid-cols-2 gap-3 rounded-md border p-3">
              {paidMode === "deposit_paid" && (
                <div>
                  <Label>Amount taken (£)</Label>
                  <Input
                    type="number" inputMode="decimal" step="0.01" min="0"
                    value={depositAmount}
                    onChange={(e) => setDepositAmount(e.target.value)}
                    placeholder="25.00"
                  />
                </div>
              )}
              {paidMode === "full_paid" && (
                <div>
                  <Label>Amount taken (£)</Label>
                  <Input
                    type="number" inputMode="decimal" step="0.01" min="0"
                    value={totalPrice.toFixed(2)}
                    readOnly
                  />
                </div>
              )}
              <div>
                <Label>Method</Label>
                <Select value={paidMethod} onValueChange={(v) => setPaidMethod(v as typeof paidMethod)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="card_in_person">Card (in person)</SelectItem>
                    <SelectItem value="bank_transfer">Bank transfer</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2">
                <Label>Reference (optional)</Label>
                <Input
                  value={paidReference}
                  onChange={(e) => setPaidReference(e.target.value)}
                  placeholder="Receipt no. / transaction ref"
                />
              </div>
            </div>
          )}

          {paidMode === "send_link" && (
            <div className="grid grid-cols-2 gap-3 rounded-md border p-3">
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
        {saving ? "Creating…" : items.length > 1 ? `Create ${items.length} appointments` : "Create appointment"}
      </Button>
    </div>
  );
}

function SearchableFormPicker({
  label,
  emptyMessage,
  items,
  selected,
  onToggle,
}: {
  label: string;
  emptyMessage: string;
  items: { id: string; name: string }[];
  selected: Set<string>;
  onToggle: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const selectedItems = items.filter((i) => selected.has(i.id));
  return (
    <div>
      <Label className="text-xs uppercase tracking-wide text-muted-foreground">{label}</Label>
      {items.length === 0 ? (
        <p className="mt-1 text-xs text-muted-foreground">{emptyMessage}</p>
      ) : (
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              role="combobox"
              className="mt-1 w-full justify-between font-normal"
            >
              <span className="truncate text-left">
                {selectedItems.length === 0
                  ? `Search ${label.toLowerCase()}…`
                  : `${selectedItems.length} selected`}
              </span>
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
            <Command>
              <CommandInput placeholder={`Search ${label.toLowerCase()}…`} />
              <CommandList>
                <CommandEmpty>No matches.</CommandEmpty>
                <CommandGroup>
                  {items.map((it) => {
                    const isSel = selected.has(it.id);
                    return (
                      <CommandItem
                        key={it.id}
                        value={it.name}
                        onSelect={() => onToggle(it.id)}
                      >
                        <Check className={`mr-2 h-4 w-4 ${isSel ? "opacity-100" : "opacity-0"}`} />
                        <span className="truncate">{it.name}</span>
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      )}
      {selectedItems.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {selectedItems.map((it) => (
            <button
              key={it.id}
              type="button"
              onClick={() => onToggle(it.id)}
              className="inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-1 text-xs hover:bg-secondary/80"
              title="Remove"
            >
              {it.name}
              <span aria-hidden>×</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
