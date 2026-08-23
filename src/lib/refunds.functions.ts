import { createServerFn } from "@tanstack/react-start";

/**
 * Automatic refund when a patient cancels in time.
 *
 * Called right after a patient-side cancellation succeeds. It only ever gives
 * money back (never takes any), and only when the clinic has switched
 * "Automatic refunds on in-time cancellations" on, has no no-refund policy in
 * force, and the cancellation landed outside their cancel cutoff window.
 */
export const autoRefundCancelledAppointment = createServerFn({ method: "POST" })
  .inputValidator((input: { appointmentId: string }) => input)
  .handler(async ({ data }) => {
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

      const { data: appt } = await supabaseAdmin
        .from("appointments")
        .select(
          "id, profile_id, status, scheduled_date, start_time, stripe_payment_intent_id, amount_paid_cents, amount_refunded_cents",
        )
        .eq("id", data.appointmentId)
        .maybeSingle();
      if (!appt || appt.status !== "cancelled") return { refunded: false as const };

      const paid = Number(appt.amount_paid_cents ?? 0);
      const refunded = Number(appt.amount_refunded_cents ?? 0);
      const refundable = Math.max(0, paid - refunded);
      if (!appt.stripe_payment_intent_id || refundable <= 0) return { refunded: false as const };

      const { data: prof } = await supabaseAdmin
        .from("profiles")
        .select(
          "id, stripe_connect_account_id, auto_refund_on_cancel, no_refund_policy_enabled, patient_cancel_cutoff_hours",
        )
        .eq("id", appt.profile_id)
        .maybeSingle();
      const p = prof as {
        stripe_connect_account_id?: string | null;
        auto_refund_on_cancel?: boolean | null;
        no_refund_policy_enabled?: boolean | null;
        patient_cancel_cutoff_hours?: number | null;
      } | null;
      if (!p?.auto_refund_on_cancel || p.no_refund_policy_enabled || !p.stripe_connect_account_id) {
        return { refunded: false as const };
      }

      // "Within the period" = cancelled before the clinic's cancel cutoff.
      const cutoffHours = Number(p.patient_cancel_cutoff_hours ?? 0);
      const startsAt = new Date(`${appt.scheduled_date}T${appt.start_time ?? "00:00:00"}Z`).getTime();
      const hoursUntil = (startsAt - Date.now()) / 3_600_000;
      if (hoursUntil < cutoffHours) return { refunded: false as const };

      const { createRefund } = await import("./stripe.server");
      const refund = await createRefund(
        appt.stripe_payment_intent_id,
        p.stripe_connect_account_id,
        refundable / 100,
      );
      const refundedCents = Number(refund.amount ?? refundable);
      const newRefunded = refunded + refundedCents;
      await supabaseAdmin
        .from("appointments")
        .update({
          amount_refunded_cents: newRefunded,
          payment_status: newRefunded >= paid ? "refunded" : "paid",
        } as never)
        .eq("id", appt.id);

      return { refunded: true as const, refundedCents };
    } catch (e) {
      console.error("[autoRefundCancelledAppointment] failed", e);
      return { refunded: false as const };
    }
  });
