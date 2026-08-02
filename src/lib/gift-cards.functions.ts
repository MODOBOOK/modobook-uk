import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Generate a human-readable code like GIFT-XKQ7-9M2P */
function makeCode() {
  const alpha = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const pick = (n: number) =>
    Array.from({ length: n }, () => alpha[Math.floor(Math.random() * alpha.length)]).join("");
  return `GIFT-${pick(4)}-${pick(4)}`;
}

export const listMyGiftCards = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("gift_cards")
      .select("*")
      .eq("profile_id", context.userId)
      .order("amount", { ascending: true, nullsFirst: false })
      .order("sort_order")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return { cards: data ?? [] };
  });

const upsertSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1).max(120),
  description: z.string().max(2000).nullable().optional(),
  kind: z.enum(["value", "treatment", "package"]),
  amount: z.number().nonnegative().nullable().optional(),
  treatment_id: z.string().uuid().nullable().optional(),
  package_id: z.string().uuid().nullable().optional(),
  treatment_ids: z.array(z.string().uuid()).optional(),
  package_ids: z.array(z.string().uuid()).optional(),
  image_url: z.string().nullable().optional(),
  expires_months: z.number().int().positive().nullable().optional(),
  active: z.boolean().optional(),
  sort_order: z.number().int().optional(),
});

export const upsertGiftCard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => upsertSchema.parse(d))
  .handler(async ({ data, context }) => {
    const tIds = data.treatment_ids ?? (data.treatment_id ? [data.treatment_id] : []);
    const pIds = data.package_ids ?? (data.package_id ? [data.package_id] : []);
    const row = {
      ...data,
      treatment_ids: tIds,
      package_ids: pIds,
      treatment_id: tIds[0] ?? null,
      package_id: pIds[0] ?? null,
      profile_id: context.userId,
    };
    if (data.id) {
      const { error } = await context.supabase
        .from("gift_cards")
        .update(row)
        .eq("id", data.id)
        .eq("profile_id", context.userId);
      if (error) throw error;
      return { id: data.id };
    }
    const { data: inserted, error } = await context.supabase
      .from("gift_cards")
      .insert(row)
      .select("id")
      .single();
    if (error) throw error;
    return { id: inserted.id };
  });

export const deleteGiftCard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("gift_cards")
      .delete()
      .eq("id", data.id)
      .eq("profile_id", context.userId);
    if (error) throw error;
    return { ok: true };
  });

export const listMyGiftCardPurchases = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("gift_card_purchases")
      .select("*")
      .eq("profile_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw error;
    return { purchases: data ?? [] };
  });

const issueSchema = z.object({
  gift_card_id: z.string().uuid(),
  recipient_name: z.string().min(1).max(120),
  recipient_email: z.string().email(),
  buyer_name: z.string().max(120).optional(),
  message: z.string().max(1000).optional(),
  send_now: z.boolean().default(true),
  custom_amount: z.number().nonnegative().nullable().optional(),
});

/**
 * Practitioner-side manual issue (e.g. when someone paid in person).
 * Creates an ACTIVE purchase row with a fresh code and (optionally) emails it.
 */
export const issueGiftCardManually = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => issueSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { data: card, error: cErr } = await context.supabase
      .from("gift_cards")
      .select("*")
      .eq("id", data.gift_card_id)
      .eq("profile_id", context.userId)
      .single();
    if (cErr || !card) throw new Error("Gift card not found");

    const baseAmount = card.kind === "value" ? Number(card.amount ?? 0) : 0;
    const amount = data.custom_amount != null ? Number(data.custom_amount) : baseAmount;
    const expiresAt = card.expires_months
      ? new Date(Date.now() + card.expires_months * 30 * 24 * 3600 * 1000).toISOString()
      : null;

    // Attempt unique code (up to 5 retries)
    let code = makeCode();
    for (let i = 0; i < 5; i++) {
      const { data: existing } = await context.supabase
        .from("gift_card_purchases")
        .select("id")
        .eq("code", code)
        .maybeSingle();
      if (!existing) break;
      code = makeCode();
    }

    const { data: purchase, error } = await context.supabase
      .from("gift_card_purchases")
      .insert({
        profile_id: context.userId,
        gift_card_id: card.id,
        code,
        kind: card.kind,
        treatment_id: card.treatment_id,
        package_id: card.package_id,
        treatment_ids: card.treatment_ids ?? [],
        package_ids: card.package_ids ?? [],
        initial_amount: amount,
        remaining_amount: amount,
        buyer_name: data.buyer_name ?? null,
        recipient_name: data.recipient_name,
        recipient_email: data.recipient_email,
        message: data.message ?? null,
        delivery: "recipient",
        expires_at: expiresAt,
        status: "active",
        delivered_at: data.send_now ? new Date().toISOString() : null,
      })
      .select("*")
      .single();
    if (error) throw error;

    if (data.send_now) {
      try {
        const { enqueueAppEmail } = await import("./email/send.server");
        await enqueueAppEmail({
          templateName: "gift-card-delivery",
          recipientEmail: data.recipient_email,
          messageId: `gift-card-${purchase.id}`,
          templateData: {
            recipientName: data.recipient_name,
            code,
            cardName: card.name,
            amount: card.kind === "value" ? amount : null,
            expiresAt,
            message: data.message ?? null,
            buyerName: data.buyer_name ?? null,
            profileId: context.userId,
          },
        });
      } catch (e) {
        console.error("[issueGiftCardManually] email failed", e);
      }
    }

    return { id: purchase.id, code };
  });

/**
 * Public: list active gift cards for a clinic slug.
 */
export const listPublicGiftCards = createServerFn({ method: "GET" })
  .inputValidator((d: { slug: string }) => d)
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: prof } = await supabaseAdmin
      .from("profiles")
      .select("user_id")
      .eq("slug", data.slug)
      .maybeSingle();
    if (!prof?.user_id) return { cards: [] };
    const { data: cards, error } = await supabaseAdmin
      .from("gift_cards")
      .select("id,name,description,kind,amount,image_url,treatment_id,package_id,treatment_ids,package_ids,expires_months")
      .eq("profile_id", prof.user_id)
      .eq("active", true)
      .order("amount", { ascending: true, nullsFirst: false })
      .order("sort_order")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return { cards: cards ?? [] };
  });

const purchaseSchema = z.object({
  slug: z.string(),
  gift_card_id: z.string().uuid(),
  buyer_name: z.string().min(1).max(120),
  buyer_email: z.string().email(),
  recipient_name: z.string().min(1).max(120),
  recipient_email: z.string().email(),
  message: z.string().max(1000).optional(),
  delivery: z.enum(["buyer", "recipient"]),
  return_origin: z.string().url(),
});

/**
 * Public: buyer purchase. Creates a pending purchase row and a Stripe Checkout
 * session on the practitioner's connected account. Code is issued on webhook
 * completion.
 */
export const purchaseGiftCard = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => purchaseSchema.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: prof, error: pErr } = await supabaseAdmin
      .from("profiles")
      .select("id, user_id, slug, clinic_name, stripe_connect_account_id")
      .eq("slug", data.slug)
      .single();
    if (pErr || !prof) throw new Error("Clinic not found");
    if (!prof.stripe_connect_account_id) throw new Error("This clinic isn't accepting online payments yet");

    const { data: card, error: cErr } = await supabaseAdmin
      .from("gift_cards")
      .select("*")
      .eq("id", data.gift_card_id)
      .eq("profile_id", prof.user_id)
      .eq("active", true)
      .single();
    if (cErr || !card) throw new Error("Gift card not available");

    // Determine price (sum across all selected treatments/packages)
    const tIds: string[] = (card.treatment_ids && card.treatment_ids.length > 0)
      ? card.treatment_ids
      : (card.treatment_id ? [card.treatment_id] : []);
    const pIds: string[] = (card.package_ids && card.package_ids.length > 0)
      ? card.package_ids
      : (card.package_id ? [card.package_id] : []);

    // Price: honour a saved override amount, otherwise mirror the treatment/package price.
    let amount = card.kind === "value" ? Number(card.amount ?? 0) : Number(card.amount ?? 0);
    if (card.kind === "treatment" && !(amount > 0) && tIds.length) {
      const { data: rows } = await supabaseAdmin
        .from("treatments").select("price").in("id", tIds);
      amount = (rows ?? []).reduce((s, r) => s + Number(r.price ?? 0), 0);
    } else if (card.kind === "package" && !(amount > 0) && pIds.length) {
      const { data: rows } = await supabaseAdmin
        .from("packages").select("price").in("id", pIds);
      amount = (rows ?? []).reduce((s, r) => s + Number(r.price ?? 0), 0);
    }
    if (!amount || amount <= 0) throw new Error("Gift card price is not set");

    const expiresAt = card.expires_months
      ? new Date(Date.now() + card.expires_months * 30 * 24 * 3600 * 1000).toISOString()
      : null;
    const code = makeCode();

    const { data: purchase, error: insErr } = await supabaseAdmin
      .from("gift_card_purchases")
      .insert({
        profile_id: prof.user_id,
        gift_card_id: card.id,
        code,
        kind: card.kind,
        treatment_id: tIds[0] ?? null,
        package_id: pIds[0] ?? null,
        treatment_ids: tIds,
        package_ids: pIds,
        initial_amount: amount,
        remaining_amount: amount,
        buyer_name: data.buyer_name,
        buyer_email: data.buyer_email,
        recipient_name: data.recipient_name,
        recipient_email: data.recipient_email,
        message: data.message ?? null,
        delivery: data.delivery,
        expires_at: expiresAt,
        status: "pending",
      })
      .select("id")
      .single();
    if (insErr) throw insErr;

    const { createCheckoutSession } = await import("./stripe.server");
    const returnUrl = `${data.return_origin.replace(/\/$/, "")}/m/${data.slug}/gift-cards?purchase=${purchase.id}`;
    const session = await createCheckoutSession({
      accountId: prof.stripe_connect_account_id,
      lineItems: [
        {
          quantity: 1,
          price_data: {
            currency: "gbp",
            unit_amount: Math.round(amount * 100),
            product_data: { name: `Gift card — ${card.name}` },
          },
        },
      ],
      successUrl: `${returnUrl}&status=paid`,
      cancelUrl: `${returnUrl}&status=cancelled`,
      customerEmail: data.buyer_email,
      metadata: {
        kind: "gift_card_purchase",
        gift_card_purchase_id: purchase.id,
        profile_id: prof.user_id,
      },
      descriptorName: prof.clinic_name,
    });

    await supabaseAdmin
      .from("gift_card_purchases")
      .update({ stripe_session_id: session.id })
      .eq("id", purchase.id);

    if (!session.url) throw new Error("Could not create checkout session");
    return { checkoutUrl: session.url };
  });

/**
 * Public preview of a code for the booking checkout. Returns applicable
 * amount for the current cart, or an error string.
 */
export const previewGiftCardCode = createServerFn({ method: "POST" })
  .inputValidator((d: { slug: string; code: string; total: number; treatment_ids?: string[]; package_ids?: string[] }) => d)
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: prof } = await supabaseAdmin.from("profiles").select("user_id").eq("slug", data.slug).single();
    if (!prof?.user_id) return { error: "Clinic not found" };
    const { data: p } = await supabaseAdmin
      .from("gift_card_purchases")
      .select("*")
      .eq("profile_id", prof.user_id)
      .eq("code", data.code.trim().toUpperCase())
      .maybeSingle();
    if (!p) return { error: "Code not found" };
    if (p.status !== "active") return { error: "This code is no longer active" };
    if (p.expires_at && new Date(p.expires_at).getTime() < Date.now()) return { error: "This code has expired" };
    if (Number(p.remaining_amount) <= 0) return { error: "This code has been fully used" };

    if (p.kind === "treatment") {
      const allowed: string[] = (p.treatment_ids && p.treatment_ids.length > 0)
        ? p.treatment_ids
        : (p.treatment_id ? [p.treatment_id] : []);
      const match = allowed.some((id) => data.treatment_ids?.includes(id));
      if (!match) return { error: "This code doesn't apply to your selection" };
    }
    if (p.kind === "package") {
      const allowed: string[] = (p.package_ids && p.package_ids.length > 0)
        ? p.package_ids
        : (p.package_id ? [p.package_id] : []);
      const match = allowed.some((id) => data.package_ids?.includes(id));
      if (!match) return { error: "This code doesn't apply to your selection" };
    }

    const applicable = Math.min(Number(p.remaining_amount), data.total);
    return {
      id: p.id,
      code: p.code,
      kind: p.kind as "value" | "treatment" | "package",
      remaining: Number(p.remaining_amount),
      applied: applicable,
    };
  });

/**
 * Public: redeem an amount against a gift card code after a booking is placed.
 * Decrements remaining_amount and logs a redemption row. Idempotent on
 * (purchase_id, appointment_id) via a dedupe check.
 */
export const redeemGiftCardCode = createServerFn({ method: "POST" })
  .inputValidator((d: {
    slug: string;
    code: string;
    amount: number;
    appointment_id?: string | null;
  }) => d)
  .handler(async ({ data }) => {
    if (!data.amount || data.amount <= 0) return { ok: true, redeemed: 0 };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: prof } = await supabaseAdmin
      .from("profiles").select("user_id").eq("slug", data.slug).maybeSingle();
    if (!prof?.user_id) throw new Error("Clinic not found");

    const code = data.code.trim().toUpperCase();
    const { data: p } = await supabaseAdmin
      .from("gift_card_purchases")
      .select("id, profile_id, status, remaining_amount, expires_at")
      .eq("profile_id", prof.user_id)
      .eq("code", code)
      .maybeSingle();
    if (!p) throw new Error("Gift card code not found");
    if (p.status !== "active") throw new Error("Gift card is not active");
    if (p.expires_at && new Date(p.expires_at).getTime() < Date.now()) {
      throw new Error("Gift card has expired");
    }
    const remaining = Number(p.remaining_amount);
    if (remaining <= 0) throw new Error("Gift card has no remaining balance");

    // Idempotency: skip if already logged against this appointment.
    if (data.appointment_id) {
      const { data: existing } = await supabaseAdmin
        .from("gift_card_redemptions")
        .select("id")
        .eq("purchase_id", p.id)
        .eq("appointment_id", data.appointment_id)
        .maybeSingle();
      if (existing) return { ok: true, redeemed: 0 };
    }

    const redeem = Math.min(remaining, Number(data.amount));
    const newRemaining = Number((remaining - redeem).toFixed(2));

    const { error: upErr } = await supabaseAdmin
      .from("gift_card_purchases")
      .update({
        remaining_amount: newRemaining,
        status: newRemaining <= 0 ? "redeemed" : "active",
      })
      .eq("id", p.id);
    if (upErr) throw upErr;

    await supabaseAdmin.from("gift_card_redemptions").insert({
      purchase_id: p.id,
      profile_id: p.profile_id,
      appointment_id: data.appointment_id ?? null,
      amount: redeem,
    });

    return { ok: true, redeemed: redeem };
  });
