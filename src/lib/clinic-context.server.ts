import { getCookie } from "@tanstack/react-start/server";

export type StaffRole = "admin" | "practitioner" | "receptionist" | "viewer";

export type ClinicAccess = {
  profileId: string | null;
  isOwner: boolean;
  role: "owner" | StaffRole;
  dataScope: "clinic" | "own";
  staffId: string | null;
  staffPractitionerId: string | null;
};

const NONE: ClinicAccess = {
  profileId: null,
  isOwner: false,
  role: "viewer",
  dataScope: "clinic",
  staffId: null,
  staffPractitionerId: null,
};

function selectedClinicCookie(): string | null {
  try {
    return (getCookie("modo_clinic") as string | undefined) || null;
  } catch {
    return null;
  }
}

export async function resolveClinicAccess(
  supabase: any,
  userId: string,
): Promise<ClinicAccess> {
  if (!userId) return NONE;

  const { data: own } = await supabase
    .from("profiles")
    .select("id")
    .or(`user_id.eq.${userId},id.eq.${userId}`)
    .maybeSingle();

  let staff: Array<{
    id: string;
    profile_id: string;
    role: StaffRole;
    data_scope: "clinic" | "own" | null;
    practitioner_id: string | null;
  }> = [];

  try {
    const { data: memberships } = await supabase
      .from("staff_members")
      .select("id, profile_id, role, data_scope, practitioner_id, status")
      .eq("user_id", userId)
      .eq("status", "active");
    staff = memberships ?? [];
  } catch {
    staff = [];
  }

  const wanted = selectedClinicCookie();

  // An explicit clinic selection (ClinicSwitcher cookie) always wins — even
  // for users who own a clinic but are staff/admin of another. Without this,
  // owners can never switch into a clinic they administer.
  const chosen = wanted ? staff.find((s) => s.profile_id === wanted) : undefined;
  if (chosen) {
    return {
      profileId: chosen.profile_id,
      isOwner: false,
      role: chosen.role,
      dataScope: chosen.data_scope === "own" ? "own" : "clinic",
      staffId: chosen.id,
      staffPractitionerId: chosen.practitioner_id ?? null,
    };
  }

  if (own?.id) {
    return {
      profileId: own.id,
      isOwner: true,
      role: "owner",
      dataScope: "clinic",
      staffId: null,
      staffPractitionerId: null,
    };
  }

  const match = staff[0];
  if (match) {
    return {
      profileId: match.profile_id,
      isOwner: false,
      role: match.role,
      dataScope: match.data_scope === "own" ? "own" : "clinic",
      staffId: match.id,
      staffPractitionerId: match.practitioner_id ?? null,
    };
  }

  return NONE;
}

export async function activeProfileId(
  supabase: any,
  userId: string,
): Promise<string | null> {
  const access = await resolveClinicAccess(supabase, userId);
  return access.profileId;
}

export async function assertClinicOwner(supabase: any, userId: string) {
  const access = await resolveClinicAccess(supabase, userId);
  if (!access.isOwner) throw new Error("Only the clinic owner can do this.");
  return access.profileId!;
}
