import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function __activeProfileId(supabase: any, userId: string) {
  const { activeProfileId } = await import("./clinic-context.server");
  return await activeProfileId(supabase, userId);
}

export type InvoiceItem = {
  description: string;
  qty: number;
  unitPriceCents: number;
};

export type PractitionerClient = {
  id: string;
  full_name: string;
  clinic_name: string | null;
  email: string;
  phone: string | null;
  address_lines: string[];
  default_rate_cents: number;
  notes: string | null;
  created_at: string;
};

export type PrescriberInvoice = {
  id: string;
  practitioner_id: string;
  invoice_number: string;
  items: InvoiceItem[];
  subtotal_cents: number;
  currency: string;
  status: "draft" | "sent" | "paid" | "cancelled";
  stripe_payment_link_id: string | null;
  stripe_url: string | null;
  notes: string | null;
  due_date: string | null;
  sent_at: string | null;
  paid_at: string | null;
  created_at: string;
  practitioner?: PractitionerClient | null;
};

async function nextInvoiceNumber(supabase: any, userId: string) {
  const year = new Date().getUTCFullYear();
  const prefix = `INV-${year}-`;
  const { data } = await supabase
    .from("prescriber_invoices")
    .select("invoice_number")
    .eq("prescriber_user_id", userId)
    .ilike("invoice_number", `${prefix}%`)
    .order("created_at", { ascending: false })
    .limit(1);
  const last = (data?.[0]?.invoice_number as string | undefined) ?? "";
  const lastNum = Number(last.split("-").pop() || "0");
  const next = String(lastNum + 1).padStart(4, "0");
  return `${prefix}${next}`;
}

// ---------- Practitioner directory ----------

export const listBillingPractitioners = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("prescriber_billing_practitioners")
      .select("*")
      .eq("prescriber_user_id", context.userId)
      .order("full_name", { ascending: true });
    if (error) throw error;
    return (data ?? []) as PractitionerClient[];
  });

export const upsertBillingPractitioner = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      id?: string;
      full_name: string;
      clinic_name?: string | null;
      email: string;
      phone?: string | null;
      address_lines?: string[];
      default_rate_cents?: number;
      notes?: string | null;
    }) => input,
  )
  .handler(async ({ data, context }) => {
    const payload = {
      prescriber_user_id: context.userId,
      full_name: data.full_name.trim(),
      clinic_name: data.clinic_name?.trim() || null,
      email: data.email.trim().toLowerCase(),
      phone: data.phone?.trim() || null,
      address_lines: (data.address_lines ?? []).map((l) => l.trim()).filter(Boolean),
      default_rate_cents: Math.max(0, Math.round(data.default_rate_cents ?? 0)),
      notes: data.notes?.trim() || null,
    };
    if (!payload.full_name) throw new Error("Name required");
    if (!/^\S+@\S+\.\S+$/.test(payload.email)) throw new Error("Valid email required");

    if (data.id) {
      const { data: row, error } = await context.supabase
        .from("prescriber_billing_practitioners")
        .update(payload)
        .eq("id", data.id)
        .eq("prescriber_user_id", context.userId)
        .select()
        .single();
      if (error) throw error;
      return row as PractitionerClient;
    }
    const { data: row, error } = await context.supabase
      .from("prescriber_billing_practitioners")
      .insert(payload)
      .select()
      .single();
    if (error) throw error;
    return row as PractitionerClient;
  });

export const deleteBillingPractitioner = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("prescriber_billing_practitioners")
      .delete()
      .eq("id", data.id)
      .eq("prescriber_user_id", context.userId);
    if (error) throw error;
    return { ok: true };
  });

// ---------- Invoices ----------

export const listPrescriberInvoices = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("prescriber_invoices")
      .select("*, practitioner:prescriber_billing_practitioners!practitioner_id(*)")
      .eq("prescriber_user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw error;
    return (data ?? []) as unknown as PrescriberInvoice[];
  });

export const createPrescriberInvoice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      practitionerId: string;
      items: InvoiceItem[];
      notes?: string | null;
      dueDate?: string | null;
    }) => input,
  )
  .handler(async ({ data, context }) => {
    const items = (data.items ?? [])
      .map((it) => ({
        description: String(it.description ?? "").trim(),
        qty: Math.max(1, Math.round(Number(it.qty ?? 1))),
        unitPriceCents: Math.max(0, Math.round(Number(it.unitPriceCents ?? 0))),
      }))
      .filter((it) => it.description.length > 0);
    if (items.length === 0) throw new Error("Add at least one line item");
    const subtotal = items.reduce((s, it) => s + it.qty * it.unitPriceCents, 0);

    const invoiceNumber = await nextInvoiceNumber(context.supabase, context.userId);
    const { data: row, error } = await context.supabase
      .from("prescriber_invoices")
      .insert({
        prescriber_user_id: context.userId,
        practitioner_id: data.practitionerId,
        invoice_number: invoiceNumber,
        items,
        subtotal_cents: subtotal,
        notes: data.notes?.trim() || null,
        due_date: data.dueDate || null,
        status: "draft",
      })
      .select("*, practitioner:prescriber_billing_practitioners!practitioner_id(*)")
      .single();
    if (error) throw error;
    return row as unknown as PrescriberInvoice;
  });

export const deletePrescriberInvoice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("prescriber_invoices")
      .delete()
      .eq("id", data.id)
      .eq("prescriber_user_id", context.userId);
    if (error) throw error;
    return { ok: true };
  });

export const markPrescriberInvoicePaid = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; paid: boolean }) => input)
  .handler(async ({ data, context }) => {
    const patch = data.paid
      ? { status: "paid", paid_at: new Date().toISOString() }
      : { status: "sent", paid_at: null };
    const { error } = await context.supabase
      .from("prescriber_invoices")
      .update(patch)
      .eq("id", data.id)
      .eq("prescriber_user_id", context.userId);
    if (error) throw error;
    return { ok: true };
  });

export const ensurePrescriberInvoiceStripeLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data, context }) => {
    const { data: inv, error: invErr } = await context.supabase
      .from("prescriber_invoices")
      .select("*, practitioner:prescriber_billing_practitioners!practitioner_id(*)")
      .eq("id", data.id)
      .eq("prescriber_user_id", context.userId)
      .single();
    if (invErr || !inv) throw invErr || new Error("Invoice not found");

    if (inv.stripe_url) return { stripeUrl: inv.stripe_url as string, stripeId: inv.stripe_payment_link_id as string | null };

    const { data: profile } = await context.supabase
      .from("profiles")
      .select("id, full_name, clinic_name, stripe_connect_account_id")
      .eq("id", await __activeProfileId(context.supabase, context.userId))
      .single();
    if (!profile?.stripe_connect_account_id) {
      throw new Error("Connect your Stripe account first (Dashboard → Payments).");
    }
    const prescriberName = profile.clinic_name || profile.full_name || "Prescriber";
    const practitioner = inv.practitioner as PractitionerClient;

    const { createConnectedPaymentLink } = await import("./stripe.server");
    const link = await createConnectedPaymentLink({
      accountId: profile.stripe_connect_account_id,
      amountCents: inv.subtotal_cents,
      currency: inv.currency ?? "gbp",
      description: `${inv.invoice_number} — ${prescriberName}`,
      descriptorName: prescriberName,
      metadata: {
        kind: "prescriber_invoice",
        invoice_id: String(inv.id),
        invoice_number: String(inv.invoice_number),
        practitioner_id: String(practitioner.id),
      },
    });

    await context.supabase
      .from("prescriber_invoices")
      .update({ stripe_payment_link_id: link.id, stripe_url: link.url })
      .eq("id", inv.id)
      .eq("prescriber_user_id", context.userId);

    return { stripeUrl: link.url, stripeId: link.id };
  });

export const markPrescriberInvoiceSent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data, context }) => {
    const { data: updated, error } = await context.supabase
      .from("prescriber_invoices")
      .update({ status: "sent", sent_at: new Date().toISOString() })
      .eq("id", data.id)
      .eq("prescriber_user_id", context.userId)
      .select("*, practitioner:prescriber_billing_practitioners!practitioner_id(*)")
      .single();
    if (error) throw error;
    return updated as unknown as PrescriberInvoice;
  });

