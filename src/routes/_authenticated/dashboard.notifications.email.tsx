import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { getMyProfile, updateProfile } from "@/lib/profiles.functions";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { SaveReminder } from "@/components/SaveReminder";
import { EmailTemplatesPanel } from "@/components/settings/EmailTemplatesPanel";
import { Input } from "@/components/ui/input";
import { sendTestEmail } from "@/lib/emails.functions";

export const Route = createFileRoute("/_authenticated/dashboard/notifications/email")({
  ssr: false,
  loader: async () => {
    const profile = await getMyProfile();
    if (!profile) throw new Error("No profile");
    return { profile };
  },
  component: EmailNotificationsPage,
});

type Profile = Record<string, unknown> & { id: string };

const REMINDER_PRESETS: { value: number; label: string }[] = [
  { value: 48, label: "2 days before" },
  { value: 24, label: "1 day before" },
  { value: 4, label: "4 hours before" },
  { value: 2, label: "2 hours before" },
  { value: 1, label: "1 hour before" },
];

function EmailNotificationsPage() {
  const { profile } = Route.useLoaderData() as { profile: Profile };
  const [autoConfirm, setAutoConfirm] = useState(profile.auto_confirm_bookings !== false);
  const [confirmations, setConfirmations] = useState(profile.email_confirmations_enabled !== false);
  const [reminderHours, setReminderHours] = useState<number[]>(
    (profile.reminder_hours_before as number[] | null) ?? [24, 2],
  );
  const [saving, setSaving] = useState(false);
  const [notifyNewBooking, setNotifyNewBooking] = useState(
    (profile as { notify_new_booking_email?: boolean }).notify_new_booking_email !== false,
  );
  const [newBookingTo, setNewBookingTo] = useState(
    ((profile as { new_booking_email_to?: string | null }).new_booking_email_to ?? "") as string,
  );
  const [testing, setTesting] = useState(false);

  async function sendNewBookingTest() {
    setTesting(true);
    try {
      const res = (await sendTestEmail({ data: { template_key: "new-booking-practitioner" } })) as {
        sentTo?: string;
      };
      toast.success(`Test alert sent to ${res?.sentTo ?? "your inbox"}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to send test");
    } finally {
      setTesting(false);
    }
  }

  function toggleReminder(hours: number) {
    setReminderHours((p) => {
      const has = p.includes(hours);
      return has ? p.filter((h) => h !== hours) : [...p, hours].sort((a, b) => b - a);
    });
  }

  async function save() {
    setSaving(true);
    try {
      await updateProfile({
        data: {
          id: profile.id,
          auto_confirm_bookings: autoConfirm,
          email_confirmations_enabled: confirmations,
          notify_new_booking_email: notifyNewBooking,
          new_booking_email_to: newBookingTo.trim() || null,
          reminder_hours_before: reminderHours,
        },
      });
      toast.success("Email notifications saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 pb-24">
      <div>
        <h1 className="font-serif text-3xl">Email notifications</h1>
        <p className="text-sm text-muted-foreground">
          Confirmations, reminders and review requests sent by email to your patients — edit the
          wording and set when each one goes out. Available on every plan.
        </p>
      </div>
      <SaveReminder />

      <Card>
        <CardHeader>
          <CardTitle>Email</CardTitle>
          <CardDescription>
            Choose what your patients receive by email and when it&rsquo;s sent.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
            <div className="min-w-0">
              <p className="text-sm font-medium">Auto-confirm bookings</p>
              <p className="text-xs text-muted-foreground">Turn off to manually approve every booking.</p>
            </div>
            <Switch checked={autoConfirm} onCheckedChange={setAutoConfirm} />
          </div>
          <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
            <div className="min-w-0">
              <p className="text-sm font-medium">Email confirmations</p>
              <p className="text-xs text-muted-foreground">Send confirmation email to patient &amp; practitioner.</p>
            </div>
            <Switch checked={confirmations} onCheckedChange={setConfirmations} />
          </div>

          <div className="rounded-lg border p-3">
            <Label className="text-sm font-medium">Email reminder timing</Label>
            <p className="mb-3 text-xs text-muted-foreground">
              Pick when patients should be emailed a reminder before their appointment.
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {REMINDER_PRESETS.map((opt) => {
                const active = reminderHours.includes(opt.value);
                return (
                  <label
                    key={opt.value}
                    className={`flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm transition ${
                      active ? "border-primary bg-primary/5" : "hover:bg-muted/50"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={active}
                      onChange={() => toggleReminder(opt.value)}
                      className="h-4 w-4"
                    />
                    {opt.label}
                  </label>
                );
              })}
            </div>
            {reminderHours.length === 0 && (
              <p className="mt-2 text-xs text-muted-foreground italic">No reminders will be sent.</p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>New booking alerts (to you)</CardTitle>
          <CardDescription>
            Get an email the moment a patient books, with their details, the treatment and the time.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
            <div className="min-w-0">
              <p className="text-sm font-medium">Email me every new booking</p>
              <p className="text-xs text-muted-foreground">Sent as soon as the booking is made.</p>
            </div>
            <Switch checked={notifyNewBooking} onCheckedChange={setNotifyNewBooking} />
          </div>
          <div className="rounded-lg border p-3">
            <Label className="text-sm font-medium">Send alerts to</Label>
            <p className="mb-2 text-xs text-muted-foreground">
              Leave blank to use your clinic email address.
            </p>
            <Input
              type="email"
              value={newBookingTo}
              onChange={(e) => setNewBookingTo(e.target.value)}
              placeholder="bookings@yourclinic.co.uk"
            />
          </div>
          <Button variant="outline" onClick={sendNewBookingTest} disabled={testing}>
            {testing ? "Sending…" : "Send me a test alert"}
          </Button>
        </CardContent>
      </Card>

      <EmailTemplatesPanel />

      <div className="sticky bottom-20 z-10 flex justify-end lg:bottom-4">
        <Button onClick={save} disabled={saving} size="lg" className="shadow-luxe">
          {saving ? "Saving…" : "Save email settings"}
        </Button>
      </div>
    </div>
  );
}