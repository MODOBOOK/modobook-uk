import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getClientCredit, adjustClientCredit } from "@/lib/patient-credit.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Wallet, Plus, Minus } from "lucide-react";
import { toast } from "sonner";

function gbp(pennies: number) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(pennies / 100);
}

export function PatientCreditCard({ clientId }: { clientId: string }) {
  const fetchCredit = useServerFn(getClientCredit);
  const adjust = useServerFn(adjustClientCredit);
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [sign, setSign] = useState<1 | -1>(1);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const q = useQuery({
    queryKey: ["client-credit", clientId],
    queryFn: () => fetchCredit({ data: { clientId } }),
  });

  const d = q.data;

  async function submit() {
    const pounds = Number(amount);
    if (!Number.isFinite(pounds) || pounds <= 0) {
      toast.error("Enter an amount");
      return;
    }
    setBusy(true);
    try {
      const res: any = await adjust({
        data: { clientId, deltaCents: sign * Math.round(pounds * 100), note: note.trim() || undefined },
      });
      if (!res?.ok) {
        toast.error(
          res?.reason === "not_linked"
            ? "This patient hasn't created an account on your booking page yet."
            : res?.reason === "insufficient"
              ? "That's more than their current balance."
              : "Could not update credit",
        );
        return;
      }
      toast.success(`${sign > 0 ? "Added" : "Deducted"} ${gbp(Math.round(pounds * 100))}`);
      setOpen(false);
      setAmount("");
      setNote("");
      await qc.invalidateQueries({ queryKey: ["client-credit", clientId] });
    } catch (e) {
      toast.error((e as Error).message || "Could not update credit");
    } finally {
      setBusy(false);
    }
  }

  function openWith(s: 1 | -1) {
    setSign(s);
    setAmount("");
    setNote("");
    setOpen(true);
  }

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary">
              <Wallet className="h-5 w-5" />
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Account credit</div>
              <div className="text-2xl font-semibold">{gbp(d?.balanceCents ?? 0)}</div>
              <div className="text-xs text-muted-foreground">
                {d?.linked === false
                  ? "No patient account linked yet"
                  : "They can use this towards bookings when logged in"}
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => openWith(1)}>
              <Plus className="mr-1 h-4 w-4" />Add
            </Button>
            <Button size="sm" variant="outline" onClick={() => openWith(-1)} disabled={(d?.balanceCents ?? 0) <= 0}>
              <Minus className="mr-1 h-4 w-4" />Deduct
            </Button>
          </div>
        </div>

        {!!d?.entries?.length && (
          <div className="space-y-1 rounded-lg border p-2">
            {d.entries.slice(0, 5).map((e) => (
              <div key={e.id} className="flex items-center justify-between gap-3 text-xs">
                <span className="min-w-0 truncate text-muted-foreground">
                  {new Date(e.created_at).toLocaleDateString()} · {e.note || e.reason || "Adjustment"}
                </span>
                <span className={e.delta_pennies < 0 ? "text-destructive" : "text-emerald-600"}>
                  {e.delta_pennies > 0 ? "+" : "−"}{gbp(Math.abs(e.delta_pennies))}
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{sign > 0 ? "Add credit" : "Deduct credit"}</DialogTitle>
            <DialogDescription>
              Current balance {gbp(d?.balanceCents ?? 0)}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Amount (£)</Label>
              <Input
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="50.00"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Reason (optional)</Label>
              <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. paid in clinic" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={submit} disabled={busy}>{busy ? "Saving…" : "Save"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
