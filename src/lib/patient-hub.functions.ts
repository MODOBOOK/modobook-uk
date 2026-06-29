import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function getProfileId(supabase: any, userId: string) {
  const { data } = await supabase.from("profiles").select("id").eq("user_id", userId).maybeSingle();
  return data?.id ?? null;
}

// ============ CONCERNS ============

export const listConcerns = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { clientId: string }) => input)
  .handler(async ({ data, context }) => {
    const pid = await getProfileId(context.supabase, context.userId);
    if (!pid) return [];
    const { data: rows, error } = await context.supabase
      .from("client_concerns")
      .select("*")
      .eq("profile_id", pid)
      .eq("client_id", data.clientId)
      .order("resolved", { ascending: true })
      .order("created_at", { ascending: false });
    if (error) throw error;
    return rows ?? [];
  });

export const upsertConcern = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: {
    id?: string;
    clientId: string;
    label: string;
    severity?: "low" | "medium" | "high";
    resolved?: boolean;
    notes?: string | null;
    source?: "manual" | "predefined" | "medical_form";
  }) => input)
  .handler(async ({ data, context }) => {
    const pid = await getProfileId(context.supabase, context.userId);
    if (!pid) throw new Error("No profile");
    const row = {
      id: data.id,
      profile_id: pid,
      client_id: data.clientId,
      label: data.label.trim(),
      severity: data.severity ?? "medium",
      resolved: data.resolved ?? false,
      notes: data.notes ?? null,
      source: data.source ?? "manual",
    };
    const { data: saved, error } = await context.supabase
      .from("client_concerns")
      .upsert(row)
      .select()
      .single();
    if (error) throw error;
    return saved;
  });

export const deleteConcern = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data, context }) => {
    const pid = await getProfileId(context.supabase, context.userId);
    if (!pid) throw new Error("No profile");
    const { error } = await context.supabase
      .from("client_concerns").delete().eq("id", data.id).eq("profile_id", pid);
    if (error) throw error;
    return { ok: true };
  });

// ============ COMMUNICATIONS LOG ============

export const listCommunications = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { clientId: string }) => input)
  .handler(async ({ data, context }) => {
    const pid = await getProfileId(context.supabase, context.userId);
    if (!pid) return [];
    const { data: rows, error } = await context.supabase
      .from("client_communications")
      .select("*")
      .eq("profile_id", pid)
      .eq("client_id", data.clientId)
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw error;
    return rows ?? [];
  });

export const logCommunication = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: {
    clientId: string;
    channel: "email" | "sms" | "whatsapp" | "note" | "payment_link" | "form" | "consent";
    direction?: "outbound" | "inbound";
    subject?: string | null;
    body?: string | null;
    meta?: Record<string, any>;
    status?: string;
  }) => input)
  .handler(async ({ data, context }) => {
    const pid = await getProfileId(context.supabase, context.userId);
    if (!pid) throw new Error("No profile");
    const { data: saved, error } = await context.supabase
      .from("client_communications")
      .insert({
        profile_id: pid,
        client_id: data.clientId,
        channel: data.channel,
        direction: data.direction ?? "outbound",
        subject: data.subject ?? null,
        body: data.body ?? null,
        meta: data.meta ?? {},
        status: data.status ?? "sent",
      })
      .select()
      .single();
    if (error) throw error;
    return saved;
  });

// ============ EMAIL TEMPLATES ============

export const listEmailTemplates = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const pid = await getProfileId(context.supabase, context.userId);
    if (!pid) return [];
    const { data, error } = await context.supabase
      .from("email_templates").select("*").eq("profile_id", pid).order("sort_order");
    if (error) throw error;
    return data ?? [];
  });

export const upsertEmailTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: {
    id?: string;
    name: string;
    subject: string;
    body_html: string;
    sort_order?: number;
  }) => input)
  .handler(async ({ data, context }) => {
    const pid = await getProfileId(context.supabase, context.userId);
    if (!pid) throw new Error("No profile");
    const { data: saved, error } = await context.supabase
      .from("email_templates")
      .upsert({
        id: data.id,
        profile_id: pid,
        name: data.name.trim(),
        subject: data.subject.trim(),
        body_html: data.body_html,
        sort_order: data.sort_order ?? 0,
      })
      .select()
      .single();
    if (error) throw error;
    return saved;
  });

export const deleteEmailTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data, context }) => {
    const pid = await getProfileId(context.supabase, context.userId);
    if (!pid) throw new Error("No profile");
    const { error } = await context.supabase
      .from("email_templates").delete().eq("id", data.id).eq("profile_id", pid);
    if (error) throw error;
    return { ok: true };
  });
