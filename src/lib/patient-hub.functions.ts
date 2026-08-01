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

const TEMPLATE_LABELS: Record<string, string> = {
  "booking-confirmation": "Booking confirmation",
  "booking-cancellation": "Booking cancelled",
  "booking-reschedule": "Appointment rescheduled",
  "appointment-reminder": "Appointment reminder",
  "rebook-reminder": "Rebook reminder",
  "topup-reminder": "Top-up reminder",
  "review-request": "Review request",
  "medical-form-request": "Medical form request",
  "consent-request": "Consent form request",
  "patient-message": "Message from clinic",
  "gift-card-delivery": "Gift card",
  "marketing-broadcast": "Marketing email",
  "admin-broadcast": "Broadcast email",
  "aftercare": "Aftercare",
  "payment-link": "Payment link",
};

export const listCommunications = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { clientId: string }) => input)
  .handler(async ({ data, context }) => {
    const pid = await getProfileId(context.supabase, context.userId);
    if (!pid) return [];

    // Verify the client belongs to this clinic before reading system email logs
    const { data: client } = await context.supabase
      .from("clinic_clients")
      .select("id, email")
      .eq("profile_id", pid)
      .eq("id", data.clientId)
      .maybeSingle();
    if (!client) return [];

    const { data: rows, error } = await context.supabase
      .from("client_communications")
      .select("*")
      .eq("profile_id", pid)
      .eq("client_id", data.clientId)
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw error;

    const manual = (rows ?? []).map((r: any) => ({ ...r, source: "manual" }));

    let system: any[] = [];
    if (client.email) {
      try {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: logs } = await supabaseAdmin
          .from("email_send_log")
          .select("id, message_id, template_name, status, error_message, created_at")
          .ilike("recipient_email", client.email)
          .order("created_at", { ascending: false })
          .limit(300);

        // Deduplicate by message_id keeping the latest row
        const seen = new Set<string>();
        system = (logs ?? [])
          .filter((l: any) => {
            const key = l.message_id ?? l.id;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
          })
          .map((l: any) => ({
            id: `email:${l.id}`,
            source: "system",
            channel: "email",
            direction: "outbound",
            status: l.status,
            subject: TEMPLATE_LABELS[l.template_name] ?? l.template_name,
            body: l.status === "dlq" || l.status === "failed" || l.status === "bounced"
              ? (l.error_message ?? "Delivery failed")
              : null,
            template_name: l.template_name,
            created_at: l.created_at,
          }));
      } catch {
        system = [];
      }
    }

    return [...manual, ...system].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );
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

// ============ SEND PATIENT EMAIL (from Modo, CC practitioner) ============

export const sendPatientEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: {
    clientId: string;
    subject: string;
    body: string;
    ccSelf?: boolean;
  }) => input)
  .handler(async ({ data, context }) => {
    const pid = await getProfileId(context.supabase, context.userId);
    if (!pid) throw new Error("No profile");

    // Load the client (scoped by profile_id via RLS)
    const { data: client, error: cErr } = await context.supabase
      .from("clinic_clients")
      .select("id, full_name, email")
      .eq("id", data.clientId)
      .eq("profile_id", pid)
      .maybeSingle();
    if (cErr) throw cErr;
    if (!client?.email) throw new Error("Patient has no email address");

    // Practitioner auth email (for reply-to and copy)
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: userInfo } = await supabaseAdmin.auth.admin.getUserById(context.userId);
    const practitionerEmail = userInfo?.user?.email || null;

    const { getPractitionerBranding, tryEnqueueAppEmail } = await import("@/lib/email/send.server");
    const branding = await getPractitionerBranding(pid);

    const subject = data.subject.trim();
    const body = data.body;
    if (!subject || !body.trim()) throw new Error("Subject and message required");

    const baseId = crypto.randomUUID();

    // 1) Send to patient — from Modo, reply-to practitioner
    await tryEnqueueAppEmail({
      templateName: "patient-message",
      recipientEmail: client.email,
      messageId: `${baseId}-patient`,
      replyTo: practitionerEmail || undefined,
      templateData: {
        subject,
        body,
        clinicName: branding.clinicName,
        logoUrl: branding.logoUrl,
        brandColor: branding.brandColor,
      },
    });

    // 2) Copy to practitioner
    if (data.ccSelf !== false && practitionerEmail) {
      await tryEnqueueAppEmail({
        templateName: "patient-message",
        recipientEmail: practitionerEmail,
        messageId: `${baseId}-copy`,
        templateData: {
          subject: `[Copy] ${subject}`,
          body,
          clinicName: branding.clinicName,
          logoUrl: branding.logoUrl,
          brandColor: branding.brandColor,
          copyNotice: `Copy of the email sent to ${client.full_name} <${client.email}>.`,
        },
      });
    }

    // 3) Log to communications
    await context.supabase.from("client_communications").insert({
      profile_id: pid,
      client_id: client.id,
      channel: "email",
      direction: "outbound",
      subject,
      body,
      meta: { cc_practitioner: !!practitionerEmail && data.ccSelf !== false, sent_via: "modo" },
      status: "sent",
    });

    return { ok: true };
  });

