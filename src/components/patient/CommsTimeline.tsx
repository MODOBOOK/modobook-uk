import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { listCommunications } from "@/lib/patient-hub.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Mail, MessageSquare, CreditCard, FileText, FileSignature, StickyNote, Phone } from "lucide-react";

const CHANNEL_ICON: Record<string, any> = {
  email: Mail,
  sms: MessageSquare,
  whatsapp: MessageSquare,
  note: StickyNote,
  payment_link: CreditCard,
  form: FileText,
  consent: FileSignature,
  call: Phone,
};

const CHANNEL_LABEL: Record<string, string> = {
  email: "Email",
  sms: "SMS",
  whatsapp: "WhatsApp",
  note: "Note",
  payment_link: "Payment link",
  form: "Form sent",
  consent: "Consent sent",
};

export function CommsTimeline({ clientId, refreshKey = 0 }: { clientId: string; refreshKey?: number }) {
  const list = useServerFn(listCommunications);
  const [items, setItems] = useState<any[]>([]);

  useEffect(() => {
    list({ data: { clientId } }).then((r: any) => setItems(r ?? []));
  }, [clientId, refreshKey, list]);

  return (
    <Card>
      <CardContent className="p-4">
        <div className="mb-3 flex items-center gap-2">
          <h3 className="font-semibold">Communications</h3>
          <span className="ml-auto text-xs text-muted-foreground">{items.length}</span>
        </div>
        {items.length === 0 ? (
          <p className="text-xs text-muted-foreground">Nothing sent yet. Automatic emails (confirmations, reminders, forms, consents and review requests) will appear here once sent.</p>
        ) : (
          <ol className="relative space-y-3 border-l pl-5">
            {items.map(it => {
              const Icon = CHANNEL_ICON[it.channel] ?? Mail;
              return (
                <li key={it.id} className="relative">
                  <span className="absolute -left-[27px] top-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 ring-2 ring-background">
                    <Icon className="h-3 w-3 text-primary" />
                  </span>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px] uppercase">{CHANNEL_LABEL[it.channel] ?? it.channel}</Badge>
                    <span className="text-xs text-muted-foreground">{new Date(it.created_at).toLocaleString([], { day: "2-digit", month: "short", year: "2-digit", hour: "numeric", minute: "2-digit" })}</span>
                    {it.source === "system" && it.status && it.status !== "sent" && (
                      <Badge variant={["dlq", "failed", "bounced"].includes(it.status) ? "destructive" : "secondary"} className="text-[10px] uppercase">{it.status === "dlq" ? "failed" : it.status}</Badge>
                    )}
                  </div>
                  {it.subject && <div className="mt-0.5 text-sm font-medium">{it.subject}</div>}
                  {it.body && <div className="mt-0.5 line-clamp-3 whitespace-pre-wrap text-xs text-muted-foreground">{it.body}</div>}
                </li>
              );
            })}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
