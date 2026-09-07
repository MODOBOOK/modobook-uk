import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Check } from "lucide-react";
import { toast } from "sonner";
import {
  listAppointmentExtras,
  addAppointmentExtra,
  updateAppointmentExtra,
  removeAppointmentExtra,
  setAppointmentBasePrice,
  listTreatmentsForExtras,
} from "@/lib/appointment-extras.functions";

type Extra = { id: string; treatment_id: string | null; name: string; unit_price: number; quantity: number };

/**
 * Added on the day: the client comes in for one thing and has something else
 * too. Extras sit alongside the booked treatment and the total updates so the
 * amount to take at checkout is right.
 */
export function AppointmentExtrasPanel({
  appointmentId,
  bookedName,
  disabled,
  onTotalChange,
}: {
  appointmentId: string;
  bookedName: string;
  disabled?: boolean;
  onTotalChange: (total: number) => void;
}) {
  const load = useServerFn(listAppointmentExtras);
  const loadTreatments = useServerFn(listTreatmentsForExtras);
  const add = useServerFn(addAppointmentExtra);
  const patch = useServerFn(updateAppointmentExtra);
  const remove = useServerFn(removeAppointmentExtra);
  const setBase = useServerFn(setAppointmentBasePrice);

  const [extras, setExtras] = useState<Extra[]>([]);
  const [treatments, setTreatments] = useState<{ id: string; name: string; price: number | null }[]>([]);
  const [basePrice, setBasePrice] = useState("");
  const [pick, setPick] = useState<string>("");
  const [customName, setCustomName] = useState("");
  const [newPrice, setNewPrice] = useState("");
  const [busy, setBusy] = useState(false);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    let off = false;
    load({ data: { appointmentId } })
      .then((r) => {
        if (off) return;
        setExtras(r.extras as Extra[]);
        setBasePrice(Number(r.baseAmount ?? 0).toFixed(2));
      })
      .catch(() => {});
    loadTreatments({})
      .then((r) => { if (!off) setTreatments(r as typeof treatments); })
      .catch(() => {});
    return () => { off = true; };
  }, [appointmentId, load, loadTreatments]);

  function applyTotals(r: { baseAmount: number; total: number }) {
    setBasePrice(Number(r.baseAmount).toFixed(2));
    onTotalChange(Number(r.total));
  }

  async function refresh() {
    const r = await load({ data: { appointmentId } });
    setExtras(r.extras as Extra[]);
    setBasePrice(Number(r.baseAmount ?? 0).toFixed(2));
    onTotalChange(Number(r.total ?? 0));
  }

  async function saveBase() {
    setBusy(true);
    try {
      const r = await setBase({ data: { appointmentId, basePrice: parseFloat(basePrice || "0") } });
      applyTotals(r);
      toast.success("Price updated");
    } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  }

  async function addExtra() {
    const chosen = treatments.find((t) => t.id === pick);
    const name = chosen?.name ?? customName.trim();
    if (!name) { toast.error("Choose a treatment or type a name"); return; }
    const price = parseFloat(newPrice || String(chosen?.price ?? 0)) || 0;
    setBusy(true);
    try {
      const r = await add({
        data: { appointmentId, treatmentId: chosen?.id ?? null, name, unitPrice: price, quantity: 1 },
      });
      applyTotals(r);
      setPick(""); setCustomName(""); setNewPrice(""); setAdding(false);
      await refresh();
      toast.success("Treatment added");
    } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  }

  async function editExtra(id: string, fields: { unitPrice?: number; quantity?: number }) {
    setBusy(true);
    try {
      const r = await patch({ data: { id, appointmentId, ...fields } });
      applyTotals(r);
    } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  }

  async function deleteExtra(id: string) {
    setBusy(true);
    try {
      const r = await remove({ data: { id, appointmentId } });
      setExtras((prev) => prev.filter((e) => e.id !== id));
      applyTotals(r);
    } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  }

  return (
    <div className="rounded-lg border p-3 space-y-3">
      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Treatments on the day
      </div>

      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1 truncate text-sm">{bookedName}</div>
        <div className="flex items-center gap-1">
          <span className="text-sm text-muted-foreground">£</span>
          <Input
            className="h-8 w-20"
            inputMode="decimal"
            value={basePrice}
            disabled={disabled || busy}
            onChange={(e) => setBasePrice(e.target.value)}
            onBlur={saveBase}
          />
        </div>
      </div>

      {extras.map((x) => (
        <div key={x.id} className="flex items-center gap-2">
          <div className="min-w-0 flex-1 truncate text-sm">{x.name}</div>
          <Input
            className="h-8 w-14"
            inputMode="numeric"
            defaultValue={String(x.quantity)}
            disabled={disabled || busy}
            onBlur={(e) => editExtra(x.id, { quantity: parseInt(e.target.value || "1", 10) })}
          />
          <div className="flex items-center gap-1">
            <span className="text-sm text-muted-foreground">£</span>
            <Input
              className="h-8 w-20"
              inputMode="decimal"
              defaultValue={Number(x.unit_price).toFixed(2)}
              disabled={disabled || busy}
              onBlur={(e) => editExtra(x.id, { unitPrice: parseFloat(e.target.value || "0") })}
            />
          </div>
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8 text-destructive"
            disabled={disabled || busy}
            onClick={() => deleteExtra(x.id)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ))}

      {adding ? (
        <div className="space-y-2 rounded-md bg-muted/40 p-2">
          <div>
            <Label className="text-xs">Add a treatment</Label>
            <Select
              value={pick}
              onValueChange={(v) => {
                setPick(v);
                const t = treatments.find((x) => x.id === v);
                if (t?.price != null) setNewPrice(Number(t.price).toFixed(2));
              }}
            >
              <SelectTrigger className="h-9 mt-1"><SelectValue placeholder="Choose from your services" /></SelectTrigger>
              <SelectContent>
                {treatments.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}{t.price != null ? ` — £${Number(t.price).toFixed(2)}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {!pick && (
            <Input
              className="h-9"
              placeholder="Or type something else (e.g. extra 0.5ml)"
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
            />
          )}
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">£</span>
            <Input
              className="h-9 w-24"
              inputMode="decimal"
              placeholder="0.00"
              value={newPrice}
              onChange={(e) => setNewPrice(e.target.value)}
            />
            <Button size="sm" className="ml-auto" disabled={busy} onClick={addExtra}>
              <Check className="h-4 w-4 mr-1" /> Add
            </Button>
            <Button size="sm" variant="ghost" disabled={busy} onClick={() => setAdding(false)}>Cancel</Button>
          </div>
        </div>
      ) : (
        <Button size="sm" variant="outline" className="w-full" disabled={disabled || busy} onClick={() => setAdding(true)}>
          <Plus className="h-4 w-4 mr-1" /> Add treatment
        </Button>
      )}
    </div>
  );
}
