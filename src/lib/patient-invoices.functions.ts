import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type PatientInvoiceItem = {
  description: string;
  qty: number;
  unitPrice: number; // major units (£)
};

export type PatientInvoice = {
  id: string;
  profile_id: string;
  client_id: string | null;
  invoice_number: string;
  recipient_name: string | null;
  recipient_email: string | null;
  items: PatientInvoiceItem[];
  subtotal_cents: number;
  fee_cents: number;
  include_fees: boolean;
  currency: string;
  status: "draft" | "sent" | "paid" | "cancelled";
  notes: string | null;
  due_date: string | null;
  payment_link_id: string | null;
  payment_link: string | null;
  pdf_url: string | null;
  sent_at: string | null;
  paid_at: string | null;
  created_at: string;
};

async function myProfileId(supabase: any, userId: string) {
  const { data, error } = await supabase
    .from("profiles")
    .select("id")
    .eq("user_id", userId)
    .single();
  if (error || !data) throw error || new Error("Profile not found");
  return data.id as string;
}

async function nextInvoiceNumber(supabase: any, profileId: string) {
  const year = new Date().getUTCFullYear();
  const prefix = `INV-${year}-`;
  const { data } = await supabase
    .from("patient_invoices")
    .select("invoice_number")
    .eq("profile_id", profileId)
    .ilike("invoice_number", `${prefix}%`)
    .order("created_at", { ascending: false })
    .limit(1);
  const last = (data?.[0]?.invoice_number as string | undefined) ?? "";
  const lastNum = Number(last.split("-").pop() || "0");
  return `${prefix}${String(lastNum + 1).padStart(4, "0")}`;
}

function normaliseItems(items: PatientInvoiceItem[]) {
  return (items ?? [])
    .map((it) => ({
      description: String(it.description ?? "").trim(),
      qty: Math.max(1, Math.round(Number(it.qty) || 1)),
      unitPrice: Math.max(0, Number(it.unitPrice) || 0),
    }))
    .filter((it) => it.description.length > 0 || it.unitPrice > 0);
}

export const listPatientInvoices = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { clientId: string }) => input)
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("patient_invoices")
      .select("*")
      .eq("client_id", data.clientId)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw error;
    return (rows ?? []) as unknown as PatientInvoice[];
  });

export const savePatientInvoice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      id?: string | null;
      clientId: string;
      recipientName?: string | null;
      recipientEmail?: string | null;
      items: PatientInvoiceItem[];
      includeFees?: boolean;
      notes?: string | null;
      dueDate?: string | null;
      status?: "draft" | "sent" | "paid" | "cancelled";
      paymentLink?: string | null;
      paymentLinkId?: string | null;
      feeCents?: number | null;
      pdfUrl?: string | null;
    }) => input,
  )
  .handler(async ({ data, context }) => {
    const profileId = await myProfileId(context.supabase, context.userId);
    const items = normaliseItems(data.items);
    if (items.length === 0) throw new Error("Add at least one line item");
    const subtotal = Math.round(items.reduce((s, it) => s + it.qty * it.unitPrice, 0) * 100);

    const patch: Record<string, unknown> = {
      profile_id: profileId,
      client_id: data.clientId,
      recipient_name: data.recipientName?.trim() || null,
      recipient_email: data.recipientEmail?.trim().toLowerCase() || null,
      items,
      subtotal_cents: subtotal,
      include_fees: data.includeFees ?? true,
      notes: data.notes?.trim() || null,
      due_date: data.dueDate || null,
    };
    if (data.status) patch.status = data.status;
    if (data.status === "sent") patch.sent_at = new Date().toISOString();
    if (data.status === "paid") patch.paid_at = new Date().toISOString();
    if (data.paymentLink !== undefined) patch.payment_link = data.paymentLink;
    if (data.paymentLinkId !== undefined) patch.payment_link_id = data.paymentLinkId;
    if (data.feeCents !== undefined && data.feeCents !== null) patch.fee_cents = Math.max(0, Math.round(data.feeCents));
    if (data.pdfUrl !== undefined) patch.pdf_url = data.pdfUrl;

    if (data.id) {
      const { data: row, error } = await context.supabase
        .from("patient_invoices")
        .update(patch)
        .eq("id", data.id)
        .eq("profile_id", profileId)
        .select()
        .single();
      if (error) throw error;
      return row as unknown as PatientInvoice;
    }

    patch.invoice_number = await nextInvoiceNumber(context.supabase, profileId);
    const { data: row, error } = await context.supabase
      .from("patient_invoices")
      .insert(patch as never)
      .select()
      .single();
    if (error) throw error;
    return row as unknown as PatientInvoice;
  });

export const setPatientInvoiceStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; status: "draft" | "sent" | "paid" | "cancelled" }) => input)
  .handler(async ({ data, context }) => {
    const profileId = await myProfileId(context.supabase, context.userId);
    const patch: Record<string, unknown> = { status: data.status };
    if (data.status === "paid") patch.paid_at = new Date().toISOString();
    if (data.status === "sent") patch.sent_at = new Date().toISOString();
    if (data.status === "draft") { patch.paid_at = null; patch.sent_at = null; }
    const { error } = await context.supabase
      .from("patient_invoices")
      .update(patch)
      .eq("id", data.id)
      .eq("profile_id", profileId);
    if (error) throw error;
    return { ok: true };
  });

export const deletePatientInvoice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data, context }) => {
    const profileId = await myProfileId(context.supabase, context.userId);
    const { error } = await context.supabase
      .from("patient_invoices")
      .delete()
      .eq("id", data.id)
      .eq("profile_id", profileId);
    if (error) throw error;
    return { ok: true };
  });

export const getInvoiceClinicProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("profiles")
      .select(
        "id, clinic_name, full_name, address, email, phone, brand_color, avatar_url, invoice_bank_name, invoice_account_name, invoice_sort_code, invoice_account_number, invoice_iban, invoice_swift, invoice_payment_reference, invoice_footer_notes, invoice_vat_number, invoice_company_number, invoice_show_bank_details, invoice_show_logo",
      )
      .eq("user_id", context.userId)
      .single();
    if (error) throw error;
    return data;
  });
