import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function getProfileId(supabase: any, userId: string) {
  const { data } = await supabase.from("profiles").select("id").eq("user_id", userId).maybeSingle();
  return data?.id as string | undefined;
}

export type StaffRole = "admin" | "practitioner" | "receptionist" | "viewer";
export type StaffScope = "clinic" | "own";
export type StaffStatus = "invited" | "active" | "disabled";

function randomToken() {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}


// Treating staff each get a bookable practitioner record so they show on the
// booking page, rota and calendar. Keeps staff logins and practitioners in sync.
async function ensurePractitionerRecord(
  supabase: any,
  profileId: string,
  staff: { id: string; name: string; practitioner_id: string | null },
) {
  if (staff.practitioner_id) {
    await supabase.from("practitioners").update({ active: true }).eq("id", staff.practitioner_id).eq("profile_id", profileId);
    return staff.practitioner_id as string;
  }
  const { data: created, error } = await supabase
    .from("practitioners")
    .insert({ profile_id: profileId, name: staff.name, active: true })
    .select("id")
    .single();
  if (error) throw error;
  await supabase.from("staff_members").update({ practitioner_id: created.id }).eq("id", staff.id).eq("profile_id", profileId);
  return created.id as string;
}

async function deactivatePractitionerRecord(supabase: any, profileId: string, practitionerId: string | null) {
  if (!practitionerId) return;
  await supabase.from("practitioners").update({ active: false }).eq("id", practitionerId).eq("profile_id", profileId);
}

export const listStaff = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const profileId = await getProfileId(context.supabase, context.userId);
    if (!profileId) return [];
    const { data, error } = await context.supabase
      .from("staff_members")
      .select("id, name, invited_email, role, data_scope, practitioner_id, status, invited_at, accepted_at, last_active_at, invite_expires_at")
      .eq("profile_id", profileId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data ?? [];
  });

type InviteInput = {
  name: string;
  /** Optional — a team member can be added now and invited to log in later. */
  email?: string;
  role: StaffRole;
  data_scope?: StaffScope;
  practitioner_id?: string | null;
};

export const inviteStaff = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: InviteInput) => d)
  .handler(async ({ data, context }) => {
    const profileId = await getProfileId(context.supabase, context.userId);
    if (!profileId) throw new Error("Profile not found");
    const email = (data.email ?? "").trim().toLowerCase();
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Invalid email");
    if (!data.name.trim()) throw new Error("Name is required");

    // Demo clinic must never be able to hand out real MODO logins.
    const { assertNotDemoProfile } = await import("./demo-guard.server");
    await assertNotDemoProfile(profileId);

    if (data.role === "practitioner") {
      const { assertSeatAvailable } = await import("./practitioner-billing.functions");
      await assertSeatAvailable(context.supabase, profileId, "practitioner");
    }

    const token = randomToken();
    const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const { data: row, error } = await context.supabase
      .from("staff_members")
      .upsert(
        {
          profile_id: profileId,
          invited_email: email || null,
          name: data.name.trim(),
          role: data.role,
          data_scope: data.data_scope ?? "clinic",
          practitioner_id: data.role === "practitioner" ? data.practitioner_id ?? null : null,
          status: "invited",
          invite_token: email ? token : null,
          invite_expires_at: email ? expires : null,
          invited_at: new Date().toISOString(),
        },
        { onConflict: "profile_id,invited_email" },
      )
      .select()
      .single();
    if (error) throw error;

    if (data.role === "practitioner") {
      await ensurePractitionerRecord(context.supabase, profileId, row as any);
    }

    // No email yet — the clinic can add one later and send the login invite.
    if (!email) return row;

    // Send invite email using service-role (public flow)
    try {
      const { tryEnqueueAppEmail, getPractitionerBranding } = await import("@/lib/email/send.server");
      const branding = await getPractitionerBranding(profileId);
      const { data: prof } = await context.supabase
        .from("profiles").select("clinic_name").eq("id", profileId).maybeSingle();
      const origin = process.env.PUBLIC_APP_URL || process.env.APP_URL || "https://modobook.uk";
      const roleLabel = data.role === "admin" ? "Admin" : data.role === "practitioner" ? "Practitioner" : data.role === "receptionist" ? "Receptionist" : "Viewer";
      await tryEnqueueAppEmail({
        templateName: "staff-invite",
        recipientEmail: email,
        messageId: `staff-invite-${row.id}-${token.slice(0, 8)}`,
        templateData: {
          inviteeName: data.name.trim().split(" ")[0] || "there",
          clinicName: prof?.clinic_name ?? branding.clinicName,
          role: roleLabel,
          inviterName: undefined,
          acceptUrl: `${origin}/staff-accept/${token}`,
          logoUrl: branding.logoUrl,
          brandColor: branding.brandColor,
        },
      });
    } catch (e) { console.error("[inviteStaff] email failed", e); }

    return row;
  });

export const updateStaff = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; name?: string; role?: StaffRole; data_scope?: StaffScope; practitioner_id?: string | null; status?: StaffStatus }) => d)
  .handler(async ({ data, context }) => {
    const profileId = await getProfileId(context.supabase, context.userId);
    if (!profileId) throw new Error("Profile not found");
    const patch: {
      name?: string; role?: StaffRole; data_scope?: StaffScope;
      practitioner_id?: string | null; status?: StaffStatus;
    } = {};
    if (data.name !== undefined) patch.name = data.name;
    if (data.role !== undefined) patch.role = data.role;
    if (data.data_scope !== undefined) patch.data_scope = data.data_scope;
    if (data.practitioner_id !== undefined) patch.practitioner_id = data.practitioner_id;
    if (data.status !== undefined) patch.status = data.status;

    const { data: existing } = await context.supabase
      .from("staff_members")
      .select("id, name, role, status, practitioner_id")
      .eq("id", data.id).eq("profile_id", profileId).maybeSingle();
    if (!existing) throw new Error("Team member not found");

    const nextRole = (data.role ?? existing.role) as StaffRole;
    const nextStatus = (data.status ?? existing.status) as StaffStatus;
    if (nextRole === "practitioner" && data.role === "practitioner" && existing.role !== "practitioner") {
      const { assertSeatAvailable } = await import("./practitioner-billing.functions");
      await assertSeatAvailable(context.supabase, profileId, "practitioner");
    }

    const { error } = await context.supabase
      .from("staff_members").update(patch).eq("id", data.id).eq("profile_id", profileId);
    if (error) throw error;

    if (nextRole === "practitioner" && nextStatus !== "disabled") {
      await ensurePractitionerRecord(context.supabase, profileId, {
        id: existing.id,
        name: data.name ?? existing.name,
        practitioner_id: data.practitioner_id !== undefined ? data.practitioner_id : existing.practitioner_id,
      });
      if (data.name) {
        const pid = data.practitioner_id !== undefined ? data.practitioner_id : existing.practitioner_id;
        if (pid) await context.supabase.from("practitioners").update({ name: data.name }).eq("id", pid).eq("profile_id", profileId);
      }
    } else {
      await deactivatePractitionerRecord(context.supabase, profileId, existing.practitioner_id);
    }
    return { ok: true };
  });

export const revokeStaff = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    const profileId = await getProfileId(context.supabase, context.userId);
    if (!profileId) throw new Error("Profile not found");
    const { data: existing } = await context.supabase
      .from("staff_members").select("practitioner_id").eq("id", data.id).eq("profile_id", profileId).maybeSingle();
    const { error } = await context.supabase
      .from("staff_members").delete().eq("id", data.id).eq("profile_id", profileId);
    if (error) throw error;
    await deactivatePractitionerRecord(context.supabase, profileId, existing?.practitioner_id ?? null);
    return { ok: true };
  });

export const resendStaffInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    const profileId = await getProfileId(context.supabase, context.userId);
    if (!profileId) throw new Error("Profile not found");
    {
      const { assertNotDemoProfile } = await import("./demo-guard.server");
      await assertNotDemoProfile(profileId);
    }
    const token = randomToken();
    const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data: row, error } = await context.supabase
      .from("staff_members")
      .update({ invite_token: token, invite_expires_at: expires, status: "invited", invited_at: new Date().toISOString() })
      .eq("id", data.id).eq("profile_id", profileId).select().single();
    if (error) throw error;
    if (!row.invited_email) {
      throw new Error("Add an email address for this team member before sending their invite.");
    }
    try {
      const { tryEnqueueAppEmail, getPractitionerBranding } = await import("@/lib/email/send.server");
      const branding = await getPractitionerBranding(profileId);
      const { data: prof } = await context.supabase.from("profiles").select("clinic_name").eq("id", profileId).maybeSingle();
      const origin = process.env.PUBLIC_APP_URL || process.env.APP_URL || "https://modobook.uk";
      const roleLabel = row.role === "admin" ? "Admin" : row.role === "practitioner" ? "Practitioner" : row.role === "receptionist" ? "Receptionist" : "Viewer";
      await tryEnqueueAppEmail({
        templateName: "staff-invite",
        recipientEmail: row.invited_email,
        messageId: `staff-invite-${row.id}-${token.slice(0, 8)}`,
        templateData: {
          inviteeName: row.name.split(" ")[0] || "there",
          clinicName: prof?.clinic_name ?? branding.clinicName,
          role: roleLabel,
          acceptUrl: `${origin}/staff-accept/${token}`,
          logoUrl: branding.logoUrl,
          brandColor: branding.brandColor,
        },
      });
    } catch (e) { console.error("[resendStaffInvite] email failed", e); }
    return { ok: true };
  });

// Public: look up an invite by token (used by the accept page)
export const getStaffInvite = createServerFn({ method: "GET" })
  .inputValidator((d: { token: string }) => d)
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin
      .from("staff_members")
      .select("id, name, invited_email, role, status, invite_expires_at, profile_id, profiles(clinic_name)")
      .eq("invite_token", data.token)
      .maybeSingle();
    if (!row) return { ok: false as const, reason: "not_found" as const };
    {
      const { isDemoProfileId } = await import("./demo-guard.server");
      if (await isDemoProfileId(row.profile_id as string)) {
        return { ok: false as const, reason: "not_found" as const };
      }
    }
    if (row.status !== "invited") return { ok: false as const, reason: "used" as const };
    if (row.invite_expires_at && new Date(row.invite_expires_at) < new Date()) {
      return { ok: false as const, reason: "expired" as const };
    }
    return {
      ok: true as const,
      name: row.name,
      email: row.invited_email,
      role: row.role,
      clinicName: (row as any).profiles?.clinic_name ?? "the clinic",
    };
  });

// Authenticated: accept invite — matches token to caller's email/user_id
export const acceptStaffInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { token: string }) => d)
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin
      .from("staff_members")
      .select("id, invited_email, invite_expires_at, status, profile_id")
      .eq("invite_token", data.token)
      .maybeSingle();
    if (!row) throw new Error("Invite not found");
    {
      const { assertNotDemoProfile } = await import("./demo-guard.server");
      await assertNotDemoProfile((row as any).profile_id, "This invite is no longer valid.");
    }
    if (row.status !== "invited") throw new Error("Invite already used");
    if (row.invite_expires_at && new Date(row.invite_expires_at) < new Date()) {
      throw new Error("Invite expired");
    }
    // Get caller's email
    const email = (context.claims as any)?.email as string | undefined;
    if (email && row.invited_email && email.toLowerCase() !== row.invited_email.toLowerCase()) {
      throw new Error(`This invite is for ${row.invited_email}. Sign in with that email to accept.`);
    }
    const { error } = await supabaseAdmin
      .from("staff_members")
      .update({
        user_id: context.userId,
        status: "active",
        accepted_at: new Date().toISOString(),
        invite_token: null,
        invite_expires_at: null,
      })
      .eq("id", row.id);
    if (error) throw error;
    return { ok: true };
  });

// Get the current user's staff membership (for role-based UI gating)
export const getMyStaffMembership = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const ownProfileId = await getProfileId(context.supabase, context.userId);
    if (ownProfileId) {
      return { isOwner: true as const, profileId: ownProfileId, role: "admin" as StaffRole, dataScope: "clinic" as StaffScope };
    }
    const { data } = await context.supabase
      .from("staff_members")
      .select("profile_id, role, data_scope, status")
      .eq("user_id", context.userId)
      .eq("status", "active")
      .maybeSingle();
    if (!data) return { isOwner: false as const, profileId: null, role: null, dataScope: null };
    return {
      isOwner: false as const,
      profileId: data.profile_id as string,
      role: data.role as StaffRole,
      dataScope: data.data_scope as StaffScope,
    };
  });

// List every clinic the current signed-in user has been invited into as staff.
// Self-read is allowed by the "Staff can read their own row" policy on staff_members.
export const listMyStaffMemberships = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("staff_members")
      .select("id, profile_id, role, data_scope, status, accepted_at, profiles(clinic_name, first_name, last_name, avatar_url)")
      .eq("user_id", context.userId)
      .order("accepted_at", { ascending: false });
    if (error) throw error;
    return (data ?? []).map((r: any) => ({
      id: r.id as string,
      profileId: r.profile_id as string,
      role: r.role as StaffRole,
      dataScope: r.data_scope as StaffScope,
      status: r.status as StaffStatus,
      acceptedAt: r.accepted_at as string | null,
      clinicName: r.profiles?.clinic_name ?? [r.profiles?.first_name, r.profiles?.last_name].filter(Boolean).join(" ") ?? "Clinic",
      logoUrl: r.profiles?.avatar_url ?? null,
    }));
  });
