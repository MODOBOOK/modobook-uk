import { createServerFn } from "@tanstack/react-start";

/**
 * Automatic refund when a patient cancels in time.
 *
 * Called right after a patient-side cancellation succeeds. It only ever gives
 * money back (never takes any), and only when the clinic has switched
 * "Automatic refunds on in-time cancellations" on, has no no-refund policy in
 * force, and the cancellation landed outside their cancel cutoff window.
 */
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const autoRefundCancelledAppointment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { appointmentId: string }) => input)
  .handler(async ({ data, context }) => {
    // Only the patient who owns the appointment may trigger its auto refund.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: appt } = await supabaseAdmin
      .from("appointments")
      .select("id, patient_user_id, patient_email")
      .eq("id", data.appointmentId)
      .maybeSingle();
    const email = String((context.claims as { email?: string } | null)?.email ?? "").trim().toLowerCase();
    const a = appt as { patient_user_id?: string | null; patient_email?: string | null } | null;
    const owns = !!a && (a.patient_user_id === context.userId || (!!email && String(a.patient_email ?? "").trim().toLowerCase() === email));
    if (!owns) return { refunded: false as const };
    const { runAutoRefund } = await import("./refunds.server");
    return runAutoRefund(data.appointmentId);
  });
