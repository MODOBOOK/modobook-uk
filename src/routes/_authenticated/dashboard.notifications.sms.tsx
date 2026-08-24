import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { getMyProfile, updateProfile } from "@/lib/profiles.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { SaveReminder } from "@/components/SaveReminder";
import { sendWhatsAppTest } from "@/lib/whatsapp.functions";
import { whatsappMessagingEnabled } from "@/lib/feature-flags";
import { SmsTemplateEditor } from "@/components/settings/SmsTemplateEditor";
import { SmsTimingEditor } from "@/components/settings/SmsTimingEditor";
import { parseSmsTimings } from "@/lib/whatsapp/templates";

export const Route = createFileRoute("/_authenticated/dashboard/notifications/sms")({
  ssr: false,
  loader: async () => {
    const profile = await getMyProfile();
    if (!profile) throw new Error("No profile");
    return { profile };
  },
  component: SmsNotificationsPage,
});

type Profile = Record<string, unknown> & { id: string };

function SmsNotificationsPage() {
  const { profile } = Route.useLoaderData() as { profile: Profile };
  const [enabled, setEnabled] = useState(!!profile.whatsapp_reminders_enabled);
  const [smsTemplates, setSmsTemplates] = useState<Record<string, string>>(
    ((profile.sms_templates as Record<string, string> | null) ?? {}) as Record<string, string>,
  );
  const [smsChannels, setSmsChannels] = useState<Record<string, string>>(
    ((profile.sms_channels as Record<string, string> | null) ?? {}) as Record<string, string>,
  );
  const [smsTimings, setSmsTimings] = useState(parseSmsTimings((profile as { sms_timings?: unknown }).sms_timings));
  const [saving, setSaving] = useState(false);
  const [testPhone, setTestPhone] = useState("");
  const [testing, setTesting] = useState(false);

  async function save() {
    setSaving(true);
    try {
      await updateProfile({
        data: {
          id: profile.id,
          whatsapp_reminders_enabled: enabled,
          sms_templates: smsTemplates,
          sms_channels: smsChannels,
          sms_timings: smsTimings,
        },
      });
      toast.success("SMS notifications saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

return (
    <div className="mx-auto max-w-3xl space-y-6 pb-24">
      <div>
        <h1 className="font-serif text-3xl">SMS notifications</h1>
        <p className="text-sm text-muted-foreground">
          Booking confirmations, reminders and review requests by text from MODO.
        </p>
      </div>
      <SaveReminder />

      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="space-y-1 p-4">
          <p className="flex items-center gap-2 text-sm font-semibold">
            SMS reminders
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-primary">
              Coming soon
            </span>
          </p>
          <p className="text-xs text-muted-foreground">
            Automatic text reminders sent ahead of each appointment are in final testing. They&rsquo;ll
            switch on here shortly — no action needed from you.
          </p>
        </CardContent>
      </Card>

      {!whatsappMessagingEnabled(profile.slug as string | null) ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              SMS
              <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Coming soon
              </span>
            </CardTitle>
            <CardDescription>
              Send booking confirmations, reminders and review requests by text from MODO.
              We&rsquo;re piloting this with a small group of clinics first — it&rsquo;ll be switched
              on for your account soon.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>SMS</CardTitle>
            <CardDescription>
              Patients get a text from MODO on your clinic&rsquo;s behalf. Choose what goes out by
              text, email or both, and edit the wording. Only patients with a mobile number on file
              are texted, and they can reply STOP at any time.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
              <div className="min-w-0">
                <p className="text-sm font-medium">Text message notifications</p>
                <p className="text-xs text-muted-foreground">Master switch for this clinic. Off by default.</p>
              </div>
              <Switch checked={enabled} onCheckedChange={setEnabled} />
            </div>
            {enabled && (
              <div className="space-y-3 rounded-lg border border-dashed p-3">
                <SmsTimingEditor value={smsTimings} onChange={setSmsTimings} />

                <SmsTemplateEditor
                  templates={smsTemplates}
                  channels={smsChannels}
                  onTemplate={(k, v) => setSmsTemplates({ ...smsTemplates, [k]: v })}
                  onChannel={(k, v) => setSmsChannels({ ...smsChannels, [k]: v })}
                />

                <div className="rounded-lg border p-3">
                  <p className="text-sm font-medium">Send yourself a test</p>
                  <p className="mb-2 text-xs text-muted-foreground">
                    Enter your own mobile to check how it looks.
                  </p>
                  <div className="flex gap-2">
                    <Input
                      value={testPhone}
                      onChange={(e) => setTestPhone(e.target.value)}
                      placeholder="07700 900123"
                    />
                    <Button
                      variant="outline"
                      disabled={testing || !testPhone.trim()}
                      onClick={async () => {
                        setTesting(true);
                        try {
                          const r = await sendWhatsAppTest({ data: { phone: testPhone.trim() } });
                          if (r.ok) toast.success(r.message);
                          else toast.error(r.message);
                        } catch (e) {
                          toast.error(e instanceof Error ? e.message : "Could not send");
                        } finally {
                          setTesting(false);
                        }
                      }}
                    >
                      {testing ? "Sending…" : "Send test"}
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <div className="sticky bottom-20 z-10 flex justify-end lg:bottom-4">
        <Button onClick={save} disabled={saving} size="lg" className="shadow-luxe">
          {saving ? "Saving…" : "Save SMS settings"}
        </Button>
      </div>
    </div>
  );
}