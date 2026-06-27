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
