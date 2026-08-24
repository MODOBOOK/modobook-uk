import { Label } from "@/components/ui/label";
import {
  CONFIRMATION_DELAY_OPTIONS,
  REMINDER_HOUR_OPTIONS,
  REVIEW_DELAY_OPTIONS,
  type SmsTimings,
} from "@/lib/whatsapp/templates";

function Chip({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3 py-1 text-xs transition ${
        active
          ? "border-primary bg-primary/10 font-medium text-primary"
          : "text-muted-foreground hover:bg-muted/60"
      }`}
    >
      {children}
    </button>
  );
}

export function SmsTimingEditor({
  value,
  onChange,
}: {
  value: SmsTimings;
  onChange: (v: SmsTimings) => void;
}) {
  function toggleHour(h: number) {
    const has = value.reminderHoursBefore.includes(h);
    const next = has
      ? value.reminderHoursBefore.filter((x) => x !== h)
      : [...value.reminderHoursBefore, h].sort((a, b) => a - b);
    onChange({ ...value, reminderHoursBefore: next });
  }

  return (
    <div className="space-y-3 rounded-lg border p-3">
      <div>
        <Label className="text-sm font-medium">When texts go out</Label>
        <p className="text-xs text-muted-foreground">
          These timings apply to texts only — your email timings stay as they are.
        </p>
      </div>

      <div>
        <p className="mb-1.5 text-xs font-medium">Booking confirmation</p>
        <div className="flex flex-wrap gap-1.5">
          {CONFIRMATION_DELAY_OPTIONS.map((o) => (
            <Chip
              key={o.value}
              active={value.confirmationDelayMinutes === o.value}
              onClick={() => onChange({ ...value, confirmationDelayMinutes: o.value })}
            >
              {o.label}
            </Chip>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-1.5 text-xs font-medium">Appointment reminder</p>
        <div className="flex flex-wrap gap-1.5">
          {REMINDER_HOUR_OPTIONS.map((o) => (
            <Chip
              key={o.value}
              active={value.reminderHoursBefore.includes(o.value)}
              onClick={() => toggleHour(o.value)}
            >
              {o.label}
            </Chip>
          ))}
        </div>
        <p className="mt-1 text-[11px] text-muted-foreground">
          {value.reminderHoursBefore.length === 0
            ? "No reminder texts will be sent."
            : `${value.reminderHoursBefore.length} reminder text${
                value.reminderHoursBefore.length > 1 ? "s" : ""
              } per appointment.`}
        </p>
      </div>

      <div>
        <p className="mb-1.5 text-xs font-medium">Review request</p>
        <div className="flex flex-wrap gap-1.5">
          {REVIEW_DELAY_OPTIONS.map((o) => (
            <Chip
              key={o.value}
              active={value.reviewDelayHours === o.value}
              onClick={() => onChange({ ...value, reviewDelayHours: o.value })}
            >
              {o.label}
            </Chip>
          ))}
        </div>
      </div>
    </div>
  );
}
