import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { createPaymentLink } from "@/lib/payment-links.functions";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Copy, Mail, MessageSquare } from "lucide-react";
import { toast } from "sonner";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  patientName?: string;
  patientEmail?: string | null;
  patientPhone?: string | null;
};

export function AdhocPaymentLinkDialog({ open, onOpenChange, patientName, patientEmail, patientPhone }: Props) {
  const create = useServerFn(createPaymentLink);
  const [amount, setAmount] = useState("");
  const [desc, setDesc] = useState("");
  const [busy, setBusy] = useState(false);
  const [url, setUrl] = useState<string | null>(null);

  function close() {
    setAmount(""); setDesc(""); setUrl(null); setBusy(false);
    onOpenChange(false);
  }

  async function submit() {
    const cents = Math.round(parseFloat(amount || "0") * 100);
    if (!Number.isFinite(cents) || cents < 100) { toast.error("Minimum £1.00"); return; }
    setBusy(true);
    try {
      const row: any = await create({
        data: {
          amountCents: cents,
          description: desc || `Payment for ${patientName ?? "patient"}`,
          kind: "adhoc",
          recipientEmail: patientEmail || null,
          recipientName: patientName || null,
          recipientPhone: patientPhone || null,
        },
      });
      const u = row?.stripe_url as string | null;
      setUrl(u);
      if (u && navigator.clipboard) await navigator.clipboard.writeText(u);
      toast.success("Payment link created — copied to clipboard");
    } catch (e: any) {
      toast.error(e?.message || "Failed to create link");
    } finally {
      setBusy(false);
    }
  }

  const smsBody = url ? `Hi ${patientName ?? ""}, here's your secure payment link: ${url}` : "";
  const mailBody = url ? `Hi ${patientName ?? ""},\n\nHere's your secure payment link:\n${url}\n\nThanks!` : "";

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? onOpenChange(true) : close())}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create payment link{patientName ? ` — ${patientName}` : ""}</DialogTitle>
        </DialogHeader>
        {!url ? (
          <div className="space-y-3">
            <div>
              <Label>Amount (£)</Label>
              <Input
                type="number" inputMode="decimal" step="0.01" min="1"
                value={amount}
                onFocus={(e) => { if (e.target.value === "0") setAmount(""); }}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="50.00"
                autoFocus
              />
            </div>
            <div>
              <Label>Description (optional)</Label>
              <Input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="What's this charge for?" />
            </div>
            <p className="text-xs text-muted-foreground">
              A Stripe payment link will be created on your connected account. Any card surcharge you've configured is added automatically.
            </p>
            <DialogFooter>
              <Button variant="ghost" onClick={close}>Cancel</Button>
              <Button onClick={submit} disabled={busy}>{busy ? "Creating…" : "Create link"}</Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm">Payment link is ready. Already copied to your clipboard.</p>
            <Input readOnly value={url} className="text-xs" />
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => { navigator.clipboard.writeText(url); toast.success("Copied"); }}>
                <Copy className="mr-1 h-4 w-4" />Copy
              </Button>
              {patientEmail && (
                <Button asChild variant="outline">
                  <a href={`mailto:${patientEmail}?subject=${encodeURIComponent("Your payment link")}&body=${encodeURIComponent(mailBody)}`}>
                    <Mail className="mr-1 h-4 w-4" />Email
                  </a>
                </Button>
              )}
              {patientPhone && (
                <Button asChild variant="outline">
                  <a href={`sms:${patientPhone}?body=${encodeURIComponent(smsBody)}`}>
                    <MessageSquare className="mr-1 h-4 w-4" />SMS
                  </a>
                </Button>
              )}
              <Button asChild><a href={url} target="_blank" rel="noreferrer">Open</a></Button>
            </div>
            <DialogFooter><Button onClick={close}>Done</Button></DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
