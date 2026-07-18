import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { rescheduleAppointment } from "@/lib/appointments.functions";
import { CalendarClock, Loader2 } from "lucide-react";
import { toast } from "sonner";

export function RescheduleAppointmentDialog({
  open,
  onOpenChange,
  appointmentId,
  initialDate,
  initialStart,
  initialEnd,
  onRescheduled,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  appointmentId: string;
  initialDate: string;
  initialStart: string;
  initialEnd: string;
  onRescheduled?: (v: { date: string; start: string; end: string }) => void;
}) {
  const trim = (v: string) => (v?.length >= 5 ? v.slice(0, 5) : v);
  const [date, setDate] = useState(initialDate);
  const [start, setStart] = useState(trim(initialStart));
  const [end, setEnd] = useState(trim(initialEnd));
  const [notify, setNotify] = useState(true);
  const [busy, setBusy] = useState(false);
  const call = useServerFn(rescheduleAppointment);

  async function save() {
    if (!date || !start || !end) {
      toast.error("Pick a date and time");
      return;
    }
    if (end <= start) {
      toast.error("End time must be after start time");
      return;
    }
    setBusy(true);
    try {
      await call({ data: { appointmentId, date, startTime: start, endTime: end, notifyPatient: notify } });
      toast.success("Appointment rescheduled");
      onRescheduled?.({ date, start: `${start}:00`, end: `${end}:00` });
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to reschedule");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarClock className="h-4 w-4" /> Reschedule appointment
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="rs-date">Date</Label>
            <Input id="rs-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="rs-start">Start</Label>
              <Input id="rs-start" type="time" value={start} onChange={(e) => setStart(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rs-end">End</Label>
              <Input id="rs-end" type="time" value={end} onChange={(e) => setEnd(e.target.value)} />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={notify} onCheckedChange={(v) => setNotify(!!v)} />
            Email the patient about the new time
          </label>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>Cancel</Button>
          <Button onClick={save} disabled={busy}>
            {busy && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}Save new time
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
