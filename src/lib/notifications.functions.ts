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

export type NotificationPageRow = NotificationRow & { resolved_link: string | null };

export const listNotificationsPage = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { limit?: number; offset?: number; unreadOnly?: boolean; type?: string | null } | undefined) => d ?? {})
  .handler(async ({ data, context }) => {
    const limit = Math.min(Math.max(data.limit ?? 30, 1), 100);
    const offset = Math.max(data.offset ?? 0, 0);
    const profileId = await getProfileId(context.supabase, context.userId);
    if (!profileId) return { items: [] as NotificationPageRow[], hasMore: false, unreadCount: 0 };

    let q = context.supabase
      .from("notifications")
      .select("*")
      .eq("profile_id", profileId)
      .is("cleared_at", null);
    if (data.unreadOnly) q = q.is("read_at", null);
    if (data.type) q = q.eq("type", data.type);

    const { data: rows, error } = await q
      .order("created_at", { ascending: false })
      .range(offset, offset + limit);
    if (error) throw error;

    const list = (rows ?? []) as NotificationRow[];
    const hasMore = list.length > limit;
    const page = hasMore ? list.slice(0, limit) : list;

    // Resolve patient-record deep links for form / consent notifications
    const consentIds = page.filter((n) => n.entity_type === "consent" && n.entity_id).map((n) => n.entity_id!);
    const formIds = page.filter((n) => n.entity_type === "medical_form" && n.entity_id).map((n) => n.entity_id!);
    const clientByEntity = new Map<string, string>();

    if (consentIds.length) {
      const { data: rowsC } = await context.supabase
        .from("appointment_consents")
        .select("id, client_id")
        .in("id", consentIds);
      for (const r of rowsC ?? []) if (r.client_id) clientByEntity.set(r.id, r.client_id);
    }
    if (formIds.length) {
      const { data: rowsF } = await context.supabase
        .from("appointment_medical_forms")
        .select("id, client_id")
        .in("id", formIds);
      for (const r of rowsF ?? []) if (r.client_id) clientByEntity.set(r.id, r.client_id);
    }

    const items: NotificationPageRow[] = page.map((n) => {
      const clientId = n.entity_id ? clientByEntity.get(n.entity_id) : undefined;
      return {
        ...n,
        resolved_link: clientId ? `/dashboard/patients/${clientId}/details` : n.link,
      };
    });

    const { count } = await context.supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("profile_id", profileId)
      .is("cleared_at", null)
      .is("read_at", null);

    return { items, hasMore, unreadCount: count ?? 0 };
  });
