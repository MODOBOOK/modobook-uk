import { useMemo, useState } from "react";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Label } from "@/components/ui/label";

type Room = { id: string; name: string; quantity: number };

function toMin(t: string) {
  const [h, m] = String(t).slice(0, 5).split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}
function fromMin(m: number) {
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}
export function toISODate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Hour-by-hour picture of one room on one date, computed from hours/blocks/bookings. */
function daySlots(room: Room, date: string, hours: any[], blocks: any[], bookings: any[]) {
  const weekday = new Date(`${date}T12:00:00`).getDay();
  const open = hours.filter((h) => h.room_id === room.id && h.weekday === weekday);
  const closed = blocks
    .filter((b) => b.block_date === date && (b.room_id === room.id || b.room_id == null))
    .map((b) => (b.start_time && b.end_time ? [toMin(b.start_time), toMin(b.end_time)] : [0, 1440]) as [number, number]);
  const booked = bookings
    .filter((b) => b.room_id === room.id && b.booking_date === date && b.status !== "cancelled")
    .map((b) => [toMin(b.start_time), toMin(b.end_time)] as [number, number]);
  const capacity = Math.max(1, Number(room.quantity ?? 1));

  const slots: { start: string; end: string; free: number; blocked: boolean }[] = [];
  for (const h of open) {
    for (let m = toMin(h.start_time); m + 60 <= toMin(h.end_time); m += 60) {
      const blocked = closed.some(([s, e]) => m < e && m + 60 > s);
      const used = booked.filter(([s, e]) => m < e && m + 60 > s).length;
      slots.push({ start: fromMin(m), end: fromMin(m + 60), free: Math.max(0, capacity - used), blocked });
    }
  }
  return slots;
}

export function RentalCalendar({
  rooms,
  hours,
  blocks,
  bookings,
  onBookDay,
}: {
  rooms: Room[];
  hours: any[];
  blocks: any[];
  bookings: any[];
  onBookDay?: (roomId: string, date: string) => void;
}) {
  const [roomId, setRoomId] = useState(rooms[0]?.id ?? "");
  const [day, setDay] = useState<Date>(() => new Date());
  const room = rooms.find((r) => r.id === roomId) ?? rooms[0];
  const date = toISODate(day);

  // Colour the month: green = space left, amber = nearly full, red = full/closed out.
  const { full, partial, closed } = useMemo(() => {
    const f: Date[] = [], p: Date[] = [], c: Date[] = [];
    if (!room) return { full: f, partial: p, closed: c };
    const start = new Date(day.getFullYear(), day.getMonth(), 1);
    const end = new Date(day.getFullYear(), day.getMonth() + 1, 0);
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const iso = toISODate(d);
      const slots = daySlots(room, iso, hours, blocks, bookings);
      const usable = slots.filter((s) => !s.blocked);
      const free = usable.filter((s) => s.free > 0);
      if (slots.length === 0 || usable.length === 0) c.push(new Date(d));
      else if (free.length === 0) f.push(new Date(d));
      else if (free.length < usable.length) p.push(new Date(d));
    }
    return { full: f, partial: p, closed: c };
  }, [room, hours, blocks, bookings, day.getMonth(), day.getFullYear()]);

  const slots = room ? daySlots(room, date, hours, blocks, bookings) : [];
  const dayBookings = bookings.filter(
    (b) => b.booking_date === date && (!room || b.room_id === room.id) && b.status !== "cancelled",
  );

  if (rooms.length === 0) {
    return <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">Add a room first.</CardContent></Card>;
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[auto,1fr]">
      <Card>
        <CardContent className="space-y-3 p-4">
          <div>
            <Label>Room</Label>
            <Select value={roomId} onValueChange={setRoomId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {rooms.map((r) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Calendar
            mode="single"
            selected={day}
            onSelect={(d) => d && setDay(d)}
            month={day}
            onMonthChange={(m) => setDay(new Date(m.getFullYear(), m.getMonth(), 1))}
            modifiers={{ full, partial, closed }}
            modifiersClassNames={{
              full: "bg-destructive/15 text-destructive rounded-md",
              partial: "bg-amber-500/20 rounded-md",
              closed: "opacity-40 line-through",
            }}
            className="rounded-md border p-3 pointer-events-auto"
          />
          <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><i className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> Space left</span>
            <span className="flex items-center gap-1"><i className="h-2.5 w-2.5 rounded-full bg-amber-500" /> Partly booked</span>
            <span className="flex items-center gap-1"><i className="h-2.5 w-2.5 rounded-full bg-destructive" /> Full</span>
            <span className="flex items-center gap-1"><i className="h-2.5 w-2.5 rounded-full bg-muted-foreground/40" /> Closed</span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="font-medium">{new Date(`${date}T12:00:00`).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}</div>
            {room && onBookDay && (
              <button
                type="button"
                className="rounded-md border px-3 py-1.5 text-sm hover:bg-muted"
                onClick={() => onBookDay(room.id, date)}
              >
                Book someone in
              </button>
            )}
          </div>

          {slots.length === 0 ? (
            <p className="text-sm text-muted-foreground">Closed — no opening hours set for this day.</p>
          ) : (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {slots.map((s) => (
                <div
                  key={s.start}
                  className={`rounded-md border px-2 py-2 text-center text-sm ${
                    s.blocked ? "bg-muted text-muted-foreground line-through"
                      : s.free === 0 ? "border-destructive/40 bg-destructive/10 text-destructive"
                      : "border-emerald-500/40 bg-emerald-500/10"
                  }`}
                >
                  <div>{s.start}</div>
                  <div className="text-[11px] opacity-70">
                    {s.blocked ? "closed" : s.free === 0 ? "full" : `${s.free} free`}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div>
            <div className="mb-2 text-sm font-medium">Bookings this day</div>
            {dayBookings.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing booked.</p>
            ) : (
              <div className="divide-y">
                {dayBookings.map((b) => (
                  <div key={b.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                    <span>
                      {String(b.start_time).slice(0, 5)}–{String(b.end_time).slice(0, 5)} · {b.renter_name}
                    </span>
                    <span className="flex gap-2">
                      <Badge variant="outline">{b.status}</Badge>
                      <Badge variant={b.payment_status === "paid" ? "default" : "outline"}>{b.payment_status}</Badge>
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
