import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
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
  price: number | null;
  treatment_id: string | null;
  package_id: string | null;
  treatment_ids: string[] | null;
  package_ids: string[] | null;
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
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
        <div className="min-w-0">
          <h1 className="flex items-center gap-2 text-2xl font-bold"><Gift className="h-6 w-6" /> Gift cards</h1>
          <p className="text-sm text-muted-foreground">Sell branded gift cards. Buyers pay online; you get paid directly to your Stripe account.</p>
        </div>
        <Button className="shrink-0" onClick={() => { setEditing(null); setOpen(true); }}><Plus className="mr-1 h-4 w-4" /> <span className="sm:hidden">New</span><span className="hidden sm:inline">New gift card</span></Button>
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
                    {c.price != null && Number(c.price) > 0 && Number(c.price) !== Number(c.amount ?? 0) && (
                      <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">Sells for £{Number(c.price).toFixed(2)}</Badge>
                    )}
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
        treatments={((treatmentsQ.data as any)?.treatments ?? (treatmentsQ.data as any) ?? []) as Array<{ id: string; name: string; price?: number | null; description?: string | null }>}
        packages={((packagesQ.data as any)?.packages ?? (packagesQ.data as any) ?? []) as Array<{ id: string; name: string; price?: number | null; description?: string | null }>}
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
  treatments: Array<{ id: string; name: string; price?: number | null; description?: string | null }>;
  packages: Array<{ id: string; name: string; price?: number | null; description?: string | null }>;
  onSaved: () => void;
}) {
  const save = useServerFn(upsertGiftCard);
  const [form, setForm] = useState(() => defaultForm(editing));
  useEffect(() => { setForm(defaultForm(editing)); }, [editing]);
  const [saving, setSaving] = useState(false);

  // Sum of the selected treatments/packages, used as the default (mirrored) price.
  const selectedTreatmentsTotal = form.treatment_ids.reduce((s, id) => {
    const t = treatments.find((x) => x.id === id);
    return s + Number(t?.price ?? 0);
  }, 0);
  const selectedPackagesTotal = form.package_ids.reduce((s, id) => {
    const p = packages.find((x) => x.id === id);
    return s + Number(p?.price ?? 0);
  }, 0);
  const mirroredTotal =
    form.kind === "treatment" ? selectedTreatmentsTotal :
    form.kind === "package" ? selectedPackagesTotal : 0;

  async function submit() {
    if (!form.name.trim()) return toast.error("Name required");
    if (form.kind === "value" && !(Number(form.amount) > 0)) return toast.error("Amount required");
    if (form.kind === "treatment" && form.treatment_ids.length === 0) return toast.error("Pick at least one treatment");
    if (form.kind === "package" && form.package_ids.length === 0) return toast.error("Pick at least one package");
    setSaving(true);
    try {
      // For value cards the amount comes from the amount field. For treatment/package
      // cards we save the price override (blank = mirror the treatment/package price).
      const savedAmount =
        form.kind === "value"
          ? Number(form.amount)
          : form.amount.trim() === ""
            ? null
            : Number(form.amount);
      await save({
        data: {
          id: editing?.id,
          name: form.name.trim(),
          description: form.description || null,
          kind: form.kind,
          amount: savedAmount,
          price: form.price.trim() === "" ? null : Number(form.price),
          treatment_ids: form.kind === "treatment" ? form.treatment_ids : [],
          package_ids: form.kind === "package" ? form.package_ids : [],
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
              <Label>Card value (£)</Label>
              <Input type="number" min="1" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
              <p className="mt-1 text-xs text-muted-foreground">The credit the recipient can spend with you.</p>
            </div>
          )}
          <SalePrice form={form} setForm={setForm} faceValue={form.kind === "value" ? Number(form.amount || 0) : (form.amount.trim() !== "" ? Number(form.amount) : mirroredTotal)} />
          {form.kind === "treatment" && (
            <div className="space-y-2">
              <Label>Treatments (select one or more)</Label>
              <div className="mt-1 max-h-64 overflow-y-auto rounded-md border p-2">
                {treatments.length === 0 && <div className="p-2 text-sm text-muted-foreground">No treatments yet.</div>}
                {treatments.map((t) => {
                  const checked = form.treatment_ids.includes(t.id);
                  return (
                    <label key={t.id} className="flex cursor-pointer items-start gap-2 rounded px-2 py-2 text-sm hover:bg-muted">
                      <input
                        type="checkbox"
                        className="mt-1"
                        checked={checked}
                        onChange={(e) => {
                          const next = e.target.checked
                            ? [...form.treatment_ids, t.id]
                            : form.treatment_ids.filter((x) => x !== t.id);
                          setForm((f) => ({
                            ...f,
                            treatment_ids: next,
                            // Autofill name/description on the first pick when blank.
                            name: !f.name && next.length === 1 && e.target.checked ? t.name : f.name,
                            description: !f.description && next.length === 1 && e.target.checked ? (t.description ?? "") : f.description,
                          }));
                        }}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium">{t.name}</span>
                          <span className="shrink-0 text-xs text-muted-foreground">£{Number(t.price ?? 0).toFixed(2)}</span>
                        </div>
                        {t.description && (
                          <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{t.description}</p>
                        )}
                      </div>
                    </label>
                  );
                })}
              </div>
              <PriceOverride form={form} setForm={setForm} mirrored={mirroredTotal} label="treatment" />
            </div>
          )}
          {form.kind === "package" && (
            <div className="space-y-2">
              <Label>Packages (select one or more)</Label>
              <div className="mt-1 max-h-64 overflow-y-auto rounded-md border p-2">
                {packages.length === 0 && <div className="p-2 text-sm text-muted-foreground">No packages yet.</div>}
                {packages.map((p) => {
                  const checked = form.package_ids.includes(p.id);
                  return (
                    <label key={p.id} className="flex cursor-pointer items-start gap-2 rounded px-2 py-2 text-sm hover:bg-muted">
                      <input
                        type="checkbox"
                        className="mt-1"
                        checked={checked}
                        onChange={(e) => {
                          const next = e.target.checked
                            ? [...form.package_ids, p.id]
                            : form.package_ids.filter((x) => x !== p.id);
                          setForm((f) => ({
                            ...f,
                            package_ids: next,
                            name: !f.name && next.length === 1 && e.target.checked ? p.name : f.name,
                            description: !f.description && next.length === 1 && e.target.checked ? (p.description ?? "") : f.description,
                          }));
                        }}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium">{p.name}</span>
                          <span className="shrink-0 text-xs text-muted-foreground">£{Number(p.price ?? 0).toFixed(2)}</span>
                        </div>
                        {p.description && (
                          <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{p.description}</p>
                        )}
                      </div>
                    </label>
                  );
                })}
              </div>
              <PriceOverride form={form} setForm={setForm} mirrored={mirroredTotal} label="package" />
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
  const [form, setForm] = useState({
    recipient_name: "",
    recipient_email: "",
    buyer_name: "",
    message: "",
    send_now: true,
    custom_amount: card.kind === "value" ? String(card.amount ?? "") : "",
  });
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!form.recipient_name || !form.recipient_email) return toast.error("Recipient name and email required");
    setBusy(true);
    try {
      const custom = form.custom_amount.trim() === "" ? null : Number(form.custom_amount);
      const res = await issue({ data: {
        gift_card_id: card.id,
        recipient_name: form.recipient_name,
        recipient_email: form.recipient_email,
        buyer_name: form.buyer_name || undefined,
        message: form.message || undefined,
        send_now: form.send_now,
        custom_amount: card.kind === "value" ? custom : null,
      } });
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
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Send "{card.name}"</DialogTitle>
          <p className="text-xs text-muted-foreground">Issue for free, comp, or as a gift. The recipient receives a branded email with the code and your personal message.</p>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Recipient name</Label><Input value={form.recipient_name} onChange={(e) => setForm({ ...form, recipient_name: e.target.value })} /></div>
            <div><Label>Recipient email</Label><Input type="email" value={form.recipient_email} onChange={(e) => setForm({ ...form, recipient_email: e.target.value })} /></div>
          </div>
          <div><Label>From (optional)</Label><Input value={form.buyer_name} onChange={(e) => setForm({ ...form, buyer_name: e.target.value })} placeholder="e.g. Nurse Ryan / The Clinic Team" /></div>
          {card.kind === "value" && (
            <div>
              <Label>Amount to load (£)</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={form.custom_amount}
                onChange={(e) => setForm({ ...form, custom_amount: e.target.value })}
                placeholder="0 for a free/comp card"
              />
              <p className="mt-1 text-[11px] text-muted-foreground">Leave the default or override. Zero-value cards are useful as VIP or apology tokens paired with a message.</p>
            </div>
          )}
          <div>
            <Label>Personal message (optional)</Label>
            <Textarea rows={3} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} placeholder="Thank you for being such a loyal client…" />
          </div>
          <div className="flex items-center justify-between rounded-md border px-3 py-2">
            <div className="text-sm">Email the code to the recipient now</div>
            <Switch checked={form.send_now} onCheckedChange={(v) => setForm({ ...form, send_now: v })} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={busy}>{busy ? "Sending…" : "Send gift card"}</Button>
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
  const tIds = c?.treatment_ids && c.treatment_ids.length > 0
    ? c.treatment_ids
    : (c?.treatment_id ? [c.treatment_id] : []);
  const pIds = c?.package_ids && c.package_ids.length > 0
    ? c.package_ids
    : (c?.package_id ? [c.package_id] : []);
  return {
    name: c?.name ?? "",
    description: c?.description ?? "",
    kind: (c?.kind ?? "value") as GiftCard["kind"],
    amount: c?.amount != null ? String(c.amount) : "",
    price: c?.price != null ? String(c.price) : "",
    treatment_ids: tIds,
    package_ids: pIds,
    image_url: c?.image_url ?? "",
    expires_months: c?.expires_months != null ? String(c.expires_months) : "12",
    active: c?.active ?? true,
  };
}

type FormShape = ReturnType<typeof defaultForm>;

function PriceOverride({
  form,
  setForm,
  mirrored,
  label,
}: {
  form: FormShape;
  setForm: React.Dispatch<React.SetStateAction<FormShape>>;
  mirrored: number;
  label: "treatment" | "package";
}) {
  const overridden = form.amount.trim() !== "";
  const effective = overridden ? Number(form.amount) : mirrored;
  return (
    <div className="rounded-md border bg-muted/30 p-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-medium">Price</div>
          <div className="text-xs text-muted-foreground">
            Mirrors the {label}{form.kind === "treatment" ? "s" : ""} price (£{mirrored.toFixed(2)}). Enter a value to override.
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">£</span>
          <Input
            type="number"
            min="0"
            step="0.01"
            value={form.amount}
            placeholder={mirrored.toFixed(2)}
            onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
            className="w-28"
          />
        </div>
      </div>
      {overridden && (
        <div className="mt-2 text-xs text-muted-foreground">
          Buyers will pay <span className="font-medium text-foreground">£{Number(effective || 0).toFixed(2)}</span>{effective !== mirrored && ` instead of £${mirrored.toFixed(2)}`}.
        </div>
      )}
    </div>
  );
}

function SalePrice({
  form,
  setForm,
  faceValue,
}: {
  form: FormShape;
  setForm: React.Dispatch<React.SetStateAction<FormShape>>;
  faceValue: number;
}) {
  const price = form.price.trim() === "" ? null : Number(form.price);
  const saving = price != null && faceValue > 0 ? faceValue - price : 0;
  return (
    <div className="rounded-md border bg-muted/30 p-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-medium">Sale price (optional)</div>
          <div className="text-xs text-muted-foreground">
            Charge less than the card is worth — e.g. pay £80, get £{faceValue > 0 ? faceValue.toFixed(0) : "100"} of credit. Leave blank to sell at full value.
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">£</span>
          <Input
            type="number"
            min="0"
            step="0.01"
            className="w-28"
            placeholder={faceValue > 0 ? faceValue.toFixed(2) : ""}
            value={form.price}
            onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
          />
        </div>
      </div>
      {saving > 0 && (
        <div className="mt-2 text-xs text-emerald-700">
          Buyers save £{saving.toFixed(2)} ({Math.round((saving / faceValue) * 100)}% off).
        </div>
      )}
      {saving < 0 && <div className="mt-2 text-xs text-amber-700">Sale price is higher than the card value.</div>}
    </div>
  );
}
