import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  listMyRooms,
  upsertRentalRoom,
  deleteRentalRoom,
  saveRentalHours,
  addRentalBlock,
  deleteRentalBlock,
  updateRentalBooking,
  setRoomRentalEnabled,
  sendRentalPaymentLink,
  sendRentalInvoice,
} from "@/lib/room-rental.functions";
import { RentalCalendar } from "@/components/room-rental/RentalCalendar";
import { ManualBookingDialog } from "@/components/room-rental/ManualBookingDialog";
import { getMyProfile } from "@/lib/profiles.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ImageUploader } from "@/components/ImageUploader";
import { Plus, Pencil, Trash2, DoorOpen, Clock, CalendarX2, Copy, Check, CalendarDays, Send, FileText } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/dashboard/room-rental")({
  head: () => ({
    meta: [
      { title: "Room rental · MODO" },
      { name: "description", content: "Rent your treatment rooms out by the hour, half day or full day." },
    ],
  }),
  component: RoomRentalPage,
});

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

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
  auto_invoice: boolean;
  deposit_percent: number | null;
  booking_mode: "enquiry" | "pay_online" | "pay_in_clinic";
  active: boolean;
  sort_order: number;
};

const MODE_LABEL: Record<string, string> = {
  enquiry: "Enquiry only",
  pay_online: "Book & pay online",
  pay_in_clinic: "Book now, pay in clinic",
};

function RoomRentalPage() {
  const qc = useQueryClient();
  const load = useServerFn(listMyRooms);
  const fetchProfile = useServerFn(getMyProfile);
  const toggleEnabled = useServerFn(setRoomRentalEnabled);
  const delRoom = useServerFn(deleteRentalRoom);

  const q = useQuery({ queryKey: ["my-rental-rooms"], queryFn: () => load() });
  const profileQ = useQuery({ queryKey: ["my-profile"], queryFn: () => fetchProfile() });
  const profile = profileQ.data as any;

  const rooms = (q.data?.rooms ?? []) as Room[];
  const hours = (q.data?.hours ?? []) as any[];
  const blocks = (q.data?.blocks ?? []) as any[];
  const bookings = (q.data?.bookings ?? []) as any[];
  const locations = (q.data?.locations ?? []) as { id: string; name: string }[];

  const [editing, setEditing] = useState<Partial<Room> | null>(null);
  const [manual, setManual] = useState<{ roomId?: string; date?: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const refresh = () => qc.invalidateQueries({ queryKey: ["my-rental-rooms"] });

  const publicUrl = profile?.slug ? `https://modobook.uk/m/${profile.slug}/roomrental` : "";

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <DoorOpen className="h-6 w-6" /> Room rental
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Rent your rooms out by the hour, half day or full day — on its own public link.
          </p>
        </div>
        <div className="flex gap-2">
        <Button variant="outline" onClick={() => setManual({})} disabled={rooms.length === 0}>
          <CalendarDays className="mr-2 h-4 w-4" /> Book someone in
        </Button>
        <Button onClick={() => setEditing({ booking_mode: "enquiry", active: true, half_day_hours: 4, min_hours: 1, quantity: 1 })}>
          <Plus className="mr-2 h-4 w-4" /> Add room
        </Button>
        </div>
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-4 py-4">
          <div className="min-w-0">
            <div className="font-medium">Room rental page</div>
            <p className="text-sm text-muted-foreground">
              {profile?.room_rental_enabled ? "Live at" : "Turn on to publish"}{" "}
              {publicUrl && <span className="break-all">{publicUrl.replace("https://", "")}</span>}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {publicUrl && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  navigator.clipboard.writeText(publicUrl);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                }}
              >
                {copied ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />} Copy link
              </Button>
            )}
            <Switch
              checked={Boolean(profile?.room_rental_enabled)}
              onCheckedChange={async (v) => {
                await toggleEnabled({ data: { enabled: v } });
                qc.invalidateQueries({ queryKey: ["my-profile"] });
                toast.success(v ? "Room rental page is live" : "Room rental page hidden");
              }}
            />
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="rooms">
        <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <TabsList className="w-max min-w-full justify-start">
            <TabsTrigger value="rooms">Rooms</TabsTrigger>
            <TabsTrigger value="calendar">Calendar</TabsTrigger>
            <TabsTrigger value="hours">Opening hours</TabsTrigger>
            <TabsTrigger value="blocks">Closures</TabsTrigger>
            <TabsTrigger value="bookings">Bookings</TabsTrigger>
          </TabsList>
        </div>


        <TabsContent value="rooms" className="mt-4 space-y-3">
          {rooms.length === 0 && (
            <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">No rooms yet. Add your first room.</CardContent></Card>
          )}
          {rooms.map((r) => (
            <Card key={r.id}>
              <CardContent className="flex flex-wrap items-center gap-4 py-4">
                {r.image_url ? (
                  <img src={r.image_url} alt={r.name} className="h-16 w-24 rounded object-cover" />
                ) : (
                  <div className="flex h-16 w-24 items-center justify-center rounded bg-muted"><DoorOpen className="h-6 w-6 opacity-50" /></div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">{r.name}</span>
                    {!r.active && <Badge variant="secondary">Hidden</Badge>}
                    <Badge variant="outline">{MODE_LABEL[r.booking_mode]}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {[
                      r.hourly_rate ? `£${Number(r.hourly_rate).toFixed(2)}/hr` : null,
                      r.half_day_rate ? `£${Number(r.half_day_rate).toFixed(2)} half day` : null,
                      r.full_day_rate ? `£${Number(r.full_day_rate).toFixed(2)} full day` : null,
                    ].filter(Boolean).join(" · ") || "No prices set"}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button size="icon" variant="ghost" onClick={() => setEditing(r)}><Pencil className="h-4 w-4" /></Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={async () => {
                      if (!confirm(`Delete "${r.name}"? Its bookings will be removed too.`)) return;
                      await delRoom({ data: { id: r.id } });
                      refresh();
                    }}
                  ><Trash2 className="h-4 w-4" /></Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="calendar" className="mt-4">
          <RentalCalendar
            rooms={rooms}
            hours={hours}
            blocks={blocks}
            bookings={bookings}
            onBookDay={(roomId, date) => setManual({ roomId, date })}
          />
        </TabsContent>

        <TabsContent value="hours" className="mt-4 space-y-4">
          {rooms.map((r) => (
            <HoursCard key={r.id} room={r} hours={hours.filter((h) => h.room_id === r.id)} onSaved={refresh} />
          ))}
          {rooms.length === 0 && <p className="text-sm text-muted-foreground">Add a room first.</p>}
        </TabsContent>

        <TabsContent value="blocks" className="mt-4">
          <BlocksCard rooms={rooms} blocks={blocks} onChanged={refresh} />
        </TabsContent>

        <TabsContent value="bookings" className="mt-4 space-y-3">
          {bookings.length === 0 && (
            <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">No rental bookings yet.</CardContent></Card>
          )}
          {bookings.map((b) => (
            <BookingRow key={b.id} booking={b} roomName={rooms.find((r) => r.id === b.room_id)?.name ?? "Room"} onChanged={refresh} />
          ))}
        </TabsContent>
      </Tabs>

      {manual && (
        <ManualBookingDialog
          rooms={rooms as any}
          initialRoomId={manual.roomId}
          initialDate={manual.date}
          onClose={() => setManual(null)}
          onSaved={() => { setManual(null); refresh(); }}
        />
      )}

      {editing && (
        <RoomDialog
          room={editing}
          locations={locations}
          profileId={profile?.id ?? ""}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); refresh(); }}
        />
      )}
    </div>
  );
}

function RoomDialog({
  room, locations, profileId, onClose, onSaved,
}: {
  room: Partial<Room>;
  locations: { id: string; name: string }[];
  profileId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const save = useServerFn(upsertRentalRoom);
  const [f, setF] = useState<Partial<Room>>(room);
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!f.name) return toast.error("Give the room a name");
    setBusy(true);
    try {
      await save({
        data: {
          id: f.id,
          name: f.name,
          description: f.description ?? null,
          image_url: f.image_url ?? null,
          location_id: f.location_id ?? null,
          hourly_rate: f.hourly_rate != null && f.hourly_rate !== ("" as never) ? Number(f.hourly_rate) : null,
          half_day_rate: f.half_day_rate != null && f.half_day_rate !== ("" as never) ? Number(f.half_day_rate) : null,
          full_day_rate: f.full_day_rate != null && f.full_day_rate !== ("" as never) ? Number(f.full_day_rate) : null,
          half_day_hours: Number(f.half_day_hours ?? 4),
          min_hours: Number(f.min_hours ?? 1),
          quantity: Math.max(1, Number(f.quantity ?? 1)),
          skip_room_selection: f.skip_room_selection ?? false,
          auto_invoice: f.auto_invoice ?? false,
          deposit_percent:
            f.deposit_percent == null || f.deposit_percent === ("" as never) ? null : Number(f.deposit_percent),
          booking_mode: (f.booking_mode ?? "enquiry") as Room["booking_mode"],
          active: f.active ?? true,
          sort_order: Number(f.sort_order ?? 0),
        },
      });
      toast.success("Room saved");
      onSaved();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader><DialogTitle>{f.id ? "Edit room" : "Add room"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Room name</Label><Input value={f.name ?? ""} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
          <div><Label>Description</Label><Textarea rows={3} value={f.description ?? ""} onChange={(e) => setF({ ...f, description: e.target.value })} /></div>
          {profileId && (
            <ImageUploader
              label="Room photo"
              value={f.image_url ?? null}
              onChange={(url) => setF({ ...f, image_url: url })}
              profileId={profileId}
              folder="rental-rooms"
            />
          )}
          {locations.length > 0 && (
            <div>
              <Label>Location</Label>
              <Select value={f.location_id ?? "none"} onValueChange={(v) => setF({ ...f, location_id: v === "none" ? null : v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Not specified</SelectItem>
                  {locations.map((l) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div><Label>£ / hour</Label><Input type="number" step="0.01" value={f.hourly_rate ?? ""} onChange={(e) => setF({ ...f, hourly_rate: e.target.value === "" ? null : Number(e.target.value) })} /></div>
            <div><Label>£ half day</Label><Input type="number" step="0.01" value={f.half_day_rate ?? ""} onChange={(e) => setF({ ...f, half_day_rate: e.target.value === "" ? null : Number(e.target.value) })} /></div>
            <div><Label>£ full day</Label><Input type="number" step="0.01" value={f.full_day_rate ?? ""} onChange={(e) => setF({ ...f, full_day_rate: e.target.value === "" ? null : Number(e.target.value) })} /></div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div><Label>Hours in a half day</Label><Input type="number" value={f.half_day_hours ?? 4} onChange={(e) => setF({ ...f, half_day_hours: Number(e.target.value) })} /></div>
            <div><Label>Minimum hours</Label><Input type="number" step="0.5" min="0.5" value={f.min_hours ?? 1} onChange={(e) => setF({ ...f, min_hours: Number(e.target.value) })} /></div>
            <div>
              <Label>How many of this room</Label>
              <Input type="number" min="1" step="1" value={f.quantity ?? 1} onChange={(e) => setF({ ...f, quantity: Number(e.target.value) })} />
              <p className="mt-1 text-xs text-muted-foreground">Renters book a time, not a specific room.</p>
            </div>
          </div>

          <div>
            <Label>How bookings are taken</Label>
            <Select value={f.booking_mode ?? "enquiry"} onValueChange={(v) => setF({ ...f, booking_mode: v as Room["booking_mode"] })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="enquiry">Enquiry only — you confirm manually</SelectItem>
                <SelectItem value="pay_online">Book &amp; pay online (Stripe)</SelectItem>
                <SelectItem value="pay_in_clinic">Book now, pay in clinic</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {(f.booking_mode ?? "enquiry") === "pay_online" && (
            <div>
              <Label>Deposit instead of full payment (%)</Label>
              <Input
                type="number"
                min="0"
                max="100"
                step="1"
                placeholder="Leave blank to take full payment"
                value={f.deposit_percent ?? ""}
                onChange={(e) => setF({ ...f, deposit_percent: e.target.value === "" ? null : Number(e.target.value) })}
              />
              <p className="mt-1 text-xs text-muted-foreground">
                e.g. 25 — renters pay 25% online and settle the balance with you.
              </p>
            </div>
          )}

          <label className="flex items-start gap-3 pt-1">
            <Switch checked={f.skip_room_selection ?? false} onCheckedChange={(v) => setF({ ...f, skip_room_selection: v })} />
            <span className="text-sm">
              Skip choosing a room
              <span className="block text-xs text-muted-foreground">
                Renters go straight to a calendar and pick a date and time — you just have “{f.quantity ?? 1} rooms” available.
              </span>
            </span>
          </label>

          <label className="flex items-start gap-3 pt-1">
            <Switch checked={f.auto_invoice ?? false} onCheckedChange={(v) => setF({ ...f, auto_invoice: v })} />
            <span className="text-sm">
              Auto-send an invoice
              <span className="block text-xs text-muted-foreground">
                The renting practitioner gets your branded invoice by email as soon as they book (or as soon as their payment clears), with a pay button and your bank details.
              </span>
            </span>
          </label>


          <label className="flex items-center gap-3 pt-1">
            <Switch checked={f.active ?? true} onCheckedChange={(v) => setF({ ...f, active: v })} />
            <span className="text-sm">Show on the public rental page</span>
          </label>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={busy}>{busy ? "Saving…" : "Save room"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function HoursCard({ room, hours, onSaved }: { room: Room; hours: any[]; onSaved: () => void }) {
  const save = useServerFn(saveRentalHours);
  const [rows, setRows] = useState<Record<number, { open: boolean; start: string; end: string }>>(() => {
    const map: Record<number, { open: boolean; start: string; end: string }> = {};
    for (let d = 0; d < 7; d++) {
      const h = hours.find((x) => x.weekday === d);
      map[d] = { open: Boolean(h), start: h ? String(h.start_time).slice(0, 5) : "09:00", end: h ? String(h.end_time).slice(0, 5) : "17:00" };
    }
    return map;
  });
  const [busy, setBusy] = useState(false);

  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-base"><Clock className="h-4 w-4" /> {room.name}</CardTitle></CardHeader>
      <CardContent className="space-y-2">
        {DAYS.map((d, i) => (
          <div key={i} className="flex flex-wrap items-center gap-3">
            <Switch checked={rows[i].open} onCheckedChange={(v) => setRows({ ...rows, [i]: { ...rows[i], open: v } })} />
            <span className="w-24 text-sm">{d}</span>
            <Input type="time" className="w-32" disabled={!rows[i].open} value={rows[i].start} onChange={(e) => setRows({ ...rows, [i]: { ...rows[i], start: e.target.value } })} />
            <span className="text-sm text-muted-foreground">to</span>
            <Input type="time" className="w-32" disabled={!rows[i].open} value={rows[i].end} onChange={(e) => setRows({ ...rows, [i]: { ...rows[i], end: e.target.value } })} />
          </div>
        ))}
        <Button
          className="mt-2"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await save({
                data: {
                  room_id: room.id,
                  hours: Object.entries(rows)
                    .filter(([, v]) => v.open)
                    .map(([d, v]) => ({ weekday: Number(d), start_time: v.start, end_time: v.end })),
                },
              });
              toast.success("Hours saved");
              onSaved();
            } catch (e) {
              toast.error((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >Save hours</Button>
      </CardContent>
    </Card>
  );
}

function BlocksCard({ rooms, blocks, onChanged }: { rooms: Room[]; blocks: any[]; onChanged: () => void }) {
  const add = useServerFn(addRentalBlock);
  const del = useServerFn(deleteRentalBlock);
  const [f, setF] = useState({ room_id: "all", block_date: "", start_time: "", end_time: "", reason: "", units: "" });

  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-base"><CalendarX2 className="h-4 w-4" /> Closures</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-6">
          <div>
            <Label>Room</Label>
            <Select value={f.room_id} onValueChange={(v) => setF({ ...f, room_id: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All rooms</SelectItem>
                {rooms.map((r) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div><Label>Date</Label><Input type="date" value={f.block_date} onChange={(e) => setF({ ...f, block_date: e.target.value })} /></div>
          <div><Label>From (optional)</Label><Input type="time" value={f.start_time} onChange={(e) => setF({ ...f, start_time: e.target.value })} /></div>
          <div><Label>To (optional)</Label><Input type="time" value={f.end_time} onChange={(e) => setF({ ...f, end_time: e.target.value })} /></div>
          <div>
            <Label>Rooms closed</Label>
            <Input
              type="number"
              min={1}
              placeholder="All"
              value={f.units}
              onChange={(e) => setF({ ...f, units: e.target.value })}
            />
            <span className="text-[11px] text-muted-foreground">Leave blank to close them all</span>
          </div>
          <div><Label>Reason</Label><Input value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} /></div>
        </div>
        <Button
          onClick={async () => {
            if (!f.block_date) return toast.error("Pick a date");
            await add({
              data: {
                room_id: f.room_id === "all" ? null : f.room_id,
                block_date: f.block_date,
                start_time: f.start_time || null,
                end_time: f.end_time || null,
                reason: f.reason || null,
                units: f.units ? Math.max(1, Number(f.units)) : null,
              },
            });
            setF({ room_id: "all", block_date: "", start_time: "", end_time: "", reason: "", units: "" });
            onChanged();
          }}
        ><Plus className="mr-2 h-4 w-4" /> Block this out</Button>

        <div className="divide-y">
          {blocks.map((b) => (
            <div key={b.id} className="flex items-center justify-between py-2 text-sm">
              <span>
                {b.block_date} · {b.start_time ? `${String(b.start_time).slice(0, 5)}–${String(b.end_time).slice(0, 5)}` : "All day"} ·{" "}
                {b.room_id ? rooms.find((r) => r.id === b.room_id)?.name ?? "Room" : "All rooms"}
                {b.units ? ` · ${b.units} room${b.units > 1 ? "s" : ""} closed` : " · fully closed"}
                {b.reason ? ` · ${b.reason}` : ""}
              </span>
              <Button size="icon" variant="ghost" onClick={async () => { await del({ data: { id: b.id } }); onChanged(); }}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
          {blocks.length === 0 && <p className="py-2 text-sm text-muted-foreground">No closures.</p>}
        </div>
      </CardContent>
    </Card>
  );
}

function BookingRow({ booking, roomName, onChanged }: { booking: any; roomName: string; onChanged: () => void }) {
  const update = useServerFn(updateRentalBooking);
  const sendLink = useServerFn(sendRentalPaymentLink);
  const sendInvoice = useServerFn(sendRentalInvoice);
  const [sending, setSending] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkMessage, setLinkMessage] = useState("");
  const [mode, setMode] = useState<"link" | "invoice">("link");
  return (
    <Card>
      <CardContent className="flex w-full min-w-0 flex-col gap-3 py-4 sm:flex-row sm:items-center sm:gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold">{booking.renter_name}</span>
            <Badge variant={booking.status === "confirmed" ? "default" : booking.status === "cancelled" ? "secondary" : "outline"}>{booking.status}</Badge>
            <Badge variant={booking.payment_status === "paid" ? "default" : "outline"}>{booking.payment_status}</Badge>
          </div>
          <p className="break-words text-sm text-muted-foreground">
            {roomName}{booking.unit_index ? ` · Room ${booking.unit_index}` : ""} · {booking.booking_date} · {String(booking.start_time).slice(0, 5)}–{String(booking.end_time).slice(0, 5)} · £{Number(booking.price).toFixed(2)}
          </p>
          <p className="break-words text-sm text-muted-foreground">
            {booking.renter_email}{booking.renter_phone ? ` · ${booking.renter_phone}` : ""}{booking.renter_business ? ` · ${booking.renter_business}` : ""}
          </p>
          {booking.notes && <p className="mt-1 text-sm">{booking.notes}</p>}
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:justify-end">
          {booking.status !== "confirmed" && (
            <Button size="sm" onClick={async () => { await update({ data: { id: booking.id, status: "confirmed" } }); onChanged(); }}>Confirm</Button>
          )}
          {booking.payment_status !== "paid" && (
            <Button
              size="sm"
              variant="outline"
              disabled={sending}
              onClick={() => { setMode("link"); setLinkOpen(true); }}
            >
              <Send className="mr-2 h-4 w-4 shrink-0" /> {sending ? "Sending…" : "Payment link"}
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            disabled={sending}
            onClick={() => { setMode("invoice"); setLinkOpen(true); }}
          >
            <FileText className="mr-2 h-4 w-4 shrink-0" /> Invoice
          </Button>
          {booking.payment_status !== "paid" && (
            <Button size="sm" variant="outline" onClick={async () => { await update({ data: { id: booking.id, payment_status: "paid" } }); onChanged(); }}>Mark paid</Button>
          )}
          {booking.status !== "cancelled" && (
            <Button size="sm" variant="ghost" onClick={async () => { await update({ data: { id: booking.id, status: "cancelled" } }); onChanged(); }}>Cancel</Button>
          )}
        </div>
      </CardContent>

      <Dialog open={linkOpen} onOpenChange={setLinkOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{mode === "invoice" ? "Send invoice" : "Send payment link"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Message (optional)</Label>
            <Textarea
              rows={4}
              placeholder={`Hi ${booking.renter_name}, here's the link for your room hire…`}
              value={linkMessage}
              onChange={(e) => setLinkMessage(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">Appears at the top of the email, above the booking details and pay button.</p>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setLinkOpen(false)}>Cancel</Button>
            <Button
              disabled={sending}
              onClick={async () => {
                setSending(true);
                try {
                  if (mode === "invoice") {
                    await sendInvoice({ data: { id: booking.id, origin: window.location.origin, message: linkMessage || null } });
                    toast.success(`Invoice emailed to ${booking.renter_email}`);
                  } else {
                    await sendLink({ data: { id: booking.id, origin: window.location.origin, message: linkMessage || null } });
                    toast.success(`Payment link emailed to ${booking.renter_email}`);
                  }
                  setLinkOpen(false);
                  setLinkMessage("");
                  onChanged();
                } catch (e) {
                  toast.error((e as Error).message);
                } finally {
                  setSending(false);
                }
              }}
            >{sending ? "Sending…" : "Send email"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
