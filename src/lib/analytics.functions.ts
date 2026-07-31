import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function getProfileId(supabase: any, userId: string) {
  const { data } = await supabase
    .from("profiles")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();
  return data?.id as string | undefined;
}

export const getDashboardAnalytics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const profileId = await getProfileId(supabase, userId);
    if (!profileId) {
      return {
        appointments: [],
        patientCount: 0,
        newPatientsThisMonth: 0,
        returningPatientsThisMonth: 0,
      };
    }

    const { data: appointments, error: apptErr } = await supabase
      .from("appointments")
      .select(
        "id, patient_name, patient_email, patient_user_id, scheduled_date, start_time, end_time, status, payment_status, total_amount, amount_paid_cents, amount_refunded_cents, checkout_discount_cents, treatments(name, color, category_id)",
      )
      .eq("profile_id", profileId)
      .order("scheduled_date", { ascending: true })
      .order("start_time", { ascending: true });

    if (apptErr) throw apptErr;

    const { count: patientCount, error: patientErr } = await supabase
      .from("appointments")
      .select("patient_email", { count: "exact", head: true })
      .eq("profile_id", profileId)
      .not("patient_email", "is", null);

    if (patientErr) throw patientErr;

    return {
      appointments: appointments ?? [],
      patientCount: patientCount ?? 0,
      newPatientsThisMonth: 0,
      returningPatientsThisMonth: 0,
    };
  });
