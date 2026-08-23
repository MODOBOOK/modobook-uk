import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type ClinicMembership = {
  profileId: string;
  clinicName: string;
  role: "owner" | "admin" | "practitioner" | "receptionist" | "viewer";
  isOwner: boolean;
  active: boolean;
};

/**
 * Every clinic the signed-in user can work in — their own clinic (if they own
 * one) plus every clinic they've been invited to as staff.
 */
export const listMyClinics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ClinicMembership[]> => {
    const { supabase, userId } = context;
    const { resolveClinicAccess } = await import("./clinic-context.server");
    const access = await resolveClinicAccess(supabase, userId);

    const [{ data: own }, { data: memberships }] = await Promise.all([
      supabase
        .from("profiles")
        .select("id, clinic_name, full_name")
        .eq("user_id", userId)
        .maybeSingle(),
      supabase
        .from("staff_members")
        .select("profile_id, role, status")
        .eq("user_id", userId)
        .eq("status", "active"),
    ]);

    const out: ClinicMembership[] = [];
    if (own?.id) {
      out.push({
        profileId: own.id,
        clinicName: own.clinic_name || own.full_name || "My clinic",
        role: "owner",
        isOwner: true,
        active: access.profileId === own.id,
      });
    }

    const staffIds = (memberships ?? []).map((m: any) => m.profile_id);
    if (staffIds.length > 0) {
      const { data: clinics } = await supabase
        .from("profiles")
        .select("id, clinic_name, full_name")
        .in("id", staffIds);
      for (const m of memberships ?? []) {
        const clinic = (clinics ?? []).find((c: any) => c.id === m.profile_id);
        out.push({
          profileId: m.profile_id,
          clinicName: clinic?.clinic_name || clinic?.full_name || "Clinic",
          role: m.role,
          isOwner: false,
          active: access.profileId === m.profile_id,
        });
      }
    }

    return out;
  });
