import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { updateProfile } from "@/lib/profiles.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

const fields = [
  ["clinic_name", "Business name"], ["email", "Email"], ["phone", "Phone"],
  ["invoice_bank_name", "Bank name"], ["invoice_account_name", "Account name"],
  ["invoice_sort_code", "Sort code"], ["invoice_account_number", "Account number"],
  ["invoice_iban", "IBAN"], ["invoice_swift", "SWIFT / BIC"],
  ["invoice_payment_reference", "Default payment reference"],
  ["invoice_vat_number", "VAT number"], ["invoice_company_number", "Company number"],
] as const;

export function InvoiceDetails({ profile, onSaved }: { profile: any; onSaved: () => void }) {
  const save = useServerFn(updateProfile);
  const [form, setForm] = useState<Record<string, string>>(() => Object.fromEntries([
    ...fields.map(([key]) => [key, profile[key] ?? ""]),
    ["invoice_footer_notes", profile.invoice_footer_notes ?? ""],
    ["rental_invoice_payment_method", profile.rental_invoice_payment_method ?? "both"],
  ]));
  const [address, setAddress] = useState<Record<string, string>>(profile.address ?? {});
  const [busy, setBusy] = useState(false);
  return <form className="max-w-3xl space-y-5" onSubmit={async (event) => {
    event.preventDefault();
    setBusy(true);
    try {
      const values = Object.fromEntries(fields.map(([key]) => [key, form[key].trim()]));
      await save({ data: { id: profile.id, ...values, address,
        invoice_footer_notes: form.invoice_footer_notes.trim() || null,
        rental_invoice_payment_method: form.rental_invoice_payment_method as "bank" | "stripe" | "both",
        invoice_show_bank_details: form.rental_invoice_payment_method !== "stripe",
      } });
      toast.success("Invoice details saved");
      onSaved();
    } catch (error) { toast.error(error instanceof Error ? error.message : "Could not save invoice details"); }
    finally { setBusy(false); }
  }}>
    <h2 className="text-lg font-semibold">Invoice details</h2>
    <div className="space-y-2">
      <Label htmlFor="rental-invoice-default">Default payment option</Label>
      <Select value={form.rental_invoice_payment_method} onValueChange={(value) => setForm({ ...form, rental_invoice_payment_method: value })}>
        <SelectTrigger id="rental-invoice-default"><SelectValue /></SelectTrigger>
        <SelectContent><SelectItem value="bank">Bank transfer</SelectItem><SelectItem value="stripe">Stripe payment link</SelectItem><SelectItem value="both">Bank transfer and Stripe</SelectItem></SelectContent>
      </Select>
    </div>
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {fields.map(([key, label]) => <div key={key} className="space-y-2"><Label htmlFor={`rental-${key}`}>{label}</Label><Input id={`rental-${key}`} type={key === "email" ? "email" : "text"} value={form[key]} onChange={(event) => setForm({ ...form, [key]: event.target.value })} /></div>)}
      {([ ["line1", "Address line 1"], ["line2", "Address line 2"], ["city", "City"], ["postcode", "Postcode"], ["country", "Country"] ] as const).map(([key, label]) => <div key={key} className="space-y-2"><Label htmlFor={`rental-address-${key}`}>{label}</Label><Input id={`rental-address-${key}`} value={address[key] ?? ""} onChange={(event) => setAddress({ ...address, [key]: event.target.value })} /></div>)}
    </div>
    <div className="space-y-2"><Label htmlFor="rental-invoice-footer">Invoice footer notes</Label><Textarea id="rental-invoice-footer" rows={4} value={form.invoice_footer_notes} onChange={(event) => setForm({ ...form, invoice_footer_notes: event.target.value })} /></div>
    <Button type="submit" disabled={busy}>{busy ? "Saving…" : "Save invoice details"}</Button>
  </form>;
}