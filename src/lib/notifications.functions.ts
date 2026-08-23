import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function __activeProfileId(supabase: any, userId: string) {
  const { activeProfileId } = await import("./clinic-context.server");
  return (await activeProfileId(supabase, userId)) ?? "00000000-0000-0000-0000-000000000000";
}

export type NotificationRow = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  emoji: string | null;
  link: string | null;
  entity_id: string | null;
  entity_type: string | null;
  read_at: string | null;
  cleared_at: string | null;
  created_at: string;
};

async function getProfileId(supabase: any, userId: string): Promise<string | null> {
  const { data } = await supabase.from("profiles").select("id").eq("id", await __activeProfileId(supabase, userId)).maybeSingle();
  return data?.id ?? null;
}

export const listNotifications = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const profileId = await getProfileId(context.supabase, context.userId);
    if (!profileId) return { items: [] as NotificationRow[], profileId: null as string | null };
    const { data, error } = await context.supabase
      .from("notifications")
      .select("*")
      .eq("profile_id", profileId)
      .is("cleared_at", null)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw error;
    return { items: (data ?? []) as NotificationRow[], profileId };
  });

export const markNotificationRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    await context.supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("id", data.id);
    return { ok: true };
  });

export const markAllNotificationsRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const profileId = await getProfileId(context.supabase, context.userId);
    if (!profileId) return { ok: true };
    await context.supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("profile_id", profileId)
      .is("read_at", null);
    return { ok: true };
  });

export const clearNotification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    await context.supabase
      .from("notifications")
      .update({ cleared_at: new Date().toISOString() })
      .eq("id", data.id);
    return { ok: true };
  });

export const clearAllNotifications = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const profileId = await getProfileId(context.supabase, context.userId);
    if (!profileId) return { ok: true };
    await context.supabase
      .from("notifications")
      .update({ cleared_at: new Date().toISOString() })
      .eq("profile_id", profileId)
      .is("cleared_at", null);
    return { ok: true };
  });
