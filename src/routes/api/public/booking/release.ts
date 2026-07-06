import { createFileRoute } from "@tanstack/react-router";
import type Stripe from "stripe";

// Public "release my hold" endpoint. The embedded /pay page calls this via
// navigator.sendBeacon() when the patient closes / navigates away before
// confirming payment. We look up the PaymentIntent on the practitioner's
// connected Stripe account, read the appointment IDs from its metadata, and
// immediately cancel those pending appointments so the slot re-opens instead
// of waiting for the 10-minute hold to lapse.
//
// Security: this endpoint can only cancel appointments that are currently
// pending AND unpaid AND still linked to the given PI's metadata. It cannot
// touch confirmed / paid bookings. The PI+account pair is not guessable in
// practice (Stripe IDs are opaque), and even a leaked pair only lets an
// attacker release a hold on the booking they already own.

export const Route = createFileRoute("/api/public/booking/release")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: { paymentIntentId?: string; accountId?: string } = {};
        try {
          body = (await request.json()) as typeof body;
        } catch {
          return new Response(JSON.stringify({ ok: false }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }
        const paymentIntentId = body.paymentIntentId?.trim();
        const accountId = body.accountId?.trim();
        if (!paymentIntentId || !accountId) {
          return new Response(JSON.stringify({ ok: false }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }

        try {
          const { getStripe } = await import("@/lib/stripe.server");
          const stripe = getStripe();
          let pi: Stripe.PaymentIntent;
          try {
            pi = await stripe.paymentIntents.retrieve(
              paymentIntentId,
              undefined,
              { stripeAccount: accountId },
            );
          } catch {
            return new Response(JSON.stringify({ ok: false }), {
              status: 404,
              headers: { "Content-Type": "application/json" },
            });
          }

          // Only release when the PI is genuinely abandoned (not confirmed).
          const releasable =
            pi.status === "requires_payment_method" ||
            pi.status === "requires_confirmation" ||
            pi.status === "requires_action";
          if (!releasable) {
            return new Response(JSON.stringify({ ok: false, status: pi.status }), {
              status: 200,
              headers: { "Content-Type": "application/json" },
            });
          }

          const rawIds = (pi.metadata as Record<string, string> | null)?.appointment_ids;
          const ids = (rawIds ?? "")
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean);

          // Best-effort cancel the PI so it can't be resumed on the abandoned tab.
          try {
            await stripe.paymentIntents.cancel(
              paymentIntentId,
              undefined,
              { stripeAccount: accountId },
            );
          } catch {
            // Already cancelled / not cancellable — fine.
          }

          if (ids.length > 0) {
            const { supabaseAdmin } = await import(
              "@/integrations/supabase/client.server"
            );
            await supabaseAdmin
              .from("appointments")
              .update({
                status: "cancelled",
                payment_hold_expires_at: null,
              } as never)
              .in("id", ids)
              .eq("status", "pending")
              .eq("payment_status", "pending");
          }

          return new Response(JSON.stringify({ ok: true, released: ids.length }), {
            headers: { "Content-Type": "application/json" },
          });
        } catch (err) {
          console.error("[release] error", err);
          return new Response(JSON.stringify({ ok: false }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
      },
    },
  },
});
