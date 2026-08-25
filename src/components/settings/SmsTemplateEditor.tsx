import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  SMS_TEMPLATES,
  SMS_SOFT_LIMIT,
  smsSegments,
  defaultSmsTemplate,
  channelFor,
  type MessageChannel,
  type SmsTemplateKey,
} from "@/lib/whatsapp/templates";

const CHANNELS: Array<{ value: MessageChannel; label: string }> = [
  { value: "both", label: "Text + email" },
  { value: "sms", label: "Text only" },
  { value: "email", label: "Email only" },
  { value: "off", label: "Off" },
];

export function SmsTemplateEditor({
  templates,
  channels,
  onTemplate,
  onChannel,
}: {
  templates: Record<string, string>;
  channels: Record<string, string>;
  onTemplate: (key: SmsTemplateKey, value: string) => void;
  onChannel: (key: SmsTemplateKey, value: MessageChannel) => void;
}) {
  return (
    <div className="space-y-4">
      <p className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-700">
        Web links are never sent by text — UK networks block them.{" "}
        <code>{"{location}"}</code> inserts the location name, and{" "}
        <code>{"{address}"}</code> the full address. The address is only allowed on booking
        confirmations, reminders and reschedules; on other messages it's removed automatically.
      </p>

      {SMS_TEMPLATES.map((t) => {
        const channel = channelFor(channels, t.key);
        const text = templates[t.key] ?? defaultSmsTemplate(t.key);
        const len = text.length;
        const over = len > SMS_SOFT_LIMIT;
        const parts = smsSegments(text);
        const smsOn = channel === "sms" || channel === "both";
        return (
          <div key={t.key} className="rounded-lg border p-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <Label className="text-sm font-medium">{t.label}</Label>
                <p className="text-xs text-muted-foreground">{t.hint}</p>
              </div>
              <div className="flex flex-wrap gap-1">
                {CHANNELS.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => onChannel(t.key, c.value)}
                    className={`rounded-full border px-2.5 py-1 text-xs transition ${
                      channel === c.value
                        ? "border-primary bg-primary/10 font-medium text-primary"
                        : "text-muted-foreground hover:bg-muted/60"
                    }`}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </div>

            {smsOn && (
              <div className="mt-3 space-y-2">
                <Textarea
                  value={text}
                  rows={3}
                  onChange={(e) => onTemplate(t.key, e.target.value)}
                  className={over ? "border-amber-500 focus-visible:ring-amber-500" : undefined}
                />
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap gap-1">
                    {t.tags.map((tag) => (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => onTemplate(t.key, `${text}${text.endsWith(" ") ? "" : " "}${tag}`)}
                        className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground hover:bg-muted/70"
                      >
                        {tag}
                      </button>
                    ))}
                  </div>
                  <span className={`text-xs ${over ? "font-medium text-amber-600" : "text-muted-foreground"}`}>
                    {len}/{SMS_SOFT_LIMIT}
                  </span>
                </div>
                {over && (
                  <p className="rounded-md border border-amber-500/40 bg-amber-500/10 px-2 py-1.5 text-xs text-amber-700">
                    Over {SMS_SOFT_LIMIT} characters — this will send as {parts} texts and cost{" "}
                    {parts}× the credits. Shorten it to keep it to one.
                  </p>
                )}
                {templates[t.key] !== undefined && templates[t.key] !== defaultSmsTemplate(t.key) && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs"
                    onClick={() => onTemplate(t.key, defaultSmsTemplate(t.key))}
                  >
                    Reset to default
                  </Button>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
