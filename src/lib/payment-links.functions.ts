import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function getProfile(supabase: any, userId: string) {
  const { data } = await supabase
    .from("profiles")
    .select("id, stripe_connect_account_id, slug, clinic_name, full_name")
    .eq("user_id", userId)
    .single();
  return data;
}

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
      expiresAt?: string | null;
      currency?: string;
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
    const { createConnectedPaymentLink } = await import("./stripe.server");
    const link = await createConnectedPaymentLink({
      accountId: profile.stripe_connect_account_id,
      amountCents: Math.round(data.amountCents),
      currency: data.currency ?? "gbp",
      description: data.description,
      metadata: {
        profile_id: profile.id,
        appointment_id: data.appointmentId ?? "",
        kind: data.kind ?? "adhoc",
      },
    });

    const { data: row, error } = await context.supabase
      .from("payment_links")
      .insert({
        profile_id: profile.id,
        appointment_id: data.appointmentId ?? null,
        kind: data.kind ?? "adhoc",
        amount_cents: Math.round(data.amountCents),
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
          deposit_required_cents: Math.round(data.amountCents),
          deposit_due_at: data.expiresAt ?? null,
        })
        .eq("id", data.appointmentId)
        .eq("profile_id", profile.id);
    }
    return row;
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
    }
    const { error } = await context.supabase
      .from("appointments")
      .update(patch)
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
