import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Plus, Trash2, Send, Loader2, Check, Users, FileText, Download,
} from "lucide-react";
import {
  listBillingPractitioners,
  upsertBillingPractitioner,
  deleteBillingPractitioner,
  listPrescriberInvoices,
  createPrescriberInvoice,
  deletePrescriberInvoice,
  ensurePrescriberInvoiceStripeLink,
  markPrescriberInvoiceSent,
  markPrescriberInvoicePaid,
  type PractitionerClient,
  type InvoiceItem,
  type PrescriberInvoice,
} from "@/lib/prescriber-invoices.functions";
import { generateInvoicePdf } from "@/lib/invoice-pdf";
import { getMyProfile } from "@/lib/profiles.functions";
import { supabase } from "@/integrations/supabase/client";
import { sendAppEmail } from "@/lib/email/send";

export const Route = createFileRoute("/_authenticated/prescriber/invoices")({
  ssr: false,
  component: PrescriberInvoicesPage,
});

function currencyLabel(c: string) {
  return c?.toUpperCase() === "GBP" ? "£" : (c || "£");
}
function fmtCents(cents: number, currency = "gbp") {
  return `${currencyLabel(currency)}${(Number(cents ?? 0) / 100).toFixed(2)}`;
}

function profileToInvoiceArgs(profile: any, inv: PrescriberInvoice, paymentLink?: string | null) {
  const addr = (profile?.address ?? {}) as Record<string, string>;
  const addrLines = [addr.line1, addr.line2, [addr.city, addr.postcode].filter(Boolean).join(" "), addr.country].filter(Boolean) as string[];
  const items = (inv.items || []).map((it) => ({
    description: it.description,
    qty: it.qty,
    unitPrice: it.unitPriceCents / 100,
  }));
  return {
    clinic: profile?.clinic_name || profile?.full_name || "Invoice",
    practitioner: profile?.full_name ?? undefined,
    clinicAddress: addrLines,
    clinicEmail: profile?.email ?? null,
    clinicPhone: profile?.phone ?? null,
    vatNumber: profile?.invoice_vat_number ?? null,
    companyNumber: profile?.invoice_company_number ?? null,
    logoUrl: profile?.invoice_show_logo === false ? null : (profile?.avatar_url ?? null),
    brandColor: profile?.brand_color ?? null,
    patientName: inv.practitioner?.full_name,
    patientEmail: inv.practitioner?.email,
    date: new Date(inv.created_at).toLocaleDateString("en-GB"),
    items,
    amount: inv.subtotal_cents / 100,
    notes: inv.notes ?? undefined,
    footerNotes: profile?.invoice_footer_notes ?? null,
    paymentLink: paymentLink ?? inv.stripe_url ?? undefined,
    reference: inv.invoice_number,
    showBank: !!profile?.invoice_show_bank_details,
    bank: {
      bankName: profile?.invoice_bank_name,
      accountName: profile?.invoice_account_name,
      sortCode: profile?.invoice_sort_code,
      accountNumber: profile?.invoice_account_number,
      iban: profile?.invoice_iban,
      swift: profile?.invoice_swift,
      paymentReference: profile?.invoice_payment_reference || inv.invoice_number,
    },
  };
}


function PrescriberInvoicesPage() {
  const qc = useQueryClient();
  const listPractitioners = useServerFn(listBillingPractitioners);
  const listInvoices = useServerFn(listPrescriberInvoices);

  const practitionersQ = useQuery({
    queryKey: ["prescriber-billing-practitioners"],
    queryFn: () => listPractitioners(),
  });
  const invoicesQ = useQuery({
    queryKey: ["prescriber-invoices"],
    queryFn: () => listInvoices(),
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["prescriber-billing-practitioners"] });
    qc.invalidateQueries({ queryKey: ["prescriber-invoices"] });
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-serif text-2xl">Invoices</h1>
        <p className="text-sm text-muted-foreground">
          Bill the practitioners you prescribe for. Payment link goes straight to your Stripe.
        </p>
      </div>

      <PractitionersCard
        rows={practitionersQ.data ?? []}
        loading={practitionersQ.isLoading}
        onChanged={invalidate}
      />

      <InvoicesCard
        rows={invoicesQ.data ?? []}
        loading={invoicesQ.isLoading}
        practitioners={practitionersQ.data ?? []}
        onChanged={invalidate}
      />
    </div>
  );
}

// ---------------- Practitioners directory ----------------

function PractitionersCard({
  rows, loading, onChanged,
}: { rows: PractitionerClient[]; loading: boolean; onChanged: () => void }) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<PractitionerClient | null>(null);

  function openNew() { setEditing(null); setOpen(true); }
  function openEdit(r: PractitionerClient) { setEditing(r); setOpen(true); }

  const del = useServerFn(deleteBillingPractitioner);

  async function remove(r: PractitionerClient) {
    if (!confirm(`Remove ${r.full_name}?`)) return;
    try { await del({ data: { id: r.id } }); toast.success("Removed"); onChanged(); }
    catch (e) { toast.error((e as Error).message); }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div>
          <CardTitle className="flex items-center gap-2 text-base"><Users className="h-4 w-4" /> Practitioners</CardTitle>
          <CardDescription>Your private billing directory. Set a default rate to auto-fill invoice lines.</CardDescription>
        </div>
        <Button size="sm" onClick={openNew}><Plus className="mr-1 h-4 w-4" /> Add</Button>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No practitioners yet.</p>
        ) : (
          <ul className="divide-y">
            {rows.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <div className="font-medium">{r.full_name}</div>
                  <div className="text-xs text-muted-foreground">
                    {r.clinic_name ? `${r.clinic_name} • ` : ""}{r.email}
                    {r.default_rate_cents > 0 ? ` • Default ${fmtCents(r.default_rate_cents)} / script` : ""}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => openEdit(r)}>Edit</Button>
                  <Button size="sm" variant="ghost" onClick={() => remove(r)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>

      <PractitionerDialog
        open={open}
        onOpenChange={setOpen}
        editing={editing}
        onSaved={() => { setOpen(false); onChanged(); }}
      />
    </Card>
  );
}

function PractitionerDialog({
  open, onOpenChange, editing, onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing: PractitionerClient | null;
  onSaved: () => void;
}) {
  const save = useServerFn(upsertBillingPractitioner);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    full_name: "", clinic_name: "", email: "", phone: "",
    address: "", default_rate_pounds: "",
  });

  // Reset when the editing target changes
  useMemo(() => {
    setForm({
      full_name: editing?.full_name ?? "",
      clinic_name: editing?.clinic_name ?? "",
      email: editing?.email ?? "",
      phone: editing?.phone ?? "",
      address: (editing?.address_lines ?? []).join("\n"),
      default_rate_pounds: editing?.default_rate_cents
        ? (editing.default_rate_cents / 100).toFixed(2)
        : "",
    });
  }, [editing]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await save({
        data: {
          id: editing?.id,
          full_name: form.full_name,
          clinic_name: form.clinic_name || null,
          email: form.email,
          phone: form.phone || null,
          address_lines: form.address.split("\n").map((l) => l.trim()).filter(Boolean),
          default_rate_cents: Math.round(Number(form.default_rate_pounds || 0) * 100),
        },
      });
      toast.success(editing ? "Updated" : "Added");
      onSaved();
    } catch (e) { toast.error((e as Error).message); }
    finally { setBusy(false); }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md w-[calc(100vw-2rem)]">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit practitioner" : "Add practitioner"}</DialogTitle>
          <DialogDescription>Stored privately — only you can see this directory.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div>
            <Label>Full name</Label>
            <Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} required />
          </div>
          <div>
            <Label>Clinic name</Label>
            <Input value={form.clinic_name} onChange={(e) => setForm({ ...form, clinic_name: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Email</Label>
              <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
            </div>
            <div>
              <Label>Phone</Label>
              <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
          </div>
          <div>
            <Label>Address (one line each)</Label>
            <Textarea rows={3} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          </div>
          <div>
            <Label>Default rate per script (£)</Label>
            <Input type="number" step="0.01" min="0" value={form.default_rate_pounds}
              onChange={(e) => setForm({ ...form, default_rate_pounds: e.target.value })} />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={busy}>
              {busy ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : null}
              {editing ? "Save" : "Add"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ---------------- Invoices ----------------

function InvoicesCard({
  rows, loading, practitioners, onChanged,
}: {
  rows: PrescriberInvoice[];
  loading: boolean;
  practitioners: PractitionerClient[];
  onChanged: () => void;
}) {
  const [open, setOpen] = useState(false);
  const del = useServerFn(deletePrescriberInvoice);
  const ensureLink = useServerFn(ensurePrescriberInvoiceStripeLink);
  const markSent = useServerFn(markPrescriberInvoiceSent);
  const markPaid = useServerFn(markPrescriberInvoicePaid);
  const getProfile = useServerFn(getMyProfile);

  const [busyId, setBusyId] = useState<string | null>(null);

  async function remove(r: PrescriberInvoice) {
    if (!confirm(`Delete ${r.invoice_number}?`)) return;
    try { await del({ data: { id: r.id } }); toast.success("Deleted"); onChanged(); }
    catch (e) { toast.error((e as Error).message); }
  }

  async function sendNow(r: PrescriberInvoice) {
    if (!r.practitioner?.email) { toast.error("Practitioner has no email"); return; }
    setBusyId(r.id);
    try {
      // 1) Load prescriber profile (for bank details, logo, brand)
      const profile: any = await getProfile();

      // 2) Ensure Stripe payment link exists on the invoice
      const { stripeUrl } = await ensureLink({ data: { id: r.id } });

      // 3) Build branded PDF exactly like the patient invoice
      const doc = await generateInvoicePdf(profileToInvoiceArgs(profile, r, stripeUrl));
      const pdfBlob = doc.output("blob");

      // 4) Upload PDF to storage and get a long-lived signed URL
      const path = `${profile?.id}/prescriber-invoices/${r.id}-${Date.now()}.pdf`;
      const up = await supabase.storage
        .from("clinic-assets")
        .upload(path, pdfBlob, { upsert: true, contentType: "application/pdf" });
      if (up.error) throw up.error;
      const TEN_YEARS = 60 * 60 * 24 * 365 * 10;
      const signed = await supabase.storage.from("clinic-assets").createSignedUrl(path, TEN_YEARS);
      const pdfUrl = signed.data?.signedUrl ?? null;

      // 5) Send branded email with pay link + PDF link
      const prescriberName = profile?.clinic_name || profile?.full_name || "Prescriber";
      const res = await sendAppEmail({
        templateName: "prescriber-invoice",
        recipientEmail: r.practitioner.email,
        idempotencyKey: `prescriber-invoice-${r.id}-${r.subtotal_cents}`,
        templateData: {
          siteName: prescriberName,
          logoUrl: profile?.invoice_show_logo === false ? null : (profile?.avatar_url ?? null),
          brandColor: profile?.brand_color ?? null,
          prescriberName,
          practitionerName: r.practitioner.full_name,
          clinicName: r.practitioner.clinic_name,
          invoiceNumber: r.invoice_number,
          currency: (r.currency ?? "gbp").toUpperCase(),
          subtotalCents: r.subtotal_cents,
          items: r.items,
          notes: r.notes,
          dueDate: r.due_date,
          payUrl: stripeUrl,
          pdfUrl,
          bank: profile?.invoice_show_bank_details ? {
            bankName: profile?.invoice_bank_name,
            accountName: profile?.invoice_account_name,
            sortCode: profile?.invoice_sort_code,
            accountNumber: profile?.invoice_account_number,
            iban: profile?.invoice_iban,
            swift: profile?.invoice_swift,
            paymentReference: profile?.invoice_payment_reference || r.invoice_number,
          } : null,
        },
      });
      if (!res.ok) throw new Error(res.error || "Send failed");

      // 6) Mark as sent
      await markSent({ data: { id: r.id } });
      toast.success("Invoice sent");
      onChanged();
    } catch (e) { toast.error((e as Error).message); }
    finally { setBusyId(null); }
  }

  async function togglePaid(r: PrescriberInvoice) {
    try {
      await markPaid({ data: { id: r.id, paid: r.status !== "paid" } });
      onChanged();
    } catch (e) { toast.error((e as Error).message); }
  }


  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div>
          <CardTitle className="flex items-center gap-2 text-base"><FileText className="h-4 w-4" /> Invoices</CardTitle>
          <CardDescription>Create manual invoices with any line items — scripts, extras, ad-hoc charges.</CardDescription>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="mr-1 h-4 w-4" /> New invoice
            </Button>
          </DialogTrigger>
          <NewInvoiceDialog
            practitioners={practitioners}
            onCreated={() => { setOpen(false); onChanged(); }}
          />
        </Dialog>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No invoices yet.</p>
        ) : (
          <ul className="divide-y">
            {rows.map((r) => (
              <li key={r.id} className="py-3 grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium truncate">{r.invoice_number}</span>
                    <StatusBadge status={r.status} />
                    <span className="ml-auto font-medium tabular-nums sm:hidden">{fmtCents(r.subtotal_cents, r.currency)}</span>
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    {r.practitioner?.full_name}
                    {r.practitioner?.clinic_name ? ` • ${r.practitioner.clinic_name}` : ""}
                    {" • "}{new Date(r.created_at).toLocaleDateString()}
                    {r.sent_at ? ` • sent ${new Date(r.sent_at).toLocaleDateString()}` : ""}
                  </div>
                </div>
                <div className="flex items-center gap-2 sm:gap-3">
                  <div className="hidden sm:block text-right font-medium tabular-nums">{fmtCents(r.subtotal_cents, r.currency)}</div>
                  <div className="flex flex-wrap gap-1">
                    <DownloadPdfButton inv={r} />
                    {r.status !== "paid" && (
                      <Button size="sm" onClick={() => sendNow(r)} disabled={busyId === r.id}>
                        {busyId === r.id
                          ? <Loader2 className="h-3 w-3 animate-spin" />
                          : <><Send className="mr-1 h-3 w-3" /> {r.status === "sent" ? "Resend" : "Send"}</>}
                      </Button>
                    )}
                    <Button size="sm" variant="outline" onClick={() => togglePaid(r)}>
                      <Check className="mr-1 h-3 w-3" /> {r.status === "paid" ? "Unpaid" : "Paid"}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => remove(r)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </li>
            ))}

          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    draft: "bg-muted text-muted-foreground",
    sent: "bg-blue-100 text-blue-900",
    paid: "bg-emerald-100 text-emerald-900",
    cancelled: "bg-red-100 text-red-900",
  };
  return <Badge className={map[status] ?? map.draft} variant="secondary">{status}</Badge>;
}

function NewInvoiceDialog({
  practitioners, onCreated,
}: { practitioners: PractitionerClient[]; onCreated: () => void }) {
  const create = useServerFn(createPrescriberInvoice);
  const savePractitioner = useServerFn(upsertBillingPractitioner);
  const [busy, setBusy] = useState(false);
  const NEW_KEY = "__new__";
  const [practitionerId, setPractitionerId] = useState<string>(practitioners.length === 0 ? NEW_KEY : "");
  const [quick, setQuick] = useState({ full_name: "", clinic_name: "", email: "" });
  const [items, setItems] = useState<InvoiceItem[]>([{ description: "", qty: 1, unitPriceCents: 0 }]);
  const [notes, setNotes] = useState("");
  const [dueDate, setDueDate] = useState("");

  const isNew = practitionerId === NEW_KEY;
  const selected = practitioners.find((p) => p.id === practitionerId);

  function updateItem(idx: number, patch: Partial<InvoiceItem>) {
    setItems((cur) => cur.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  }
  function addLine() {
    const rate = selected?.default_rate_cents ?? 0;
    setItems((cur) => [...cur, { description: "Prescription", qty: 1, unitPriceCents: rate }]);
  }
  function removeLine(idx: number) {
    setItems((cur) => cur.filter((_, i) => i !== idx));
  }

  const subtotal = items.reduce((s, it) => s + Math.max(1, it.qty) * Math.max(0, it.unitPriceCents), 0);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      let pid = practitionerId;
      if (isNew) {
        if (!quick.full_name.trim() || !quick.email.trim()) {
          toast.error("Add practitioner name and email"); setBusy(false); return;
        }
        const created = await savePractitioner({
          data: {
            full_name: quick.full_name,
            clinic_name: quick.clinic_name || null,
            email: quick.email,
          },
        });
        pid = created.id;
      }
      if (!pid) { toast.error("Pick a practitioner"); setBusy(false); return; }
      await create({
        data: {
          practitionerId: pid,
          items: items.filter((it) => it.description.trim().length > 0),
          notes: notes.trim() || null,
          dueDate: dueDate || null,
        },
      });
      toast.success("Invoice created");
      onCreated();
      setItems([{ description: "", qty: 1, unitPriceCents: 0 }]);
      setNotes(""); setDueDate(""); setQuick({ full_name: "", clinic_name: "", email: "" });
    } catch (e) { toast.error((e as Error).message); }
    finally { setBusy(false); }
  }

  return (
    <DialogContent className="max-w-2xl w-[calc(100vw-2rem)] max-h-[92vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>New invoice</DialogTitle>
        <DialogDescription>Add line items — quantity times unit price.</DialogDescription>
      </DialogHeader>
      <form onSubmit={submit} className="space-y-4">
        <div>
          <Label>Practitioner</Label>
          <Select
            value={practitionerId}
            onValueChange={(v) => {
              setPractitionerId(v);
              const p = practitioners.find((x) => x.id === v);
              if (p && items.length === 1 && items[0].unitPriceCents === 0 && !items[0].description) {
                setItems([{ description: "Prescription", qty: 1, unitPriceCents: p.default_rate_cents }]);
              }
            }}
          >
            <SelectTrigger><SelectValue placeholder="Choose…" /></SelectTrigger>
            <SelectContent>
              {practitioners.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.full_name}{p.clinic_name ? ` — ${p.clinic_name}` : ""}
                </SelectItem>
              ))}
              <SelectItem value={NEW_KEY}>+ Add new practitioner…</SelectItem>
            </SelectContent>
          </Select>
          {isNew && (
            <div className="mt-3 grid gap-2 rounded-md border bg-muted/40 p-3 sm:grid-cols-3">
              <div className="sm:col-span-1">
                <Label className="text-xs">Full name</Label>
                <Input value={quick.full_name} onChange={(e) => setQuick({ ...quick, full_name: e.target.value })} placeholder="Jane Smith" />
              </div>
              <div className="sm:col-span-1">
                <Label className="text-xs">Clinic (optional)</Label>
                <Input value={quick.clinic_name} onChange={(e) => setQuick({ ...quick, clinic_name: e.target.value })} placeholder="Clinic name" />
              </div>
              <div className="sm:col-span-1">
                <Label className="text-xs">Email</Label>
                <Input type="email" value={quick.email} onChange={(e) => setQuick({ ...quick, email: e.target.value })} placeholder="name@email.com" />
              </div>
              <p className="text-xs text-muted-foreground sm:col-span-3">Saved to your billing directory so you can reuse them next time.</p>
            </div>
          )}
        </div>


        <div className="space-y-2">
          <Label>Line items</Label>
          {items.map((it, i) => (
            <div key={i} className="rounded-md border bg-muted/30 p-2 space-y-2 sm:space-y-0 sm:grid sm:grid-cols-12 sm:items-end sm:gap-2 sm:bg-transparent sm:border-0 sm:p-0">
              <div className="sm:col-span-6">
                <Label className="text-[11px] text-muted-foreground sm:hidden">Description</Label>
                <Input placeholder="Description" value={it.description}
                  onChange={(e) => updateItem(i, { description: e.target.value })} />
              </div>
              <div className="grid grid-cols-[1fr_1fr_auto] gap-2 sm:contents">
                <div className="sm:col-span-2">
                  <Label className="text-[11px] text-muted-foreground sm:hidden">Qty</Label>
                  <Input type="number" min="1" step="1" placeholder="Qty" value={it.qty}
                    onChange={(e) => updateItem(i, { qty: Math.max(1, Number(e.target.value || 1)) })} />
                </div>
                <div className="sm:col-span-3">
                  <Label className="text-[11px] text-muted-foreground sm:hidden">Unit £</Label>
                  <Input type="number" min="0" step="0.01" placeholder="Unit £"
                    value={it.unitPriceCents ? (it.unitPriceCents / 100).toFixed(2) : ""}
                    onChange={(e) => updateItem(i, { unitPriceCents: Math.round(Number(e.target.value || 0) * 100) })} />
                </div>
                <div className="flex items-end sm:col-span-1">
                  <Button type="button" size="icon" variant="ghost" onClick={() => removeLine(i)} disabled={items.length === 1} aria-label="Remove line">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
          <Button type="button" size="sm" variant="outline" onClick={addLine}>
            <Plus className="mr-1 h-3 w-3" /> Add line
          </Button>
        </div>


        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Due date (optional)</Label>
            <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </div>
          <div className="flex items-end justify-end">
            <div className="text-right">
              <div className="text-xs text-muted-foreground">Total</div>
              <div className="font-serif text-2xl">{fmtCents(subtotal)}</div>
            </div>
          </div>
        </div>

        <div>
          <Label>Notes (optional)</Label>
          <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>

        <DialogFooter>
          <Button type="submit" disabled={busy}>
            {busy ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : null}
            Create invoice
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}

function DownloadPdfButton({ inv }: { inv: PrescriberInvoice }) {
  const getProfile = useServerFn(getMyProfile);
  const [busy, setBusy] = useState(false);
  async function download() {
    setBusy(true);
    try {
      const profile: any = await getProfile().catch(() => null);
      const doc = await generateInvoicePdf(profileToInvoiceArgs(profile, inv, inv.stripe_url));
      doc.save(`${inv.invoice_number}.pdf`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally { setBusy(false); }
  }

  return (
    <Button size="sm" variant="outline" onClick={download} disabled={busy}>
      {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <><Download className="mr-1 h-3 w-3" /> PDF</>}
    </Button>
  );
}
