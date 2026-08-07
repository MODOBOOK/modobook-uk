import { createFileRoute, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import {
  getPublicRooms,
  getRoomAvailability,
  getRoomMonthAvailability,
  requestRoomBooking,
  confirmRentalPayment,
} from "@/lib/room-rental.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DoorOpen, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/m/$slug/roomrental")({
  head: () => ({
    meta: [
      { title: "Room rental" },
      { name: "description", content: "Rent a fully equipped treatment room by the hour, half day or full day." },
      { property: "og:title", content: "Room rental" },
      { property: "og:description", content: "Rent a fully equipped treatment room by the hour, half day or full day." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PublicRoomRental,
});

type Room = {
  id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  location_id: string | null;
  hourly_rate: number | null;
  half_day_rate: number | null;
  full_day_rate: number | null;
  half_day_hours: number;
  min_hours: number;
  quantity: number;
  skip_room_selection: boolean;
  deposit_percent: number | null;
  booking_mode: "enquiry" | "pay_online" | "pay_in_clinic";
};

function money(n: number | null | undefined) {
  return n == null ? null : `£${Number(n).toFixed(2)}`;
}

function toISODate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function PublicRoomRental() {
  const { slug } = useParams({ from: "/m/$slug/roomrental" });
  const fetchRooms = useServerFn(getPublicRooms);
  const confirmPayment = useServerFn(confirmRentalPayment);
  const q = useQuery({ queryKey: ["public-rooms", slug], queryFn: () => fetchRooms({ data: { slug } }) });
  const [booking, setBooking] = useState<Room | null>(null);

  // Back from checkout — confirm the payment (and fire the invoice) without waiting on the webhook.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get("booking");
    if (!id || params.get("status") !== "paid") return;
    confirmPayment({ data: { booking_id: id } })
      .then((r) => {
        toast.success(r?.paid ? "Payment received — your room is booked." : "Thanks! We're confirming your payment.");
      })
      .catch(() => {})
      .finally(() => {
        window.history.replaceState({}, "", window.location.pathname);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  const rooms = (q.data?.rooms ?? []) as Room[];
  const locations = (q.data?.locations ?? []) as { id: string; name: string; city: string | null }[];

  // "Skip room selection" — renters just pick a date/time from the pooled rooms.
  const pooled = rooms.find((r) => r.skip_room_selection) ?? null;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:py-12">
      <div className="mb-8 text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--brand,#111)]/10">
          <DoorOpen className="h-6 w-6" style={{ color: "var(--brand, #111)" }} />
        </div>
        <h1 className="text-3xl font-bold" style={{ fontFamily: "var(--heading-font, inherit)" }}>Room rental</h1>
        <p className="mt-2 text-sm opacity-70">
          Rent a fully equipped treatment room by the hour, half day or full day.
        </p>
      </div>

      {q.isLoading && <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>}

      {!q.isLoading && (!q.data?.enabled || rooms.length === 0) && (
        <Card><CardContent className="py-16 text-center text-sm opacity-70">Room rental isn’t available here right now.</CardContent></Card>
      )}

      {pooled ? (
        <Card>
          <CardContent className="space-y-5 p-4 sm:p-6">
            <div>
              <h2 className="text-lg font-semibold">{pooled.name}</h2>
              <p className="text-sm opacity-70">
                {pooled.quantity > 1 ? `${pooled.quantity} rooms available` : "Pick a date and time"} — choose your slot below and we’ll assign a room.
              </p>
              {pooled.description && <p className="mt-2 text-sm opacity-70">{pooled.description}</p>}
            </div>
            <BookingPanel room={pooled} slug={slug} />
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rooms.map((r) => {
            const loc = locations.find((l) => l.id === r.location_id);
            const prices = [
              r.hourly_rate ? `${money(r.hourly_rate)} / hour` : null,
              r.half_day_rate ? `${money(r.half_day_rate)} half day` : null,
              r.full_day_rate ? `${money(r.full_day_rate)} full day` : null,
            ].filter(Boolean);
            return (
              <Card key={r.id} className="overflow-hidden">
                {r.image_url ? (
                  <img src={r.image_url} alt={r.name} className="h-40 w-full object-cover" />
                ) : (
                  <div className="flex h-40 w-full items-center justify-center bg-gradient-to-br from-[var(--brand,#111)]/20 to-[var(--brand-accent,#111)]/10">
                    <DoorOpen className="h-10 w-10 opacity-60" style={{ color: "var(--brand, #111)" }} />
                  </div>
                )}
                <CardContent className="space-y-2 p-4">
                  <h2 className="font-semibold">{r.name}</h2>
                  {loc && <p className="text-xs opacity-60">{[loc.name, loc.city].filter(Boolean).join(" · ")}</p>}
                  {r.description && <p className="text-sm opacity-70 line-clamp-3">{r.description}</p>}
                  <ul className="space-y-0.5 text-sm">
                    {prices.map((p) => <li key={p as string}>{p}</li>)}
                  </ul>
                  <Button
                    className="mt-2 w-full"
                    style={{ backgroundColor: "var(--brand, #111)", color: "#fff" }}
                    onClick={() => setBooking(r)}
                  >
                    {r.booking_mode === "enquiry" ? "Enquire" : "Book this room"}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {booking && (
        <Dialog open onOpenChange={(v) => !v && setBooking(null)}>
          <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-lg">
            <DialogHeader><DialogTitle>{booking.name}</DialogTitle></DialogHeader>
            <BookingPanel room={booking} slug={slug} onDone={() => setBooking(null)} />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

function BookingPanel({ room, slug, onDone }: { room: Room; slug: string; onDone?: () => void }) {
  const fetchAvail = useServerFn(getRoomAvailability);
  const fetchMonth = useServerFn(getRoomMonthAvailability);
  const submit = useServerFn(requestRoomBooking);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const [day, setDay] = useState<Date>(today);
  const [month, setMonth] = useState<Date>(today);
  const date = toISODate(day);
  const [unit, setUnit] = useState<"hour" | "half_day" | "full_day">(
    room.hourly_rate ? "hour" : room.half_day_rate ? "half_day" : "full_day",
  );
  const [hours, setHours] = useState(room.min_hours || 1);
  const [start, setStart] = useState<string | null>(null);
  const [form, setForm] = useState({ renter_name: "", renter_email: "", renter_phone: "", renter_business: "", notes: "" });
  const [busy, setBusy] = useState(false);

  const availQ = useQuery({
    queryKey: ["room-availability", slug, room.id, date],
    queryFn: () => fetchAvail({ data: { slug, room_id: room.id, date } }),
    enabled: Boolean(date),
  });
  const slots = (availQ.data?.slots ?? []) as { start: string; end: string; available: boolean }[];

  const blockHours = unit === "hour" ? Math.ceil(hours) : unit === "half_day" ? room.half_day_hours || 4 : Math.max(slots.length, 1);

  // Grey out whole days on the calendar when nothing long enough is left.
  const monthKey = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, "0")}`;
  const needHours = unit === "hour" ? Math.ceil(hours) : unit === "half_day" ? room.half_day_hours || 4 : 1;
  const monthQ = useQuery({
    queryKey: ["room-month", slug, room.id, monthKey, needHours],
    queryFn: () => fetchMonth({ data: { slug, room_id: room.id, month: monthKey, hours: needHours } }),
  });
  const closedDays = useMemo(
    () => new Set<string>((monthQ.data?.unavailable ?? []) as string[]),
    [monthQ.data],
  );


  const startable = useMemo(() => {
    const set = new Set<string>();
    for (let i = 0; i + blockHours <= slots.length; i++) {
      const window = slots.slice(i, i + blockHours);
      const contiguous = window.every((s, j) => j === 0 || window[j - 1]!.end === s.start);
      if (contiguous && window.every((s) => s.available)) set.add(slots[i]!.start);
    }
    return set;
  }, [slots, blockHours]);

  const endTime = useMemo(() => {
    if (!start) return null;
    const i = slots.findIndex((s) => s.start === start);
    if (i < 0) return null;
    return slots[Math.min(i + blockHours - 1, slots.length - 1)]!.end;
  }, [start, slots, blockHours]);

  const price =
    unit === "hour" ? (room.hourly_rate ?? 0) * hours
    : unit === "half_day" ? (room.half_day_rate ?? 0)
    : (room.full_day_rate ?? 0);

  const pct = Number(room.deposit_percent ?? 0);
  const takesDeposit = room.booking_mode === "pay_online" && pct > 0 && pct < 100;
  const dueNow = takesDeposit ? Math.round(price * pct) / 100 : price;

  async function go() {
    if (!start || !endTime) return toast.error("Pick a start time");
    if (!form.renter_name || !form.renter_email) return toast.error("Add your name and email");
    setBusy(true);
    try {
      const res = await submit({
        data: {
          slug,
          room_id: room.id,
          booking_date: date,
          start_time: start,
          end_time: endTime,
          unit,
          renter_name: form.renter_name,
          renter_email: form.renter_email,
          renter_phone: form.renter_phone || null,
          renter_business: form.renter_business || null,
          notes: form.notes || null,
          return_origin: window.location.origin,
        },
      });
      if (res.checkoutUrl) {
        window.location.href = res.checkoutUrl;
        return;
      }
      toast.success(
        room.booking_mode === "enquiry"
          ? "Enquiry sent — the clinic will be in touch."
          : "Booked! You'll settle payment at the clinic.",
      );
      onDone?.();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {room.hourly_rate != null && (
          <UnitButton active={unit === "hour"} onClick={() => { setUnit("hour"); setStart(null); }} label={`Hourly · ${money(room.hourly_rate)}`} />
        )}
        {room.half_day_rate != null && (
          <UnitButton active={unit === "half_day"} onClick={() => { setUnit("half_day"); setStart(null); }} label={`Half day · ${money(room.half_day_rate)}`} />
        )}
        {room.full_day_rate != null && (
          <UnitButton active={unit === "full_day"} onClick={() => { setUnit("full_day"); setStart(null); }} label={`Full day · ${money(room.full_day_rate)}`} />
        )}
      </div>

      {unit === "hour" && (
        <div>
          <Label>How many hours?</Label>
          <Input
            type="number"
            min={room.min_hours || 1}
            max={12}
            step="0.5"
            value={hours}
            onChange={(e) => { setHours(Math.max(room.min_hours || 1, Number(e.target.value) || 1)); setStart(null); }}
          />
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <Label>Pick a date</Label>
          <Calendar
            mode="single"
            selected={day}
            month={month}
            onMonthChange={setMonth}
            onSelect={(d) => { if (d) { setDay(d); setStart(null); } }}
            disabled={[{ before: today }, (d: Date) => closedDays.has(toISODate(d))]}
            modifiers={{ unavailable: (d: Date) => closedDays.has(toISODate(d)) }}
            modifiersClassNames={{ unavailable: "line-through opacity-40" }}
            className={cn("mt-1 rounded-md border p-3 pointer-events-auto")}
          />
          <p className="mt-2 text-xs opacity-60">
            {monthQ.isLoading ? "Checking the diary…" : "Crossed-out dates aren’t available."}
          </p>
        </div>


        <div>
          <Label>Available times</Label>
          {availQ.isLoading ? (
            <div className="py-4 text-sm opacity-60">Checking availability…</div>
          ) : slots.length === 0 ? (
            <p className="py-2 text-sm opacity-70">Closed on this date.</p>
          ) : startable.size === 0 ? (
            <p className="py-2 text-sm opacity-70">No slot long enough on this date — try another day.</p>
          ) : (
            <div className="mt-1 grid grid-cols-3 gap-2 sm:grid-cols-4">
              {slots.map((s) => {
                const ok = startable.has(s.start);
                return (
                  <button
                    key={s.start}
                    type="button"
                    disabled={!ok}
                    onClick={() => setStart(s.start)}
                    className={`rounded-md border px-2 py-2 text-sm transition ${
                      start === s.start ? "border-transparent text-white" : ok ? "hover:bg-black/5" : "cursor-not-allowed opacity-30"
                    }`}
                    style={start === s.start ? { backgroundColor: "var(--brand, #111)" } : undefined}
                  >
                    {s.start}
                  </button>
                );
              })}
            </div>
          )}
          {start && endTime && (
            <div className="mt-3 rounded-md border p-3 text-sm">
              <div className="font-medium">{start} – {endTime}</div>
              <div className="opacity-70">Total {money(price)}</div>
              {takesDeposit && (
                <div className="mt-1 opacity-70">
                  Pay {money(dueNow)} deposit now ({pct}%) · {money(price - dueNow)} balance due at the clinic
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div><Label>Your name</Label><Input value={form.renter_name} onChange={(e) => setForm({ ...form, renter_name: e.target.value })} /></div>
        <div><Label>Email</Label><Input type="email" value={form.renter_email} onChange={(e) => setForm({ ...form, renter_email: e.target.value })} /></div>
        <div><Label>Phone</Label><Input value={form.renter_phone} onChange={(e) => setForm({ ...form, renter_phone: e.target.value })} /></div>
        <div><Label>Business (optional)</Label><Input value={form.renter_business} onChange={(e) => setForm({ ...form, renter_business: e.target.value })} /></div>
      </div>
      <div><Label>Anything we should know?</Label><Textarea rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>

      <div className="flex justify-end gap-2">
        {onDone && <Button variant="ghost" onClick={onDone}>Cancel</Button>}
        <Button onClick={go} disabled={busy} style={{ backgroundColor: "var(--brand, #111)", color: "#fff" }}>
          {busy
            ? "Sending…"
            : room.booking_mode === "pay_online"
              ? takesDeposit ? `Pay ${money(dueNow)} deposit` : `Pay ${money(price)}`
              : room.booking_mode === "enquiry" ? "Send enquiry" : "Confirm booking"}
        </Button>
      </div>
    </div>
  );
}

function UnitButton({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3 py-1.5 text-sm transition ${active ? "border-transparent text-white" : "hover:bg-black/5"}`}
      style={active ? { backgroundColor: "var(--brand, #111)" } : undefined}
    >
      {label}
    </button>
  );
}
