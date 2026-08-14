import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, Plus, X, Receipt, Download, Send, Link2, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { getClient } from "@/lib/clients.functions";
import { createPaymentLink } from "@/lib/payment-links.functions";
import { supabase } from "@/integrations/supabase/client";
import {
  listPatientInvoices,
  savePatientInvoice,
  setPatientInvoiceStatus,
  deletePatientInvoice,
  getInvoiceClinicProfile,
  type PatientInvoice,
  type PatientInvoiceItem,
} from "@/lib/patient-invoices.functions";

export const Route = createFileRoute("/_authenticated/dashboard/patients/$id/invoices")({
  ssr: false,
  component: PatientInvoicesPage,
});

const money = (n: number) => `£${n.toFixed(2)}`;

function PatientInvoicesPage() {
  const { id } = Route.useParams();
  const loadClient = useServerFn(getClient);
  const list = useServerFn(listPatientInvoices);
  const save = useServerFn(savePatientInvoice);
  const setStatus = useServerFn(setPatientInvoiceStatus);
  const remove = useServerFn(deletePatientInvoice);
  const loadProfile = useServerFn(getInvoiceClinicProfile);
  const createLink = useServerFn(createPaymentLink);

  const [client, setClient] = useState<any>(null);
  const [invoices, setInvoices] = useState<PatientInvoice[] | null>(null);
  const [items, setItems] = useState<PatientInvoiceItem[]>([{ description: "", qty: 1, unitPrice: 0 }]);
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [includeFees, setIncludeFees] = useState(true);
  const [busy, setBusy] = useState<null | "save" | "link" | "pdf" | "send">(null);

  const total = useMemo(
    () => items.reduce((s, it) => s + (Number(it.qty) || 0) * (Number(it.unitPrice) || 0), 0),
    [items],
  );

  const refresh = () => list({ data: { clientId: id } }).then(setInvoices).catch(() => setInvoices([]));

  useEffect(() => {
    loadClient({ data: { id } }).then((c: any) => { setClient(c); setEmail(c?.email ?? ""); }).catch(() => {});
    refresh();
  }, [id]);

  function profileToInvoiceArgs(profile: any, opts: { reference?: string; paymentLink?: string | null; feeCents?: number }) {
    const addr = (profile?.address ?? {}) as Record<string, string>;
    const addrLines = [addr.line1, addr.line2, [addr.city, addr.postcode].filter(Boolean).join(" "), addr.country].filter(Boolean) as string[];
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
      patientName: client?.full_name ?? "",
      patientEmail: email,
      date: new Date().toLocaleDateString("en-GB"),
      items: items.map((it) => ({ description: it.description || "Treatment", qty: Number(it.qty) || 1, unitPrice: Number(it.unitPrice) || 0 })),
      amount: total,
      notes,
      footerNotes: profile?.invoice_footer_notes ?? null,
      paymentLink: opts.paymentLink ?? undefined,
      feeCents: opts.feeCents ?? 0,
      feeLabel: "Card & processing fee",
      reference: opts.reference,
      showBank: !!profile?.invoice_show_bank_details,
      bank: {
        bankName: profile?.invoice_bank_name,
        accountName: profile?.invoice_account_name,
        sortCode: profile?.invoice_sort_code,
        accountNumber: profile?.invoice_account_number,
        iban: profile?.invoice_iban,
        swift: profile?.invoice_swift,
        paymentReference: profile?.invoice_payment_reference,
      },
    };
  }

  function resetForm() {
    setItems([{ description: "", qty: 1, unitPrice: 0 }]);
    setNotes("");
    setDueDate("");
  }

  async function persist(extra: Partial<Parameters<typeof save>[0]["data"]> = {}) {
    return (await save({
      data: {
        clientId: id,
        recipientName: client?.full_name ?? null,
        recipientEmail: email || null,
        items,
        includeFees,
        notes: notes || null,
        dueDate: dueDate || null,
        ...extra,
      },
    })) as PatientInvoice;
  }

  async function onSaveDraft() {
    if (total <= 0) { toast.error("Add at least one line item"); return; }
    setBusy("save");
    try {
      await persist();
      toast.success("Invoice saved");
      resetForm();
      await refresh();
    } catch (e: any) {
      toast.error(e?.message ?? "Could not save invoice");
    } finally { setBusy(null); }
  }

  async function onDownloadPdf() {
    if (total <= 0) { toast.error("Add at least one line item"); return; }
    setBusy("pdf");
    try {
      const profile = await loadProfile();
      const { generateInvoicePdf } = await import("@/lib/invoice-pdf");
      const doc = await generateInvoicePdf(profileToInvoiceArgs(profile, {}) as any);
      doc.save(`invoice-${(client?.full_name || "patient").replace(/\s+/g, "-").toLowerCase()}.pdf`);
    } catch (e: any) {
      toast.error(e?.message ?? "Could not generate PDF");
    } finally { setBusy(null); }
  }

  async function onSend() {
    if (!email) { toast.error("Add a recipient email"); return; }
    if (total <= 0) { toast.error("Add at least one line item"); return; }
    setBusy("send");
    try {
      const profile: any = await loadProfile();

      // Stripe payment link (so the PDF has a working "pay now" button)
      let paymentLink: string | null = null;
      let paymentLinkId: string | null = null;
      let feeCents = 0;
      try {
        const row: any = await createLink({
          data: {
            amountCents: Math.round(total * 100),
            description: items.map((i) => i.description).filter(Boolean).join(", ") || "Invoice",
            kind: "checkout",
            recipientEmail: email,
            recipientName: client?.full_name ?? null,
            includeFees,
          },
        });
        paymentLink = row.stripe_url;
        paymentLinkId = row.id;
        feeCents = Number(row.surcharge_cents ?? 0);
      } catch (e: any) {
        toast.message("Sending without a payment link", { description: e?.message ?? "Stripe not connected" });
      }

      const saved = await persist({
        status: "sent",
        paymentLink,
        paymentLinkId,
        feeCents,
      });

      const { generateInvoicePdf } = await import("@/lib/invoice-pdf");
      const doc = await generateInvoicePdf(
        profileToInvoiceArgs(profile, { reference: saved.invoice_number, paymentLink, feeCents }) as any,
      );
      const pdfBlob = doc.output("blob");
      const pdfPath = `${profile.id}/invoices/${saved.id}.pdf`;
      const up = await supabase.storage.from("clinic-assets").upload(pdfPath, pdfBlob, { upsert: true, contentType: "application/pdf" });
      if (up.error) throw up.error;
      const TEN_YEARS = 60 * 60 * 24 * 365 * 10;
      const signed = await supabase.storage.from("clinic-assets").createSignedUrl(pdfPath, TEN_YEARS);
      const pdfUrl = signed.data?.signedUrl ?? null;

      const clinicName = profile?.clinic_name || profile?.full_name || "your clinic";
      const itemsText = items
        .map((i) => `• ${i.description || "Treatment"} × ${i.qty} — ${money((Number(i.qty) || 0) * (Number(i.unitPrice) || 0))}`)
        .join("\n");
      const body =
        `Hi ${client?.full_name ?? "there"},\n\n` +
        `Please find your invoice from ${clinicName} below.\n\n` +
        `${itemsText}\n\n` +
        `Total: ${money(total)}\n\n` +
        `Reference: ${saved.invoice_number}\n\n` +
        (notes ? `${notes}\n\n` : "") +
        `Thank you,\n${profile?.full_name ?? clinicName}`;

      const actions: { label: string; url: string; variant?: "primary" | "secondary" }[] = [];
      if (paymentLink) actions.push({ label: "Pay now", url: paymentLink, variant: "primary" });
      if (pdfUrl) actions.push({ label: "View invoice PDF", url: pdfUrl, variant: "secondary" });

      const { sendAppEmail } = await import("@/lib/email/send");
      const res = await sendAppEmail({
        templateName: "patient-message",
        recipientEmail: email,
        idempotencyKey: `patient-invoice-${saved.id}`,
        templateData: {
          subject: `Your invoice from ${clinicName}`,
          body,
          clinicName,
          logoUrl: profile?.invoice_show_logo === false ? null : (profile?.avatar_url ?? null),
          brandColor: profile?.brand_color ?? null,
          actions,
        },
      });
      if (!res.ok) throw new Error(res.error || "Send failed");

      await save({ data: { id: saved.id, clientId: id, items, pdfUrl, recipientEmail: email } });
      toast.success("Invoice sent to patient");
      resetForm();
      await refresh();
    } catch (e: any) {
      toast.error(e?.message ?? "Could not send invoice");
    } finally { setBusy(null); }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base"><Receipt className="h-4 w-4" />New invoice</CardTitle>
          <CardDescription>Create a branded invoice for {client?.full_name ?? "this patient"} and send it with a pay-now link.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2 rounded-lg border bg-muted/30 p-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-semibold">Line items</Label>
              <Button size="sm" variant="outline" onClick={() => setItems([...items, { description: "", qty: 1, unitPrice: 0 }])}>
                <Plus className="mr-1 h-3.5 w-3.5" />Add item
              </Button>
            </div>
            {items.map((it, idx) => (
              <div key={idx} className="grid grid-cols-12 gap-2 rounded-md border bg-background p-2">
                <Input
                  className="col-span-12 sm:col-span-6"
                  placeholder="Description (e.g. Botox – 3 areas)"
                  value={it.description}
                  onChange={(e) => { const n = [...items]; n[idx] = { ...n[idx], description: e.target.value }; setItems(n); }}
                />
                <Input
                  className="col-span-3 sm:col-span-2"
                  type="number" min="1" step="1" placeholder="Qty"
                  value={it.qty}
                  onChange={(e) => { const n = [...items]; n[idx] = { ...n[idx], qty: Number(e.target.value) || 0 }; setItems(n); }}
                />
                <Input
                  className="col-span-7 sm:col-span-3"
                  type="number" min="0" step="0.01" placeholder="Unit £"
                  value={it.unitPrice}
                  onChange={(e) => { const n = [...items]; n[idx] = { ...n[idx], unitPrice: Number(e.target.value) || 0 }; setItems(n); }}
                />
                <Button className="col-span-2 sm:col-span-1" size="icon" variant="ghost" aria-label="Remove"
                  onClick={() => setItems(items.length === 1 ? [{ description: "", qty: 1, unitPrice: 0 }] : items.filter((_, i) => i !== idx))}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <div className="flex items-center justify-between border-t pt-2 text-sm">
              <span className="text-muted-foreground">Total</span>
              <span className="font-semibold">{money(total)}</span>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Send to email</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="patient@email.com" />
            </div>
            <div className="space-y-1.5">
              <Label>Due date (optional)</Label>
              <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Notes (optional)</Label>
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Payment terms, thank you note…" />
          </div>

          <label className="flex items-start gap-2 rounded-md border p-3">
            <Checkbox checked={includeFees} onCheckedChange={(v) => setIncludeFees(v === true)} className="mt-0.5" />
            <span className="text-xs">
              <span className="block font-medium">Add card &amp; processing fees to the payment link</span>
              <span className="text-muted-foreground">Uses the surcharges set in Payments settings. Shown as its own line on the PDF.</span>
            </span>
          </label>

          <div className="flex flex-wrap gap-2">
            <Button onClick={onSend} disabled={busy !== null}>
              {busy === "send" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
              Send invoice
            </Button>
            <Button variant="outline" onClick={onDownloadPdf} disabled={busy !== null}>
              {busy === "pdf" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
              Download PDF
            </Button>
            <Button variant="ghost" onClick={onSaveDraft} disabled={busy !== null}>
              {busy === "save" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Save as draft
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Invoice history</CardTitle>
        </CardHeader>
        <CardContent>
          {invoices === null ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : invoices.length === 0 ? (
            <p className="text-sm text-muted-foreground">No invoices yet for this patient.</p>
          ) : (
            <div className="space-y-2">
              {invoices.map((inv) => (
                <div key={inv.id} className="flex flex-wrap items-center gap-2 rounded-lg border p-3 text-sm">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs">{inv.invoice_number}</span>
                      <Badge variant={inv.status === "paid" ? "default" : inv.status === "sent" ? "secondary" : "outline"}>{inv.status}</Badge>
                    </div>
                    <div className="mt-0.5 truncate text-xs text-muted-foreground">
                      {new Date(inv.created_at).toLocaleDateString("en-GB")} ·{" "}
                      {(inv.items ?? []).map((i) => i.description).filter(Boolean).join(", ") || "—"}
                    </div>
                  </div>
                  <div className="font-semibold">{money((inv.subtotal_cents + (inv.fee_cents ?? 0)) / 100)}</div>
                  <div className="flex items-center gap-1">
                    {inv.payment_link && (
                      <Button size="icon" variant="ghost" aria-label="Copy payment link"
                        onClick={() => { navigator.clipboard.writeText(inv.payment_link!); toast.success("Payment link copied"); }}>
                        <Link2 className="h-4 w-4" />
                      </Button>
                    )}
                    {inv.pdf_url && (
                      <Button size="icon" variant="ghost" aria-label="Open PDF" asChild>
                        <a href={inv.pdf_url} target="_blank" rel="noreferrer"><Download className="h-4 w-4" /></a>
                      </Button>
                    )}
                    <Button size="sm" variant="outline"
                      onClick={async () => {
                        await setStatus({ data: { id: inv.id, status: inv.status === "paid" ? "sent" : "paid" } });
                        refresh();
                      }}>
                      {inv.status === "paid" ? "Unmark paid" : "Mark paid"}
                    </Button>
                    <Button size="icon" variant="ghost" aria-label="Delete invoice"
                      onClick={async () => {
                        if (!confirm("Delete this invoice?")) return;
                        await remove({ data: { id: inv.id } });
                        refresh();
                      }}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
