import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function __activeProfileId(supabase: any, userId: string) {
  const { activeProfileId } = await import("./clinic-context.server");
  return (await activeProfileId(supabase, userId)) ?? "00000000-0000-0000-0000-000000000000";
}

async function getProfileId(supabase: any, userId: string) {
  const { data } = await supabase.from("profiles").select("id").eq("id", await __activeProfileId(supabase, userId)).maybeSingle();
  return data?.id as string | undefined;
}

/** Find or create a clinic_client matched by email (preferred) or name for this practitioner. */
async function findOrCreateClient(
  supabase: any,
  profileId: string,
  args: { name: string; email?: string | null; phone?: string | null },
) {
  if (args.email) {
    const { data } = await supabase
      .from("clinic_clients")
      .select("id, no_show_count, is_blocked")
      .eq("profile_id", profileId)
      .ilike("email", args.email)
      .maybeSingle();
    if (data) return data;
  }
  const { data: byName } = await supabase
    .from("clinic_clients")
    .select("id, no_show_count, is_blocked")
    .eq("profile_id", profileId)
    .ilike("full_name", args.name)
    .maybeSingle();
  if (byName) return byName;
  const { data: created, error } = await supabase
    .from("clinic_clients")
    .insert({
      profile_id: profileId,
      full_name: args.name,
      email: args.email ?? null,
      phone: args.phone ?? null,
    })
    .select("id, no_show_count, is_blocked")
    .single();
  if (error) throw error;
  return created;
}

export const getOrCreateClientForAppointment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { appointmentId: string }) => i)
  .handler(async ({ data, context }) => {
    const profileId = await getProfileId(context.supabase, context.userId);
    if (!profileId) throw new Error("No profile");
    const { data: a, error } = await context.supabase
      .from("appointments")
      .select("patient_name, patient_email, patient_phone, profile_id")
      .eq("id", data.appointmentId)
      .single();
    if (error) throw error;
    if (a.profile_id !== profileId) throw new Error("Forbidden");
    const c = await findOrCreateClient(context.supabase, profileId, {
      name: a.patient_name,
      email: a.patient_email,
      phone: a.patient_phone,
    });
    return { clientId: c.id, isBlocked: !!c.is_blocked, noShowCount: c.no_show_count ?? 0 };
  });

export const markAppointmentNoShow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { appointmentId: string }) => i)
  .handler(async ({ data, context }) => {
    const profileId = await getProfileId(context.supabase, context.userId);
    if (!profileId) throw new Error("No profile");
    const { data: a, error } = await context.supabase
      .from("appointments")
      .select("patient_name, patient_email, patient_phone, profile_id, status")
      .eq("id", data.appointmentId)
      .single();
    if (error) throw error;
    if (a.profile_id !== profileId) throw new Error("Forbidden");
    if (a.status === "no_show") return { ok: true, alreadyNoShow: true };

    const { error: e2 } = await context.supabase
      .from("appointments")
      .update({ status: "no_show" })
      .eq("id", data.appointmentId);
    if (e2) throw e2;

    const c = await findOrCreateClient(context.supabase, profileId, {
      name: a.patient_name,
      email: a.patient_email,
      phone: a.patient_phone,
    });
    const newCount = (c.no_show_count ?? 0) + 1;
    await context.supabase
      .from("clinic_clients")
      .update({ no_show_count: newCount })
      .eq("id", c.id);

    return { ok: true, clientId: c.id, noShowCount: newCount };
  });

export const setClientBlocked = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { clientId: string; blocked: boolean; reason?: string | null }) => i)
  .handler(async ({ data, context }) => {
    const profileId = await getProfileId(context.supabase, context.userId);
    if (!profileId) throw new Error("No profile");
    const { error } = await context.supabase
      .from("clinic_clients")
      .update({
        is_blocked: data.blocked,
        block_reason: data.blocked ? data.reason ?? null : null,
        blocked_at: data.blocked ? new Date().toISOString() : null,
      })
      .eq("id", data.clientId)
      .eq("profile_id", profileId);
    if (error) throw error;
    return { ok: true };
  });
