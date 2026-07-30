import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function getProfile(supabase: any, userId: string) {
  const { data } = await supabase
    .from("profiles")
    .select(
      "id, stripe_connect_account_id, slug, clinic_name, full_name, payment_pass_fees_to_customer, payment_surcharge_card_enabled, payment_surcharge_card_percent, stripe_fee_pass_to_patient, stripe_fee_card_percent, stripe_fee_card_fixed_cents",
    )
    .eq("user_id", userId)
    .single();
  return data;
}

// Compute the platform/processing surcharge (in pence) for a card payment
// link, mirroring the same rules used in the public checkout flow so a link
// sent from the app charges the patient exactly what the practitioner has
// configured.
export const DEFAULT_CARD_FEE_PERCENT = 1.5;
export const DEFAULT_CARD_FEE_FIXED_CENTS = 20;

type FeeProfile = {
  payment_pass_fees_to_customer?: boolean | null;
  payment_surcharge_card_enabled?: boolean | null;
  payment_surcharge_card_percent?: number | null;
  stripe_fee_pass_to_patient?: boolean | null;
  stripe_fee_card_percent?: number | null;
  stripe_fee_card_fixed_cents?: number | null;
};

// When the practitioner explicitly ticks "add fees" on a link we always add a
// fee, even if the automatic pass-through settings are switched off — falling
// back to standard card processing rates so the toggle is never a no-op.
function computeCardSurchargeCents(subtotalCents: number, p: FeeProfile, force = false) {
  let surcharge = 0;
  let configured = false;

  if (p.payment_pass_fees_to_customer && p.payment_surcharge_card_enabled) {
    const pct = Number(p.payment_surcharge_card_percent ?? 0);
    if (pct > 0) {
      surcharge += (subtotalCents * pct) / 100;
      configured = true;
    }
  }
  if (p.stripe_fee_pass_to_patient) {
    const pct = Number(p.stripe_fee_card_percent ?? 0);
    const fixed = Number(p.stripe_fee_card_fixed_cents ?? 0);
    if (pct > 0) {
      surcharge += (subtotalCents * pct) / 100;
      configured = true;
    }
    if (fixed > 0) {
      surcharge += fixed;
      configured = true;
    }
  }

  if (!configured && force) {
    // Fall back to the practitioner's saved rates if present, else defaults.
    const pct = Number(p.stripe_fee_card_percent ?? 0) || Number(p.payment_surcharge_card_percent ?? 0) || DEFAULT_CARD_FEE_PERCENT;
    const fixed = Number(p.stripe_fee_card_fixed_cents ?? DEFAULT_CARD_FEE_FIXED_CENTS);
    surcharge = (subtotalCents * pct) / 100 + fixed;
  }

  return Math.round(surcharge);
}

// Preview the fee that would be added to a link of a given amount, so the
// dashboard can show the exact figure before the link is created.
export const previewLinkFee = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { amountCents: number }) => input)
  .handler(async ({ data, context }) => {
    const profile = await getProfile(context.supabase, context.userId);
    const subtotal = Math.max(0, Math.round(Number(data.amountCents) || 0));
    if (!profile || subtotal <= 0) return { subtotal_cents: subtotal, surcharge_cents: 0, total_cents: subtotal };
    const surcharge = computeCardSurchargeCents(subtotal, profile, true);
    return { subtotal_cents: subtotal, surcharge_cents: surcharge, total_cents: subtotal + surcharge };
  });

export const createPaymentLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      amountCents: number;
      description: string;
      kind?: "adhoc" | "deposit" | "checkout";
      appointmentId?: string | null;
      recipientEmail?: string | null;
      recipientName?: string | null;
      recipientPhone?: string | null;
      expiresAt?: string | null;
      currency?: string;
      includeFees?: boolean;
    }) => input,
  )
  .handler(async ({ data, context }) => {
    const profile = await getProfile(context.supabase, context.userId);
    if (!profile) throw new Error("Profile not found");
    if (!profile.stripe_connect_account_id) {
      throw new Error("Connect your Stripe account first (Dashboard → Payments).");
    }
    if (!Number.isFinite(data.amountCents) || data.amountCents < 100) {
      throw new Error("Minimum amount is £1.00");
    }
    const subtotalCents = Math.round(data.amountCents);
    const includeFees = data.includeFees ?? true;
    const surchargeCents = includeFees ? computeCardSurchargeCents(subtotalCents, profile, true) : 0;
    const totalCents = subtotalCents + surchargeCents;

    const { createConnectedPaymentLink } = await import("./stripe.server");
    const link = await createConnectedPaymentLink({
      accountId: profile.stripe_connect_account_id,
      amountCents: subtotalCents,
      currency: data.currency ?? "gbp",
      description: data.description,
      surchargeCents,
      descriptorName: profile.clinic_name ?? profile.full_name,
      metadata: {
        profile_id: profile.id,
        appointment_id: data.appointmentId ?? "",
        kind: data.kind ?? "adhoc",
        surcharge_cents: String(surchargeCents),
      },
    });

    const { data: row, error } = await context.supabase
      .from("payment_links")
      .insert({
        profile_id: profile.id,
        appointment_id: data.appointmentId ?? null,
        kind: data.kind ?? "adhoc",
        amount_cents: totalCents,
        currency: (data.currency ?? "gbp").toLowerCase(),
        description: data.description,
        stripe_payment_link_id: link.id,
        stripe_url: link.url,
        expires_at: data.expiresAt ?? null,
        recipient_email: data.recipientEmail ?? null,
        recipient_name: data.recipientName ?? null,
        status: "open",
      })
      .select()
      .single();
    if (error) throw error;

    if (data.appointmentId && (data.kind === "deposit" || !data.kind)) {
      await context.supabase
        .from("appointments")
        .update({
          deposit_payment_link_id: row.id,
          deposit_required_cents: subtotalCents,
          deposit_due_at: data.expiresAt ?? null,
        })
        .eq("id", data.appointmentId)
        .eq("profile_id", profile.id);
    }
    return {
      ...row,
      subtotal_cents: subtotalCents,
      surcharge_cents: surchargeCents,
      total_cents: totalCents,
      recipient_phone: data.recipientPhone ?? null,
    };
  });


export const listPaymentLinks = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const profile = await getProfile(context.supabase, context.userId);
    if (!profile) return [];
    const { data, error } = await context.supabase
      .from("payment_links")
      .select("*")
      .eq("profile_id", profile.id)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw error;
    return data ?? [];
  });

export const cancelPaymentLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data, context }) => {
    const profile = await getProfile(context.supabase, context.userId);
    if (!profile) throw new Error("Profile not found");
    const { data: row } = await context.supabase
      .from("payment_links")
      .select("stripe_payment_link_id")
      .eq("id", data.id)
      .eq("profile_id", profile.id)
      .single();
    if (row?.stripe_payment_link_id && profile.stripe_connect_account_id) {
      try {
        const { deactivatePaymentLink } = await import("./stripe.server");
        await deactivatePaymentLink(profile.stripe_connect_account_id, row.stripe_payment_link_id);
      } catch (e) {
        /* ignore */
      }
    }
    const { error } = await context.supabase
      .from("payment_links")
      .update({ status: "cancelled" })
      .eq("id", data.id)
      .eq("profile_id", profile.id);
    if (error) throw error;
    return { ok: true };
  });

// Mark checkout completed for an appointment — discount, notes, method, optional payment link.
export const completeAppointmentCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      appointmentId: string;
      method: "stripe_link" | "card_present" | "cash" | "bank_transfer";
      discountCents?: number | null;
      notes?: string | null;
      markPaid?: boolean;
    }) => input,
  )
  .handler(async ({ data, context }) => {
    const profile = await getProfile(context.supabase, context.userId);
    if (!profile) throw new Error("Profile not found");
    const patch: Record<string, unknown> = {
      checkout_method: data.method,
      checkout_notes: data.notes ?? null,
      checkout_discount_cents: data.discountCents ?? null,
    };
    if (data.markPaid) {
      patch.payment_status = "paid";
      patch.payment_method = data.method;
      patch.checkout_completed_at = new Date().toISOString();
      // Record the outstanding balance as paid so paid/outstanding badges
      // stay accurate after an in-person checkout.
      const { data: cur } = await context.supabase
        .from("appointments")
        .select("total_amount, amount_paid_cents")
        .eq("id", data.appointmentId)
        .eq("profile_id", profile.id)
        .maybeSingle();
      const totalCents = Math.round(Number((cur as { total_amount?: number | null } | null)?.total_amount ?? 0) * 100);
      const already = Number((cur as { amount_paid_cents?: number } | null)?.amount_paid_cents ?? 0);
      const discount = Number(data.discountCents ?? 0);
      const remaining = Math.max(0, totalCents - already - discount);
      patch.amount_paid_cents = already + remaining;
    }

    const { error } = await context.supabase
      .from("appointments")
      .update(patch as never)
      .eq("id", data.appointmentId)
      .eq("profile_id", profile.id);

    if (error) throw error;
    return { ok: true };
  });

// Auto-cancel appointments whose deposit window expired without payment.
export const expireUnpaidDeposits = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const profile = await getProfile(context.supabase, context.userId);
    if (!profile) return { cancelled: 0 };
    const nowIso = new Date().toISOString();
    const { data: due } = await context.supabase
      .from("appointments")
      .select("id")
      .eq("profile_id", profile.id)
      .not("deposit_due_at", "is", null)
      .is("deposit_paid_at", null)
      .lt("deposit_due_at", nowIso)
      .neq("status", "cancelled");
    if (!due || due.length === 0) return { cancelled: 0 };
    const ids = due.map((r: { id: string }) => r.id);
    await context.supabase
      .from("appointments")
      .update({ status: "cancelled" })
      .in("id", ids)
      .eq("profile_id", profile.id);
    return { cancelled: ids.length };
  });
