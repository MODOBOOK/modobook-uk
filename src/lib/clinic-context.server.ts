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
  const [{ data: own }, { data: memberships }] = await Promise.all([
    supabase.from("profiles").select("id").eq("user_id", userId).maybeSingle(),
    supabase
      .from("staff_members")
      .select("id, profile_id, role, data_scope, practitioner_id, status")
      .eq("user_id", userId)
      .eq("status", "active"),
  ]);

  const staff = (memberships ?? []) as Array<{
    id: string;
    profile_id: string;
    role: StaffRole;
    data_scope: "clinic" | "own" | null;
    practitioner_id: string | null;
  }>;

  const wanted = selectedClinicCookie();

  if (own?.id && (!wanted || wanted === own.id)) {
    return {
      profileId: own.id,
      isOwner: true,
      role: "owner",
      dataScope: "clinic",
      staffId: null,
      staffPractitionerId: null,
    };
  }

  const match = (wanted && staff.find((s) => s.profile_id === wanted)) || staff[0];
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
