// Platform admin console: practitioner directory, safe read-only snapshot,
// scoped edits (never patient data), and audit trail.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data, error } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (error) throw error;
  if (!data) throw new Error("Forbidden");
}

async function logAction(
  context: { supabase: any; userId: string },
  row: {
    target_profile_id?: string | null;
    action: string;
    reason?: string | null;
    diff?: any;
  },
) {
  const { error } = await context.supabase.from("admin_audit_log").insert({
    actor_user_id: context.userId,
    target_profile_id: row.target_profile_id ?? null,
    action: row.action,
    reason: row.reason ?? null,
    diff: row.diff ?? null,
  });
  if (error) console.error("audit log insert failed", error);
}

// ---- Practitioner directory ---------------------------------------------

export const adminListPractitionersFull = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { data, error } = await context.supabase.rpc("admin_list_practitioners");
    if (error) throw error;
    return (data ?? []) as Array<{
      profile_id: string;
      user_id: string;
      email: string | null;
      full_name: string | null;
      clinic_name: string | null;
      slug: string | null;
      active: boolean;
      created_at: string;
      appointments_count: number;
      treatments_count: number;
    }>;
  });

// ---- Practitioner detail (no patient data) ------------------------------

const ALLOWED_PROFILE_COLUMNS = [
  "id",
  "user_id",
  "full_name",
  "clinic_name",
  "slug",
  "tagline",
  "about",
  "bio",
  "phone",
  "email",
  "address",
  "social_links",
  "hero_url",
  "avatar_url",
  "brand_color",
  "active",
  "created_at",
  "updated_at",
] as const;

export const adminGetPractitioner = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { id: string }) => i)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    // Cross-clinic admin read: RLS on these tables scopes to the owner, so the
    // console needs the privileged client (caller already verified as admin).
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;
    const { data: profile, error } = await db
      .from("profiles")
      .select(ALLOWED_PROFILE_COLUMNS.join(","))
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw error;
    if (!profile) throw new Error("Not found");

    const [tx, locs, theme] = await Promise.all([
      db
        .from("treatments")
        .select("id, name, duration, price_cents, active, category_id")
        .eq("profile_id", data.id)
        .order("name"),
      db
        .from("locations")
        .select("id, name, address_line1, address_line2, city, postcode, active")
        .eq("profile_id", data.id),
      db.from("clinic_theme").select("*").eq("profile_id", data.id).maybeSingle(),
    ]);

    return {
      profile,
      treatments: tx.data ?? [],
      locations: locs.data ?? [],
      theme: theme.data ?? null,
    };
  });

// ---- View-as (logs the access) ------------------------------------------

export const adminOpenViewAs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { id: string; reason?: string }) => i)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin: adminDb } = await import("@/integrations/supabase/client.server");
    const { data: p, error } = await (adminDb as any)
      .from("profiles")
      .select("id, slug, clinic_name, full_name")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw error;
    if (!p) throw new Error("Not found");
    await logAction(context, {
      target_profile_id: data.id,
      action: "view_as_open",
      reason: data.reason ?? null,
    });
    return p;
  });

// ---- Edit-for (allow-listed columns only) --------------------------------

const EDITABLE = new Set([
  "clinic_name",
  "slug",
  "tagline",
  "about",
  "bio",
  "phone",
  "email",
  "active",
  "brand_color",
]);

export const adminEditPractitioner = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (i: { id: string; patch: Record<string, unknown>; reason: string }) => i,
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    if (!data.reason || data.reason.trim().length < 3) {
      throw new Error("A short reason is required for edits.");
    }
    const patch: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(data.patch)) {
      if (EDITABLE.has(k)) patch[k] = v;
    }
    if (Object.keys(patch).length === 0) throw new Error("Nothing to update");

    const { supabaseAdmin: readDb } = await import("@/integrations/supabase/client.server");
    const { data: before, error: beforeErr } = await (readDb as any)
      .from("profiles")
      .select(Object.keys(patch).join(","))
      .eq("id", data.id)
      .maybeSingle();
    if (beforeErr) throw beforeErr;

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: after, error } = await (supabaseAdmin as any)
      .from("profiles")
      .update(patch as any)
      .eq("id", data.id)
      .select(Object.keys(patch).join(","))
      .single();
    if (error) throw error;

    await logAction(context, {
      target_profile_id: data.id,
      action: "profile_edit",
      reason: data.reason,
      diff: { before, after },
    });
    return after;
  });

export const adminSetActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { id: string; active: boolean; reason: string }) => i)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    if (!data.reason || data.reason.trim().length < 3) {
      throw new Error("A short reason is required.");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("profiles")
      .update({ active: data.active })
      .eq("id", data.id);
    if (error) throw error;
    await logAction(context, {
      target_profile_id: data.id,
      action: data.active ? "reactivate" : "suspend",
      reason: data.reason,
      diff: { active: data.active },
    });
    return { ok: true };
  });

// ---- Login (account) email ----------------------------------------------

export const adminSetLoginEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { id: string; email: string; reason: string }) => i)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const email = (data.email ?? "").trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Enter a valid email address.");
    if (!data.reason || data.reason.trim().length < 3) {
      throw new Error("A short reason is required.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;

    const { data: profile, error: pErr } = await db
      .from("profiles")
      .select("id, user_id, email")
      .eq("id", data.id)
      .maybeSingle();
    if (pErr) throw pErr;
    if (!profile) throw new Error("Not found");
    if (!profile.user_id) throw new Error("This practitioner has no login account yet.");

    const { error: authErr } = await db.auth.admin.updateUserById(profile.user_id, {
      email,
      email_confirm: true,
    });
    if (authErr) {
      const msg = String(authErr.message || authErr);
      throw new Error(
        /already/i.test(msg) ? "That email is already used by another account." : msg,
      );
    }

    // Keep the contact email in sync so notifications go to the new address.
    await db.from("profiles").update({ email }).eq("id", data.id);

    await logAction(context, {
      target_profile_id: data.id,
      action: "login_email_change",
      reason: data.reason,
      diff: { before: profile.email, after: email },
    });
    return { ok: true, email };
  });


// ---- Audit log ----------------------------------------------------------

export const adminListAudit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (i: {
      target_id?: string | null;
      actor_id?: string | null;
      action?: string | null;
      limit?: number;
    }) => i,
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    let q = context.supabase
      .from("admin_audit_log")
      .select("id, actor_user_id, target_profile_id, action, reason, diff, created_at")
      .order("created_at", { ascending: false })
      .limit(Math.min(data.limit ?? 100, 500));
    if (data.target_id) q = q.eq("target_profile_id", data.target_id);
    if (data.actor_id) q = q.eq("actor_user_id", data.actor_id);
    if (data.action) q = q.eq("action", data.action);
    const { data: rows, error } = await q;
    if (error) throw error;

    // Enrich with actor emails + target names in a second, admin-only lookup.
    const actorIds = Array.from(new Set((rows ?? []).map((r: any) => r.actor_user_id).filter(Boolean)));
    const targetIds = Array.from(
      new Set((rows ?? []).map((r: any) => r.target_profile_id).filter(Boolean)),
    );

    const [{ supabaseAdmin }] = await Promise.all([
      import("@/integrations/supabase/client.server"),
    ]);

    const [actorsRes, targetsRes] = await Promise.all([
      actorIds.length
        ? supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 })
        : Promise.resolve({ data: { users: [] } } as any),
      targetIds.length
        ? supabaseAdmin
            .from("profiles")
            .select("id, full_name, clinic_name")
            .in("id", targetIds)
        : Promise.resolve({ data: [] } as any),
    ]);

    const actorEmail = new Map<string, string>();
    for (const u of (actorsRes as any).data?.users ?? []) {
      if (actorIds.includes(u.id)) actorEmail.set(u.id, u.email ?? "");
    }
    const targetName = new Map<string, string>();
    for (const p of (targetsRes as any).data ?? []) {
      targetName.set(p.id, p.clinic_name || p.full_name || "");
    }

    return (rows ?? []).map((r: any) => ({
      ...r,
      actor_email: actorEmail.get(r.actor_user_id) ?? null,
      target_name: r.target_profile_id ? targetName.get(r.target_profile_id) ?? null : null,
    }));
  });
