import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { listIncome, upsertIncome, deleteIncome, type IncomeRow } from "@/lib/expenses.functions";
import { INCOME_CATEGORIES, INCOME_FREQUENCIES, incomeCategoryLabel, monthlyEquivalentCents } from "@/lib/expense-utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Pencil, Trash2, Loader2, Receipt, Repeat } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/dashboard/income")({
  ssr: false,
  head: () => ({ meta: [{ title: "Business income — MODO" }] }),
  component: IncomePage,
});

const gbp = (c: number) => `£${(c / 100).toFixed(2)}`;
const today = () => new Date().toISOString().slice(0, 10);

type Draft = { id?: string; name: string; category: string; amount: string; frequency: IncomeRow["frequency"]; start_date: string; end_date: string; notes: string };
const empty = (): Draft => ({ name: "", category: "retail", amount: "", frequency: "one_off", start_date: today(), end_date: "", notes: "" });

function IncomePage() {
  const list = useServerFn(listIncome);
  const save = useServerFn(upsertIncome);
  const remove = useServerFn(deleteIncome);
  const [rows, setRows] = useState<IncomeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);

  const load = () => list().then((r) => setRows(r.income)).catch((e) => toast.error(e.message)).finally(() => setLoading(false));
  useEffect(() => { load(); }, []);

  const recurring = rows.filter((r) => r.frequency !== "one_off" && (!r.end_date || r.end_date >= today()));
  const oneOff = rows.filter((r) => r.frequency === "one_off");
  const monthly = useMemo(() => recurring.reduce((s, r) => s + monthlyEquivalentCents(r), 0), [recurring]);
  const thisMonth = today().slice(0, 7);
  const oneOffThisMonth = oneOff.filter((r) => r.start_date.startsWith(thisMonth)).reduce((s, r) => s + r.amount_cents, 0);

  async function submit() {
    if (!draft) return;
    const amount = Math.round(parseFloat(draft.amount) * 100);
    if (!draft.name.trim() || !(amount >= 0)) return toast.error("Add a name and amount");
    setSaving(true);
    try {
      await save({ data: { id: draft.id, name: draft.name, category: draft.category, amount_cents: amount, frequency: draft.frequency, start_date: draft.start_date, end_date: draft.end_date || null, notes: draft.notes } });
      toast.success("Income saved");
      setDraft(null);
      load();
    } catch (e: any) { toast.error(e.message); } finally { setSaving(false); }
  }

  async function del(id: string) {
    if (!confirm("Delete this income?")) return;
    await remove({ data: { id } }).then(load).catch((e) => toast.error(e.message));
  }

  const Row = ({ r }: { r: IncomeRow }) => (
    <div className="flex items-center gap-3 border-b border-border/50 py-3 last:border-0">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{r.name}</p>
        <p className="text-xs text-muted-foreground">
          {incomeCategoryLabel(r.category)} · {r.frequency === "one_off" ? new Date(r.start_date).toLocaleDateString("en-GB") : `${INCOME_FREQUENCIES.find((f) => f.value === r.frequency)?.label} from ${new Date(r.start_date).toLocaleDateString("en-GB")}${r.end_date ? ` to ${new Date(r.end_date).toLocaleDateString("en-GB")}` : ""}`}
        </p>
      </div>
      <span className="text-sm font-semibold tabular-nums">{gbp(r.amount_cents)}</span>
      <Button size="icon" variant="ghost" onClick={() => setDraft({ id: r.id, name: r.name, category: r.category, amount: (r.amount_cents / 100).toFixed(2), frequency: r.frequency, start_date: r.start_date, end_date: r.end_date ?? "", notes: r.notes ?? "" })}><Pencil className="size-4" /></Button>
      <Button size="icon" variant="ghost" onClick={() => del(r.id)}><Trash2 className="size-4" /></Button>
    </div>
  );

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <div className="flex items-start justify-between gap-3">
        <h1 className="font-serif text-2xl">Business income</h1>
        <Button onClick={() => setDraft(empty())} className="shrink-0 gap-2"><Plus className="size-4" /> Add income</Button>
      </div>
      <p className="-mt-4 text-sm text-muted-foreground">Money made outside treatment bookings — retail, training, room lets and more. This feeds into your analytics.</p>

      <div className="grid grid-cols-3 gap-2 sm:gap-4">
        <Card><CardContent className="p-3 sm:p-4"><p className="text-xs text-muted-foreground">Recurring per month</p><p className="text-base font-semibold sm:text-xl">{gbp(monthly)}</p></CardContent></Card>
        <Card><CardContent className="p-3 sm:p-4"><p className="text-xs text-muted-foreground">One-off this month</p><p className="text-base font-semibold sm:text-xl">{gbp(oneOffThisMonth)}</p></CardContent></Card>
        <Card><CardContent className="p-3 sm:p-4"><p className="text-xs text-muted-foreground">Entries</p><p className="text-base font-semibold sm:text-xl">{rows.length}</p></CardContent></Card>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="size-5 animate-spin" /></div>
      ) : (
        <>
          <Card><CardContent className="p-4">
            <div className="mb-2 flex items-center gap-2"><Repeat className="size-4" /><h2 className="font-medium">Recurring</h2><Badge variant="secondary">{recurring.length}</Badge></div>
            {recurring.length === 0 ? <p className="py-4 text-sm text-muted-foreground">No recurring income yet — e.g. a room you rent out monthly.</p> : recurring.map((r) => <Row key={r.id} r={r} />)}
          </CardContent></Card>
          <Card><CardContent className="p-4">
            <div className="mb-2 flex items-center gap-2"><Receipt className="size-4" /><h2 className="font-medium">One-off</h2><Badge variant="secondary">{oneOff.length}</Badge></div>
            {oneOff.length === 0 ? <p className="py-4 text-sm text-muted-foreground">No one-off income yet — e.g. retail sales or a training day.</p> : oneOff.map((r) => <Row key={r.id} r={r} />)}
          </CardContent></Card>
        </>
      )}

      <Dialog open={!!draft} onOpenChange={(o) => !o && setDraft(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{draft?.id ? "Edit income" : "Add income"}</DialogTitle></DialogHeader>
          {draft && (
            <div className="space-y-3">
              <div><Label>Name</Label><Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="e.g. Skincare sales" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Category</Label>
                  <Select value={draft.category} onValueChange={(v) => setDraft({ ...draft, category: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{INCOME_CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>Amount (£)</Label><Input type="number" step="0.01" min="0" value={draft.amount} onChange={(e) => setDraft({ ...draft, amount: e.target.value })} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>How often</Label>
                  <Select value={draft.frequency} onValueChange={(v) => setDraft({ ...draft, frequency: v as Draft["frequency"] })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{INCOME_FREQUENCIES.map((f) => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>{draft.frequency === "one_off" ? "Date" : "First payment"}</Label><Input type="date" value={draft.start_date} onChange={(e) => setDraft({ ...draft, start_date: e.target.value })} /></div>
              </div>
              {draft.frequency !== "one_off" && (
                <div><Label>End date (optional)</Label><Input type="date" value={draft.end_date} onChange={(e) => setDraft({ ...draft, end_date: e.target.value })} /></div>
              )}
              <div><Label>Notes</Label><Textarea value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} rows={2} /></div>
            </div>
          )}
          <DialogFooter><Button onClick={submit} disabled={saving}>{saving && <Loader2 className="mr-2 size-4 animate-spin" />}Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
