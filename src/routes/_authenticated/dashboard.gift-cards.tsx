import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  listMyGiftCards,
  upsertGiftCard,
  deleteGiftCard,
  listMyGiftCardPurchases,
  issueGiftCardManually,
} from "@/lib/gift-cards.functions";
import { getMyTreatments } from "@/lib/treatments.functions";
import { listMyPackages } from "@/lib/packages.functions";
import { getMyProfile } from "@/lib/profiles.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ImageUploader } from "@/components/ImageUploader";
import { Plus, Pencil, Trash2, Send, Gift, Copy, Check } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/dashboard/gift-cards")({
  head: () => ({
    meta: [
      { title: "Gift cards · MODO" },
      { name: "description", content: "Create and manage gift cards for your clinic." },
    ],
  }),
  component: GiftCardsPage,
});

type GiftCard = {
  id: string;
  name: string;
  description: string | null;
  kind: "value" | "treatment" | "package";
  amount: number | null;
  treatment_id: string | null;
  package_id: string | null;
  image_url: string | null;
  expires_months: number | null;
  active: boolean;
};

function GiftCardsPage() {
  const qc = useQueryClient();
  const listCards = useServerFn(listMyGiftCards);
  const listPurchases = useServerFn(listMyGiftCardPurchases);
  const listT = useServerFn(getMyTreatments);
  const listP = useServerFn(listMyPackages);
  const fetchProfile = useServerFn(getMyProfile);
  const del = useServerFn(deleteGiftCard);

  const cardsQ = useQuery({ queryKey: ["my-gift-cards"], queryFn: () => listCards() });
  const purchasesQ = useQuery({ queryKey: ["my-gift-card-purchases"], queryFn: () => listPurchases() });
  const treatmentsQ = useQuery({ queryKey: ["treatments-for-gift"], queryFn: () => listT() });
  const packagesQ = useQuery({ queryKey: ["packages-for-gift"], queryFn: () => listP() });
  const profileQ = useQuery({ queryKey: ["profile-for-gift"], queryFn: () => fetchProfile() });

  const [editing, setEditing] = useState<GiftCard | null>(null);
  const [open, setOpen] = useState(false);
  const [issueFor, setIssueFor] = useState<GiftCard | null>(null);

  const cards = (cardsQ.data?.cards ?? []) as GiftCard[];
  const purchases = (purchasesQ.data?.purchases ?? []) as Array<Record<string, unknown>>;

  async function handleDelete(id: string) {
    if (!confirm("Delete this gift card? Existing purchases keep working.")) return;
    await del({ data: { id } });
    toast.success("Deleted");
    qc.invalidateQueries({ queryKey: ["my-gift-cards"] });
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold"><Gift className="h-6 w-6" /> Gift cards</h1>
          <p className="text-sm text-muted-foreground">Sell branded gift cards. Buyers pay online; you get paid directly to your Stripe account.</p>
        </div>
        <Button onClick={() => { setEditing(null); setOpen(true); }}><Plus className="mr-1 h-4 w-4" /> New gift card</Button>
      </div>

      <Tabs defaultValue="products">
        <TabsList>
          <TabsTrigger value="products">Products ({cards.length})</TabsTrigger>
          <TabsTrigger value="sold">Sold ({purchases.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="products" className="mt-4 space-y-3">
          {cards.length === 0 && (
            <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">No gift cards yet. Create one above.</CardContent></Card>
          )}
          {cards.map((c) => (
            <Card key={c.id}>
              <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center">
                {c.image_url && <img src={c.image_url} alt="" className="h-20 w-32 shrink-0 rounded-md object-cover" />}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="font-semibold">{c.name}</div>
                    {!c.active && <Badge variant="secondary">Hidden</Badge>}
                    <Badge variant="outline">
                      {c.kind === "value" ? `£${Number(c.amount ?? 0).toFixed(2)}` : c.kind === "treatment" ? "Treatment" : "Package"}
                    </Badge>
                    {c.expires_months && <Badge variant="outline">Expires {c.expires_months}m</Badge>}
                  </div>
                  {c.description && <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{c.description}</p>}
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button size="sm" variant="outline" onClick={() => setIssueFor(c)}><Send className="mr-1 h-3.5 w-3.5" /> Issue</Button>
                  <Button size="sm" variant="ghost" onClick={() => { setEditing(c); setOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                  <Button size="sm" variant="ghost" onClick={() => handleDelete(c.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="sold" className="mt-4">
          <PurchasesTable rows={purchases} />
        </TabsContent>
      </Tabs>

      <GiftCardDialog
        open={open}
        onOpenChange={setOpen}
        editing={editing}
        profileId={(profileQ.data as { id?: string } | null)?.id ?? ""}
        treatments={(treatmentsQ.data as { treatments?: Array<{ id: string; name: string }> })?.treatments ?? []}
        packages={(packagesQ.data as { packages?: Array<{ id: string; name: string }> })?.packages ?? []}
        onSaved={() => { qc.invalidateQueries({ queryKey: ["my-gift-cards"] }); setOpen(false); }}
      />

      {issueFor && (
        <IssueDialog card={issueFor} onClose={() => setIssueFor(null)} onIssued={() => { qc.invalidateQueries({ queryKey: ["my-gift-card-purchases"] }); setIssueFor(null); }} />
      )}
    </div>
  );
}

function GiftCardDialog({
  open, onOpenChange, editing, profileId, treatments, packages, onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing: GiftCard | null;
  profileId: string;
  treatments: Array<{ id: string; name: string }>;
  packages: Array<{ id: string; name: string }>;
  onSaved: () => void;
}) {
  const save = useServerFn(upsertGiftCard);
  const [form, setForm] = useState(() => defaultForm(editing));
  useMemo(() => setForm(defaultForm(editing)), [editing]);
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!form.name.trim()) return toast.error("Name required");
    if (form.kind === "value" && !(Number(form.amount) > 0)) return toast.error("Amount required");
    if (form.kind === "treatment" && !form.treatment_id) return toast.error("Pick a treatment");
    if (form.kind === "package" && !form.package_id) return toast.error("Pick a package");
    setSaving(true);
    try {
      await save({
        data: {
          id: editing?.id,
          name: form.name.trim(),
          description: form.description || null,
          kind: form.kind,
          amount: form.kind === "value" ? Number(form.amount) : null,
          treatment_id: form.kind === "treatment" ? form.treatment_id : null,
          package_id: form.kind === "package" ? form.package_id : null,
          image_url: form.image_url || null,
          expires_months: form.expires_months ? Number(form.expires_months) : null,
          active: form.active,
        },
      });
      toast.success(editing ? "Saved" : "Gift card created");
      onSaved();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader><DialogTitle>{editing ? "Edit gift card" : "New gift card"}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Name</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="£100 Gift Card" />
          </div>
          <div>
            <Label>Type</Label>
            <Select value={form.kind} onValueChange={(v) => setForm({ ...form, kind: v as GiftCard["kind"] })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="value">Monetary value (£)</SelectItem>
                <SelectItem value="treatment">Specific treatment</SelectItem>
                <SelectItem value="package">Specific package</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {form.kind === "value" && (
            <div>
              <Label>Amount (£)</Label>
              <Input type="number" min="1" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
            </div>
          )}
          {form.kind === "treatment" && (
            <div>
              <Label>Treatment</Label>
              <Select value={form.treatment_id ?? ""} onValueChange={(v) => setForm({ ...form, treatment_id: v })}>
                <SelectTrigger><SelectValue placeholder="Select treatment" /></SelectTrigger>
                <SelectContent>{treatments.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          )}
          {form.kind === "package" && (
            <div>
              <Label>Package</Label>
              <Select value={form.package_id ?? ""} onValueChange={(v) => setForm({ ...form, package_id: v })}>
                <SelectTrigger><SelectValue placeholder="Select package" /></SelectTrigger>
                <SelectContent>{packages.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          )}
          <div>
            <Label>Description</Label>
            <Textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div>
            <Label>Cover image</Label>
            {profileId && (
              <ImageUploader
                label="Gift card image"
                value={form.image_url}
                onChange={(url) => setForm({ ...form, image_url: url ?? "" })}
                profileId={profileId}
                folder="gift-cards"
                cropAspect={16 / 9}
              />
            )}
          </div>
          <div>
            <Label>Expires after (months) — leave blank for no expiry</Label>
            <Input type="number" min="1" value={form.expires_months} onChange={(e) => setForm({ ...form, expires_months: e.target.value })} placeholder="12" />
          </div>
          <div className="flex items-center justify-between rounded-md border px-3 py-2">
            <div>
              <div className="text-sm font-medium">Active</div>
              <div className="text-xs text-muted-foreground">Show on your public gift-cards page</div>
            </div>
            <Switch checked={form.active} onCheckedChange={(v) => setForm({ ...form, active: v })} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={saving}>{saving ? "Saving…" : editing ? "Save" : "Create"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function IssueDialog({ card, onClose, onIssued }: { card: GiftCard; onClose: () => void; onIssued: () => void }) {
  const issue = useServerFn(issueGiftCardManually);
  const [form, setForm] = useState({ recipient_name: "", recipient_email: "", buyer_name: "", message: "", send_now: true });
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!form.recipient_name || !form.recipient_email) return toast.error("Recipient name and email required");
    setBusy(true);
    try {
      const res = await issue({ data: { gift_card_id: card.id, ...form } });
      toast.success(`Issued · code ${res.code}`);
      onIssued();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Issue "{card.name}"</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Recipient name</Label><Input value={form.recipient_name} onChange={(e) => setForm({ ...form, recipient_name: e.target.value })} /></div>
          <div><Label>Recipient email</Label><Input type="email" value={form.recipient_email} onChange={(e) => setForm({ ...form, recipient_email: e.target.value })} /></div>
          <div><Label>From (optional)</Label><Input value={form.buyer_name} onChange={(e) => setForm({ ...form, buyer_name: e.target.value })} /></div>
          <div><Label>Personal message (optional)</Label><Textarea rows={3} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} /></div>
          <div className="flex items-center justify-between rounded-md border px-3 py-2">
            <div className="text-sm">Email the code to the recipient now</div>
            <Switch checked={form.send_now} onCheckedChange={(v) => setForm({ ...form, send_now: v })} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={busy}>{busy ? "Issuing…" : "Issue gift card"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PurchasesTable({ rows }: { rows: Array<Record<string, unknown>> }) {
  const [copied, setCopied] = useState<string | null>(null);
  if (rows.length === 0) {
    return <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">No gift cards sold yet.</CardContent></Card>;
  }
  return (
    <Card>
      <CardHeader><CardTitle>All purchases</CardTitle></CardHeader>
      <CardContent className="overflow-x-auto p-0">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-3 py-2">Code</th>
              <th className="px-3 py-2">Recipient</th>
              <th className="px-3 py-2">Initial</th>
              <th className="px-3 py-2">Remaining</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Created</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const code = String(r.code ?? "");
              return (
                <tr key={String(r.id)} className="border-t">
                  <td className="px-3 py-2 font-mono">
                    <button
                      className="inline-flex items-center gap-1 hover:underline"
                      onClick={() => { navigator.clipboard.writeText(code); setCopied(code); setTimeout(() => setCopied(null), 1200); }}
                    >{code} {copied === code ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3 opacity-50" />}</button>
                  </td>
                  <td className="px-3 py-2">{String(r.recipient_name ?? "—")}<br /><span className="text-xs text-muted-foreground">{String(r.recipient_email ?? "")}</span></td>
                  <td className="px-3 py-2">£{Number(r.initial_amount ?? 0).toFixed(2)}</td>
                  <td className="px-3 py-2">£{Number(r.remaining_amount ?? 0).toFixed(2)}</td>
                  <td className="px-3 py-2"><Badge variant={r.status === "active" ? "default" : "secondary"}>{String(r.status ?? "")}</Badge></td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">{r.created_at ? new Date(String(r.created_at)).toLocaleDateString() : ""}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}

function defaultForm(c: GiftCard | null) {
  return {
    name: c?.name ?? "",
    description: c?.description ?? "",
    kind: (c?.kind ?? "value") as GiftCard["kind"],
    amount: c?.amount != null ? String(c.amount) : "",
    treatment_id: c?.treatment_id ?? null as string | null,
    package_id: c?.package_id ?? null as string | null,
    image_url: c?.image_url ?? "",
    expires_months: c?.expires_months != null ? String(c.expires_months) : "12",
    active: c?.active ?? true,
  };
}
