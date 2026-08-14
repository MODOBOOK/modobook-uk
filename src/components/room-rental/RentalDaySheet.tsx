import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DoorOpen, Users, Plus, AlertTriangle } from "lucide-react";

type Room = { id: string; name: string; quantity: number; active: boolean };
type Booking = {
  id: string;
  room_id: string;
  booking_date: string;
  start_time: string;
  end_time: string;
  unit_index: number | null;
  status: string;
  payment_status: string;
  price: number | null;
  renter_name: string;
  renter_email?: string | null;
  renter_phone?: string | null;
  renter_business?: string | null;
  notes?: string | null;
};

const hhmm = (t: string) => String(t).slice(0, 5);
const todayISO = () => new Date().toISOString().slice(0, 10);

function shiftDay(iso: string, days: number) {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Day-by-day occupancy: exactly who is in, which room, and when. */
export function RentalDaySheet({
  rooms,
  bookings,
  onBookRoom,
}: {
  rooms: Room[];
  bookings: Booking[];
  onBookRoom?: (roomId: string, date: string) => void;
}) {
  const [date, setDate] = useState(todayISO());

  const dayBookings = useMemo(
    () => bookings.filter((b) => b.booking_date === date && b.status !== "cancelled"),
    [bookings, date],
  );

  const inCount = dayBookings.length;
  const label = new Date(`${date}T12:00:00`).toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="flex flex-wrap items-center gap-3 py-4">
          <Button variant="outline" size="sm" onClick={() => setDate(shiftDay(date, -1))}>Previous</Button>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value || todayISO())} className="w-auto" />
          <Button variant="outline" size="sm" onClick={() => setDate(shiftDay(date, 1))}>Next</Button>
          <Button variant="ghost" size="sm" onClick={() => setDate(todayISO())}>Today</Button>
          <div className="ml-auto flex items-center gap-2 text-sm text-muted-foreground">
            <Users className="h-4 w-4" />
            {inCount === 0 ? "Nobody booked in" : `${inCount} booking${inCount === 1 ? "" : "s"} in`}
          </div>
        </CardContent>
      </Card>

      <p className="text-sm font-medium">{label}</p>

      {rooms.length === 0 && (
        <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">Add a room first.</CardContent></Card>
      )}

      {rooms.map((room) => {
        const capacity = Math.max(1, Number(room.quantity ?? 1));
        const roomBookings = dayBookings.filter((b) => b.room_id === room.id);
        return (
          <Card key={room.id}>
            <CardHeader className="flex flex-row items-center justify-between gap-3 pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <DoorOpen className="h-4 w-4" /> {room.name}
                <span className="text-xs font-normal text-muted-foreground">
                  {capacity > 1 ? `${capacity} rooms` : "1 room"} · {roomBookings.length} booked
                </span>
              </CardTitle>
              {onBookRoom && (
                <Button size="sm" variant="outline" onClick={() => onBookRoom(room.id, date)}>
                  <Plus className="mr-1 h-3.5 w-3.5" /> Book in
                </Button>
              )}
            </CardHeader>
            <CardContent className="space-y-2">
              {Array.from({ length: capacity }, (_, i) => i + 1).map((unit) => {
                const slots = roomBookings
                  .filter((b) => Number(b.unit_index ?? 1) === unit)
                  .sort((a, b) => a.start_time.localeCompare(b.start_time));
                const clash = slots.some((a, i) =>
                  slots.some((b, j) => j > i && a.start_time < b.end_time && a.end_time > b.start_time),
                );
                return (
                  <div key={unit} className="rounded-lg border">
                    <div className="flex items-center justify-between gap-2 border-b bg-muted/40 px-3 py-1.5">
                      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        {capacity > 1 ? `Room ${unit}` : "Room"}
                      </span>
                      {clash ? (
                        <span className="flex items-center gap-1 text-xs font-medium text-destructive">
                          <AlertTriangle className="h-3.5 w-3.5" /> Overlap
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">{slots.length === 0 ? "Free all day" : `${slots.length} in`}</span>
                      )}
                    </div>
                    {slots.length === 0 ? (
                      <div className="px-3 py-3 text-sm text-muted-foreground">Available</div>
                    ) : (
                      <ul className="divide-y">
                        {slots.map((b) => (
                          <li key={b.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2.5 text-sm">
                            <span className="font-mono text-xs text-muted-foreground">
                              {hhmm(b.start_time)}–{hhmm(b.end_time)}
                            </span>
                            <span className="font-semibold">{b.renter_name}</span>
                            {b.renter_business && <span className="text-muted-foreground">{b.renter_business}</span>}
                            <Badge variant={b.status === "confirmed" ? "default" : "outline"}>{b.status}</Badge>
                            <Badge variant={b.payment_status === "paid" ? "default" : "outline"}>{b.payment_status}</Badge>
                            <span className="ml-auto text-muted-foreground">
                              {b.renter_phone || b.renter_email}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
