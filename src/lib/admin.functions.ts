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

export const amIAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (error) throw error;
    return { admin: Boolean(data) };
  });

export const adminOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const [pracs, admins, invites] = await Promise.all([
      context.supabase.rpc("admin_list_practitioners"),
      context.supabase.rpc("admin_list_admins"),
      context.supabase.rpc("admin_list_invites"),
    ]);
    if (pracs.error) throw pracs.error;
    if (admins.error) throw admins.error;
    if (invites.error) throw invites.error;
    return {
      practitioners: pracs.data ?? [],
      admins: admins.data ?? [],
      invites: invites.data ?? [],
    };
  });

export const adminGrantByEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { email: string }) => i)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { data: result, error } = await context.supabase.rpc(
      "admin_grant_admin_by_email",
      { _email: data.email },
    );
    if (error) throw error;
    return { status: result as string };
  });

export const adminRevoke = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { user_id: string }) => i)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { error } = await context.supabase.rpc("admin_revoke_admin", {
      _user_id: data.user_id,
    });
    if (error) throw error;
    return { ok: true };
  });

export const adminDeleteInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { id: string }) => i)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { error } = await context.supabase
      .from("admin_invites")
      .delete()
      .eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

export const adminLookupByEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { email: string }) => i)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const email = data.email.trim().toLowerCase();
    if (!email) return { authUsers: [], profiles: [], clients: [] };

    // Search auth.users via admin list (paginated; filter client-side by email substring)
    const authUsers: Array<{ id: string; email: string | null; created_at: string; last_sign_in_at: string | null; email_confirmed_at: string | null }> = [];
    try {
      let page = 1;
      while (page <= 5) {
        const { data: list, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 200 });
        if (error) break;
        for (const u of list.users) {
          if ((u.email ?? "").toLowerCase().includes(email)) {
            authUsers.push({
              id: u.id,
              email: u.email ?? null,
              created_at: u.created_at,
              last_sign_in_at: u.last_sign_in_at ?? null,
              email_confirmed_at: (u as any).email_confirmed_at ?? null,
            });
          }
        }
        if (list.users.length < 200) break;
        page++;
      }
    } catch { /* ignore */ }

    const userIds = authUsers.map((u) => u.id);
    const profQuery = supabaseAdmin
      .from("profiles")
      .select("id, user_id, full_name, clinic_name, slug, active, created_at")
      .limit(50);
    const { data: profiles } = userIds.length
      ? await profQuery.in("user_id", userIds)
      : await profQuery.ilike("clinic_name", `%${email}%`);

    const { data: clients } = await supabaseAdmin
      .from("clinic_clients")
      .select("id, profile_id, full_name, email, phone, created_at")
      .ilike("email", `%${email}%`)
      .limit(50);

    return { authUsers, profiles: profiles ?? [], clients: clients ?? [] };
  });

export const adminSendPasswordReset = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { email: string; redirectTo?: string }) => i)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: link, error } = await supabaseAdmin.auth.admin.generateLink({
      type: "recovery",
      email: data.email,
      options: data.redirectTo ? { redirectTo: data.redirectTo } : undefined,
    });
    if (error) throw error;
    return { actionLink: link.properties?.action_link ?? null };
  });

export const adminSetProfileActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { profile_id: string; active: boolean }) => i)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("profiles")
      .update({ active: data.active })
      .eq("id", data.profile_id);
    if (error) throw error;
    return { ok: true };
  });

export const adminDeleteClient = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { client_id: string }) => i)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("clinic_clients")
      .delete()
      .eq("id", data.client_id);
    if (error) throw error;
    return { ok: true };
  });

export const adminCreatePractitioner = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: {
    email: string;
    full_name?: string | null;
    clinic_name?: string | null;
    password?: string | null;
    send_reset?: boolean;
  }) => i)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const email = data.email.trim().toLowerCase();
    if (!email) throw new Error("Email is required");

    // Generate a temporary password if none given
    const tempPassword =
      data.password && data.password.length >= 8
        ? data.password
        : `Modo-${Math.random().toString(36).slice(2, 10)}-${Math.random().toString(36).slice(2, 6)}`;

    const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: {
        full_name: data.full_name || null,
        clinic_name: data.clinic_name || null,
        created_by_admin: true,
      },
    });
    if (createErr) throw createErr;
    const userId = created.user?.id;
    if (!userId) throw new Error("User creation failed");

    // Ensure a profile exists / update the basic fields if the signup trigger already made one
    await supabaseAdmin
      .from("profiles")
      .upsert(
        {
          user_id: userId,
          full_name: data.full_name || null,
          clinic_name: data.clinic_name || null,
          active: true,
        },
        { onConflict: "user_id" },
      );

    // Note: we intentionally do NOT generate a one-time recovery link here.
    // Those links are frequently consumed by email link-scanners/previewers
    // before the recipient clicks them, resulting in a Supabase
    // "Invalid verification code" page. Instead, share the temp credentials
    // directly and let the new user change their password from their account.
    return {
      mode: "password" as const,
      user_id: userId,
      email,
      temp_password: tempPassword,
      action_link: null as string | null,
    };
  });



