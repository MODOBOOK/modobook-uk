import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getClientPoints, adjustClientPoints } from "@/lib/rewards.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Sparkles, Plus, Minus } from "lucide-react";
import { toast } from "sonner";

export function LoyaltyPointsCard({ clientId }: { clientId: string }) {
  const fetchPoints = useServerFn(getClientPoints);
  const adjust = useServerFn(adjustClientPoints);
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [sign, setSign] = useState<1 | -1>(1);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const q = useQuery({
    queryKey: ["client-points", clientId],
    queryFn: () => fetchPoints({ data: { clientId } }),
  });

  const d = q.data;
  if (!d || !d.settings?.enabled) return null;

  const ppp = Number(d.settings.points_per_pound_redeem ?? 0);
  const worth = ppp > 0 ? d.balance / ppp : 0;

  async function submit() {
    const n = Math.round(Number(amount));
    if (!Number.isFinite(n) || n <= 0) {
      toast.error("Enter a number of points");
      return;
    }
    setBusy(true);
    try {
      const res: any = await adjust({ data: { clientId, delta: sign * n, note: note.trim() || undefined } });
      if (!res?.ok) {
        toast.error(res?.reason === "not_linked"
          ? "This patient hasn't created an account on your booking page yet."
          : "Could not update points");
        return;
      }
      toast.success(`${sign > 0 ? "Added" : "Removed"} ${n} points`);
      setOpen(false);
      setAmount("");
      setNote("");
      await qc.invalidateQueries({ queryKey: ["client-points", clientId] });
    } catch (e) {
      toast.error((e as Error).message || "Could not update points");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Sparkles className="h-4 w-4 text-primary" /> Loyalty points
          </div>
          <Button size="sm" variant="outline" onClick={() => { setSign(1); setOpen(true); }} disabled={!d.linked}>
            <Plus className="mr-1 h-3.5 w-3.5" />Adjust
          </Button>
        </div>

        {!d.linked ? (
          <p className="text-xs text-muted-foreground">
            This patient hasn't created an account on your booking page yet, so points can't be
            stored against them. Once they sign in and book, their balance appears here.
          </p>
        ) : (
          <>
            <div className="flex items-baseline gap-2">
              <span className="font-serif text-2xl">{d.balance.toLocaleString()}</span>
              <span className="text-xs text-muted-foreground">
                points{ppp > 0 ? ` · worth about £${worth.toFixed(2)} off` : ""}
              </span>
            </div>
            {d.entries.length > 0 && (
              <div className="space-y-1 border-t pt-2">
                {d.entries.slice(0, 5).map((e: any) => (
                  <div key={e.id} className="flex items-center justify-between gap-3 text-xs">
                    <span className="truncate text-muted-foreground">
                      {new Date(e.created_at).toLocaleDateString("en-GB")} · {e.note || e.reason}
                    </span>
                    <span className={e.delta >= 0 ? "text-emerald-600" : "text-red-600"}>
                      {e.delta >= 0 ? "+" : ""}{e.delta}
                    </span>
                  </div>
                ))}
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              The patient redeems points at checkout by entering their own referral code.
            </p>
          </>
        )}
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Adjust loyalty points</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="flex gap-2">
              <Button type="button" variant={sign === 1 ? "default" : "outline"} size="sm" onClick={() => setSign(1)}>
                <Plus className="mr-1 h-3.5 w-3.5" />Add
              </Button>
              <Button type="button" variant={sign === -1 ? "default" : "outline"} size="sm" onClick={() => setSign(-1)}>
                <Minus className="mr-1 h-3.5 w-3.5" />Remove
              </Button>
            </div>
            <div>
              <Label className="text-sm">Points</Label>
              <Input
                inputMode="numeric"
                value={amount}
                onChange={(e) => setAmount(e.target.value.replace(/[^0-9]/g, ""))}
                placeholder="e.g. 250"
              />
              {ppp > 0 && amount && (
                <p className="mt-1 text-xs text-muted-foreground">
                  ≈ £{(Number(amount) / ppp).toFixed(2)} of booking credit
                </p>
              )}
            </div>
            <div>
              <Label className="text-sm">Reason (optional)</Label>
              <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Goodwill gesture" />
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
