import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { createManualRentalBooking, getOwnerRoomAvailability } from "@/lib/room-rental.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { toast } from "sonner";
import { toISODate } from "./RentalCalendar";

type Room = {
  id: string;
  name: string;
  hourly_rate: number | null;
  half_day_rate: number | null;
  full_day_rate: number | null;
  half_day_hours: number;
  min_hours: number;
  quantity: number;
};

/** Practitioner-side "book someone in" flow with optional payment link / confirmation email. */
export function ManualBookingDialog({
  rooms,
  initialRoomId,
  initialDate,
  onClose,
  onSaved,
}: {
  rooms: Room[];
  initialRoomId?: string;
  initialDate?: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const create = useServerFn(createManualRentalBooking);
  const fetchAvail = useServerFn(getOwnerRoomAvailability);

  const [roomId, setRoomId] = useState(initialRoomId || rooms[0]?.id || "");
  const room = rooms.find((r) => r.id === roomId);
  const [day, setDay] = useState<Date>(() => (initialDate ? new Date(`${initialDate}T12:00:00`) : new Date()));
  const date = toISODate(day);
  const [unit, setUnit] = useState<"hour" | "half_day" | "full_day">("hour");
  const [hours, setHours] = useState(1);
  const [start, setStart] = useState<string | null>(null);
  const [send, setSend] = useState<"none" | "payment_link" | "confirmation">("payment_link");
  const [priceOverride, setPriceOverride] = useState<string>("");
  const [f, setF] = useState({ renter_name: "", renter_email: "", renter_phone: "", renter_business: "", notes: "" });
  const [busy, setBusy] = useState(false);

  const availQ = useQuery({
    queryKey: ["owner-room-availability", roomId, date],
    queryFn: () => fetchAvail({ data: { room_id: roomId, date } }),
    enabled: Boolean(roomId && date),
  });
  const slots = (availQ.data?.slots ?? []) as { start: string; end: string; available: boolean }[];

  const blockHours =
    unit === "hour" ? Math.max(1, Math.ceil(hours))
      : unit === "half_day" ? room?.half_day_hours || 4
      : Math.max(slots.length, 1);

  const startable = useMemo(() => {
    const set = new Set<string>();
    for (let i = 0; i + blockHours <= slots.length; i++) {
      const win = slots.slice(i, i + blockHours);
      const contiguous = win.every((s, j) => j === 0 || win[j - 1]!.end === s.start);
      if (contiguous && win.every((s) => s.available)) set.add(slots[i]!.start);
    }
    return set;
  }, [slots, blockHours]);

  const endTime = useMemo(() => {
    if (!start) return null;
    const i = slots.findIndex((s) => s.start === start);
    if (i < 0) return null;
    return slots[Math.min(i + blockHours - 1, slots.length - 1)]!.end;
  }, [start, slots, blockHours]);

  const autoPrice =
    unit === "hour" ? Number(room?.hourly_rate ?? 0) * hours
      : unit === "half_day" ? Number(room?.half_day_rate ?? 0)
      : Number(room?.full_day_rate ?? 0);
  const price = priceOverride === "" ? autoPrice : Number(priceOverride);

  async function submit() {
    if (!roomId) return toast.error("Pick a room");
    if (!start || !endTime) return toast.error("Pick a start time");
    if (!f.renter_name || !f.renter_email) return toast.error("Add their name and email");
    setBusy(true);
    try {
      await create({
        data: {
          room_id: roomId,
          booking_date: date,
          start_time: start,
          end_time: endTime,
          unit,
          price,
          renter_name: f.renter_name,
          renter_email: f.renter_email,
          renter_phone: f.renter_phone || null,
          renter_business: f.renter_business || null,
          notes: f.notes || null,
          send,
          origin: window.location.origin,
        },
      });
      toast.success(
        send === "payment_link" ? "Booked — payment link emailed"
          : send === "confirmation" ? "Booked — confirmation emailed"
          : "Booked",
      );
      onSaved();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader><DialogTitle>Book someone in</DialogTitle></DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>Room</Label>
              <Select value={roomId} onValueChange={(v) => { setRoomId(v); setStart(null); }}>
                <SelectTrigger><SelectValue placeholder="Pick a room" /></SelectTrigger>
                <SelectContent>{rooms.map((r) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Booked as</Label>
              <Select value={unit} onValueChange={(v) => { setUnit(v as typeof unit); setStart(null); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="hour">Hourly</SelectItem>
                  <SelectItem value="half_day">Half day</SelectItem>
                  <SelectItem value="full_day">Full day</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {unit === "hour" && (
            <div className="sm:max-w-[200px]">
              <Label>How many hours</Label>
              <Input type="number" min="1" step="1" value={hours}
                onChange={(e) => { setHours(Math.max(1, Number(e.target.value) || 1)); setStart(null); }} />
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label>Date</Label>
              <Calendar
                mode="single"
                selected={day}
                onSelect={(d) => { if (d) { setDay(d); setStart(null); } }}
                className="mt-1 rounded-md border p-3 pointer-events-auto"
              />
            </div>
            <div>
              <Label>Times</Label>
              {availQ.isLoading ? (
                <p className="py-2 text-sm text-muted-foreground">Checking…</p>
              ) : slots.length === 0 ? (
                <p className="py-2 text-sm text-muted-foreground">Closed on this date.</p>
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
                        className={`rounded-md border px-2 py-2 text-sm ${
                          start === s.start ? "border-transparent bg-primary text-primary-foreground"
                            : ok ? "hover:bg-muted" : "cursor-not-allowed opacity-30"
                        }`}
                      >
                        {s.start}
                      </button>
                    );
                  })}
                </div>
              )}
              {start && endTime && (
                <p className="mt-3 rounded-md border p-3 text-sm">
                  {start} – {endTime} · £{price.toFixed(2)}
                </p>
              )}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div><Label>Their name</Label><Input value={f.renter_name} onChange={(e) => setF({ ...f, renter_name: e.target.value })} /></div>
            <div><Label>Email</Label><Input type="email" value={f.renter_email} onChange={(e) => setF({ ...f, renter_email: e.target.value })} /></div>
            <div><Label>Phone</Label><Input value={f.renter_phone} onChange={(e) => setF({ ...f, renter_phone: e.target.value })} /></div>
            <div><Label>Business</Label><Input value={f.renter_business} onChange={(e) => setF({ ...f, renter_business: e.target.value })} /></div>
          </div>
          <div><Label>Notes</Label><Textarea rows={2} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>Price (£)</Label>
              <Input type="number" step="0.01" placeholder={autoPrice.toFixed(2)} value={priceOverride}
                onChange={(e) => setPriceOverride(e.target.value)} />
              <p className="mt-1 text-xs text-muted-foreground">Leave blank to use the room's rate.</p>
            </div>
            <div>
              <Label>Email them</Label>
              <Select value={send} onValueChange={(v) => setSend(v as typeof send)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="payment_link">Payment link (pay online)</SelectItem>
                  <SelectItem value="confirmation">Confirmation only</SelectItem>
                  <SelectItem value="none">Don't email</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={busy}>{busy ? "Saving…" : "Book & send"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
