import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { getMyProfile, updateProfile } from "@/lib/profiles.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/dashboard/settings")({
  ssr: false,
  loader: async () => {
    const profile = await getMyProfile();
    if (!profile) throw new Error("No profile");
    return { profile };
  },
  component: SettingsPage,
});

type Profile = Record<string, unknown> & { id: string };

function SettingsPage() {
  const { profile } = Route.useLoaderData() as { profile: Profile };
  const [s, setS] = useState({
    // booking window
    booking_min_notice_hours: (profile.booking_min_notice_hours as number) ?? 0,
    booking_max_lead_days: (profile.booking_max_lead_days as number) ?? 90,
    booking_buffer_before_minutes: (profile.booking_buffer_before_minutes as number) ?? 0,
    booking_buffer_after_minutes: (profile.booking_buffer_after_minutes as number) ?? 0,
    booking_daily_cap: (profile.booking_daily_cap as number | null) ?? null,
    booking_smart_times_enabled: !!profile.booking_smart_times_enabled,
    // payments
    payment_card_full_enabled: profile.payment_card_full_enabled !== false,
    payment_deposit_enabled: !!profile.payment_deposit_enabled,
    payment_klarna_enabled: !!profile.payment_klarna_enabled,
    payment_clearpay_enabled: !!profile.payment_clearpay_enabled,
    payment_pass_fees_to_customer: !!profile.payment_pass_fees_to_customer,
    require_deposit_to_confirm: !!profile.require_deposit_to_confirm,
    allow_pay_in_clinic: profile.allow_pay_in_clinic !== false,
    show_prices_on_booking: profile.show_prices_on_booking !== false,
    enforce_cancellation_fee: !!profile.enforce_cancellation_fee,
    // patient rules
    require_account_to_book: !!profile.require_account_to_book,
    require_phone: profile.require_phone !== false,
    require_dob: profile.require_dob !== false,
    require_address: profile.require_address !== false,
    require_medical_forms_before_appt: !!profile.require_medical_forms_before_appt,
    allow_patient_reschedule: profile.allow_patient_reschedule !== false,
    allow_patient_cancel: profile.allow_patient_cancel !== false,
    // confirm & reminders
    auto_confirm_bookings: profile.auto_confirm_bookings !== false,
    email_confirmations_enabled: profile.email_confirmations_enabled !== false,
    sms_reminders_enabled: !!profile.sms_reminders_enabled,
    whatsapp_reminders_enabled: !!profile.whatsapp_reminders_enabled,
    reminder_hours_before: (profile.reminder_hours_before as number[] | null) ?? [24, 2],
  });
  const [saving, setSaving] = useState(false);
  const [reminderInput, setReminderInput] = useState(
    ((profile.reminder_hours_before as number[] | null) ?? [24, 2]).join(", "),
  );

  function set<K extends keyof typeof s>(key: K, val: (typeof s)[K]) {
    setS((p) => ({ ...p, [key]: val }));
  }

  async function save() {
    setSaving(true);
    try {
      const hours = reminderInput
        .split(",")
        .map((x) => Number(x.trim()))
        .filter((n) => Number.isFinite(n) && n > 0);
      await updateProfile({
        data: { id: profile.id, ...s, reminder_hours_before: hours },
      });
      toast.success("Settings saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 pb-24">
      <div>
        <h1 className="font-serif text-3xl">Booking settings</h1>
        <p className="text-sm text-muted-foreground">
          Toggle features on or off. Every option applies to your public booking link.
        </p>
      </div>

      {/* BOOKING WINDOW */}
      <Card>
        <CardHeader>
          <CardTitle>Booking window</CardTitle>
          <CardDescription>Control when patients can book.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <NumberField
              label="Minimum notice (hours)"
              hint="Block bookings within this window."
              value={s.booking_min_notice_hours}
              onChange={(v) => set("booking_min_notice_hours", Number(v) || 0)}
            />
            <NumberField
              label="Max lead time (days)"
              hint="How far ahead patients can book."
              value={s.booking_max_lead_days}
              onChange={(v) => set("booking_max_lead_days", Number(v) || 0)}
            />
            <NumberField
              label="Buffer before (mins)"
              hint="Padding before each appointment."
              value={s.booking_buffer_before_minutes}
              onChange={(v) => set("booking_buffer_before_minutes", Number(v) || 0)}
            />
            <NumberField
              label="Buffer after (mins)"
              hint="Padding after each appointment."
              value={s.booking_buffer_after_minutes}
              onChange={(v) => set("booking_buffer_after_minutes", Number(v) || 0)}
            />
            <NumberField
              label="Daily booking cap"
              hint="Leave empty for no cap."
              value={s.booking_daily_cap ?? ""}
              allowEmpty
              onChange={(v) => set("booking_daily_cap", v === "" ? null : Number(v))}
            />
          </div>
          <ToggleRow
            label="Smart appointment times"
            hint="Automatically pack slots to reduce gaps."
            checked={s.booking_smart_times_enabled}
            onChange={(v) => set("booking_smart_times_enabled", v)}
          />
        </CardContent>
      </Card>

      {/* PAYMENTS */}
      <Card>
        <CardHeader>
          <CardTitle>Payments & deposits</CardTitle>
          <CardDescription>Which methods patients can use to pay.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-1">
          <ToggleRow
            label="Full card payment"
            hint="Standard Stripe card checkout."
            checked={s.payment_card_full_enabled}
            onChange={(v) => set("payment_card_full_enabled", v)}
          />
          <ToggleRow
            label="Deposits"
            hint="Take a deposit at booking, pay rest at the clinic."
            checked={s.payment_deposit_enabled}
            onChange={(v) => set("payment_deposit_enabled", v)}
          />
          <ToggleRow
            label="Klarna"
            hint="Pay in 3 / pay later via Klarna."
            checked={s.payment_klarna_enabled}
            onChange={(v) => set("payment_klarna_enabled", v)}
          />
          <ToggleRow
            label="Clearpay"
            hint="Buy-now-pay-later via Clearpay."
            checked={s.payment_clearpay_enabled}
            onChange={(v) => set("payment_clearpay_enabled", v)}
          />
          <ToggleRow
            label="Pass processing fees to customer"
            hint="Adds Stripe/Klarna/Clearpay fees on top of the treatment price."
            checked={s.payment_pass_fees_to_customer}
            onChange={(v) => set("payment_pass_fees_to_customer", v)}
          />
          <ToggleRow
            label="Require deposit to confirm booking"
            hint="Bookings stay pending until deposit is paid."
            checked={s.require_deposit_to_confirm}
            onChange={(v) => set("require_deposit_to_confirm", v)}
          />
          <ToggleRow
            label="Allow pay in clinic"
            hint="Show 'Pay at appointment' option at checkout."
            checked={s.allow_pay_in_clinic}
            onChange={(v) => set("allow_pay_in_clinic", v)}
          />
          <ToggleRow
            label="Show prices on booking page"
            hint="Turn off to hide prices (good for consult-led clinics)."
            checked={s.show_prices_on_booking}
            onChange={(v) => set("show_prices_on_booking", v)}
          />
          <ToggleRow
            label="Auto-charge cancellation fee"
            hint="Charge stored card based on your cancellation policy."
            checked={s.enforce_cancellation_fee}
            onChange={(v) => set("enforce_cancellation_fee", v)}
          />
        </CardContent>
      </Card>

      {/* PATIENT RULES */}
      <Card>
        <CardHeader>
          <CardTitle>Patient rules</CardTitle>
          <CardDescription>What patients must provide and what they can change.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-1">
          <ToggleRow
            label="Require account / login to book"
            checked={s.require_account_to_book}
            onChange={(v) => set("require_account_to_book", v)}
          />
          <ToggleRow
            label="Require phone number"
            checked={s.require_phone}
            onChange={(v) => set("require_phone", v)}
          />
          <ToggleRow
            label="Require date of birth"
            checked={s.require_dob}
            onChange={(v) => set("require_dob", v)}
          />
          <ToggleRow
            label="Require full address"
            checked={s.require_address}
            onChange={(v) => set("require_address", v)}
          />
          <ToggleRow
            label="Require medical forms completed before appointment"
            hint="Patient must submit forms before the appointment can go ahead."
            checked={s.require_medical_forms_before_appt}
            onChange={(v) => set("require_medical_forms_before_appt", v)}
          />
          <ToggleRow
            label="Allow patient self-reschedule"
            checked={s.allow_patient_reschedule}
            onChange={(v) => set("allow_patient_reschedule", v)}
          />
          <ToggleRow
            label="Allow patient self-cancel"
            checked={s.allow_patient_cancel}
            onChange={(v) => set("allow_patient_cancel", v)}
          />
        </CardContent>
      </Card>

      {/* CONFIRMATIONS & REMINDERS */}
      <Card>
        <CardHeader>
          <CardTitle>Confirmations & reminders</CardTitle>
          <CardDescription>How bookings get confirmed and reminded.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <ToggleRow
            label="Auto-confirm bookings"
            hint="Turn off to manually approve every booking."
            checked={s.auto_confirm_bookings}
            onChange={(v) => set("auto_confirm_bookings", v)}
          />
          <ToggleRow
            label="Email confirmations"
            hint="Send confirmation email to patient & practitioner."
            checked={s.email_confirmations_enabled}
            onChange={(v) => set("email_confirmations_enabled", v)}
          />
          <ToggleRow
            label="SMS reminders"
            checked={s.sms_reminders_enabled}
            onChange={(v) => set("sms_reminders_enabled", v)}
          />
          <ToggleRow
            label="WhatsApp reminders"
            checked={s.whatsapp_reminders_enabled}
            onChange={(v) => set("whatsapp_reminders_enabled", v)}
          />
          <div className="rounded-lg border p-3">
            <Label className="text-sm font-medium">Reminder timing (hours before)</Label>
            <p className="mb-2 text-xs text-muted-foreground">
              Comma-separated. E.g. <code>24, 2</code> sends one a day before and one 2 hours before.
            </p>
            <Input
              value={reminderInput}
              onChange={(e) => setReminderInput(e.target.value)}
              placeholder="24, 2"
            />
          </div>
        </CardContent>
      </Card>

      <div className="sticky bottom-20 z-10 flex justify-end lg:bottom-4">
        <Button onClick={save} disabled={saving} size="lg" className="shadow-luxe">
          {saving ? "Saving…" : "Save all settings"}
        </Button>
      </div>
    </div>
  );
}

function ToggleRow({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
      <div className="min-w-0">
        <p className="text-sm font-medium">{label}</p>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

function NumberField({
  label,
  hint,
  value,
  onChange,
  allowEmpty,
}: {
  label: string;
  hint?: string;
  value: number | string;
  onChange: (v: number | string) => void;
  allowEmpty?: boolean;
}) {
  return (
    <div>
      <Label className="text-xs">{label}</Label>
      <Input
        type="number"
        min="0"
        value={value as number | string}
        onChange={(e) => {
          const raw = e.target.value;
          if (allowEmpty && raw === "") return onChange("");
          onChange(Number(raw));
        }}
      />
      {hint && <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}
