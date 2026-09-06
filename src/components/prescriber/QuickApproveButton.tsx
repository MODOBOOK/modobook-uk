import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { quickApproveRxRequest } from "@/lib/rx-requests.functions";
import { getMyPrescriberFees } from "@/lib/prescriber.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Zap, Loader2 } from "lucide-react";
import { toast } from "sonner";

export function QuickApproveButton({ requestId, label }: { requestId: string; label?: string }) {
  const approve = useServerFn(quickApproveRxRequest);
  const getSettings = useServerFn(getMyPrescriberFees);
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);

  async function onOpen(next: boolean) {
    if (next) {
      try {
        const s = await getSettings();
        if (!s.hasPin) {
          toast.error("Set a sign-off PIN first", {
            description: "Open the Prescriber Hub home and add your 4–6 digit PIN.",
          });
          return;
        }
      } catch {
        toast.error("Could not check your PIN settings");
        return;
      }
    }
    setPin("");
    setOpen(next);
  }

  async function submit() {
    if (!/^\d{4,6}$/.test(pin)) {
      toast.error("Enter your 4–6 digit PIN");
      return;
    }
    setBusy(true);
    try {
      await approve({ data: { id: requestId, pin } });
      toast.success("Signed off", { description: "Prescription approved and logged." });
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["rx-prescriber-list"] });
      qc.invalidateQueries({ queryKey: ["rx-prescriber-dash"] });
      qc.invalidateQueries({ queryKey: ["rx-req", requestId] });
      qc.invalidateQueries({ queryKey: ["prescriber-home"] });
    } catch (e) {
      toast.error("Sign-off failed", { description: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => void onOpen(v)}>
      <DialogTrigger asChild>
        <Button size="sm" className="bg-emerald-600 text-white hover:bg-emerald-700">
          <Zap className="mr-1 h-3.5 w-3.5" /> {label ?? "Quick sign-off"}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Quick sign-off</DialogTitle>
          <DialogDescription>
            Enter your 4–6 digit PIN to approve this prescription. The approval is recorded in the
            audit trail with your name and the time.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Input
            type="password"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={6}
            autoFocus
            placeholder="••••"
            className="text-center text-2xl tracking-[0.5em]"
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
            onKeyDown={(e) => {
              if (e.key === "Enter") void submit();
            }}
          />
          <Button className="w-full bg-emerald-600 text-white hover:bg-emerald-700" disabled={busy} onClick={() => void submit()}>
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Approve & sign
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
