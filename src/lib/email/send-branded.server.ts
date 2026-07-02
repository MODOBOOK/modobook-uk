// Server-only helper that renders a registered React Email template and
// enqueues it via the transactional_emails queue with practitioner branding
// and Reply-To set to the practitioner's contact email.
//
// Used by internal auto-triggers (Stripe webhook, checkout confirm, manual
// appointment creation). The authenticated HTTP send route in
// src/routes/lovable/email/transactional/send.ts wraps the same enqueue
// primitive for user-composed messages.

import * as React from "react";
import { render } from "react-email";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { TEMPLATES } from "@/lib/email-templates/registry";
import type { BrandContext } from "@/lib/email-templates/_branded-shell";

const SITE_NAME = "modobook-uk";
const SENDER_DOMAIN = "notify.modobook.co.uk";
const FROM_DOMAIN = "modobook.co.uk";

function generateToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function ensureUnsubscribeToken(email: string): Promise<string | null> {
  const normalized = email.toLowerCase();
  const { data: existing } = await supabaseAdmin
    .from("email_unsubscribe_tokens")
    .select("token, used_at")
    .eq("email", normalized)
    .maybeSingle();
  if (existing && !existing.used_at) return existing.token;
  if (existing && existing.used_at) return null; // treat as suppressed
  const token = generateToken();
  await supabaseAdmin
    .from("email_unsubscribe_tokens")
    .upsert({ token, email: normalized } as never, { onConflict: "email", ignoreDuplicates: true });
  const { data: stored } = await supabaseAdmin
    .from("email_unsubscribe_tokens")
    .select("token")
    .eq("email", normalized)
    .maybeSingle();
  return stored?.token ?? null;
}

export type SendBrandedOptions = {
  templateName: string;
  recipientEmail: string;
  templateData: Record<string, unknown>;
  fromName?: string; // e.g. "Ryan's Clinic via MODO"
  replyTo?: string;
  idempotencyKey?: string;
};

export async function sendBrandedEmail(opts: SendBrandedOptions): Promise<{ ok: boolean; reason?: string }> {
  const template = TEMPLATES[opts.templateName];
  if (!template) return { ok: false, reason: "template_not_found" };
  const recipient = (template.to || opts.recipientEmail || "").trim();
  if (!recipient || !recipient.includes("@")) return { ok: false, reason: "no_recipient" };

  // Suppression check
  const { data: suppressed } = await supabaseAdmin
    .from("suppressed_emails")
    .select("id")
    .eq("email", recipient.toLowerCase())
    .maybeSingle();
  if (suppressed) return { ok: false, reason: "suppressed" };

  const unsubscribeToken = await ensureUnsubscribeToken(recipient);
  if (!unsubscribeToken) return { ok: false, reason: "suppressed" };

  const messageId = crypto.randomUUID();
  const idempotencyKey = opts.idempotencyKey || messageId;

  // Idempotency guard: if we've already enqueued the same key recently, skip.
  const { data: dup } = await supabaseAdmin
    .from("email_send_log")
    .select("id")
    .eq("message_id", idempotencyKey)
    .maybeSingle();
  if (dup) return { ok: true, reason: "already_sent" };

  const element = React.createElement(template.component, opts.templateData);
  const html = await render(element);
  const text = await render(element, { plainText: true });
  const subject =
    typeof template.subject === "function" ? template.subject(opts.templateData) : template.subject;

  await supabaseAdmin.from("email_send_log").insert({
    message_id: idempotencyKey,
    template_name: opts.templateName,
    recipient_email: recipient,
    status: "pending",
  } as never);

  const fromDisplayName = (opts.fromName || SITE_NAME).replace(/[<>"\r\n]/g, "");

  const { error } = await supabaseAdmin.rpc("enqueue_email", {
    queue_name: "transactional_emails",
    payload: {
      message_id: messageId,
      to: recipient,
      from: `${fromDisplayName} <info@${FROM_DOMAIN}>`,
      reply_to: opts.replyTo || undefined,
      sender_domain: SENDER_DOMAIN,
      subject,
      html,
      text,
      purpose: "transactional",
      label: opts.templateName,
      idempotency_key: idempotencyKey,
      unsubscribe_token: unsubscribeToken,
      queued_at: new Date().toISOString(),
    },
  } as never);

  if (error) {
    console.error("[sendBrandedEmail] enqueue failed", error);
    await supabaseAdmin.from("email_send_log").insert({
      message_id: `${idempotencyKey}-err`,
      template_name: opts.templateName,
      recipient_email: recipient,
      status: "failed",
      error_message: error.message,
    } as never);
    return { ok: false, reason: "enqueue_failed" };
  }
  return { ok: true };
}

// ---------- Booking notifications ----------

function formatDateLabel(iso: string | null | undefined): string {
  if (!iso) return "";
  try {
    const d = new Date(`${iso}T00:00:00`);
    return d.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  } catch {
    return iso;
  }
}

function formatTimeLabel(t: string | null | undefined): string {
  if (!t) return "";
  // t is "HH:MM:SS" or "HH:MM"
  const [h, m] = t.split(":");
  if (h == null || m == null) return t;
  const hour = Number(h);
  const min = Number(m);
  const ampm = hour >= 12 ? "pm" : "am";
  const h12 = ((hour + 11) % 12) + 1;
  return `${h12}:${String(min).padStart(2, "0")} ${ampm}`;
}

function formatMoney(cents: number | null | undefined): string {
  const n = Math.max(0, Number(cents || 0));
  return `£${(n / 100).toFixed(n % 100 === 0 ? 0 : 2)}`;
}

async function loadBrandForProfile(profileId: string): Promise<{
  brand: BrandContext;
  practitionerEmail: string | null;
  slug: string | null;
  clinicName: string;
} | null> {
  const [{ data: profile }, { data: theme }] = await Promise.all([
    supabaseAdmin
      .from("profiles")
      .select("id, email, slug, clinic_name, full_name, brand_color")
      .eq("id", profileId)
      .maybeSingle(),
    supabaseAdmin
      .from("clinic_theme")
      .select("logo_url, accent_color, primary_color, button_color, button_text_color, text_color, background_color")
      .eq("profile_id", profileId)
      .maybeSingle(),
  ]);
  if (!profile) return null;
  const p = profile as Record<string, unknown>;
  const t = (theme || {}) as Record<string, unknown>;
  const clinicName =
    (p.clinic_name as string) || (p.full_name as string) || "Your practitioner";
  const slug = (p.slug as string) || null;
  const brand: BrandContext = {
    clinicName,
    logoUrl: (t.logo_url as string) || null,
    accentColor: (t.accent_color as string) || (t.primary_color as string) || (p.brand_color as string) || null,
    buttonColor: (t.button_color as string) || null,
    buttonTextColor: (t.button_text_color as string) || null,
    textColor: (t.text_color as string) || null,
    bgColor: null,
    websiteUrl: slug ? `https://modobook.uk/${slug}` : null,
    practitionerEmail: (p.email as string) || null,
  };
  return { brand, practitionerEmail: (p.email as string) || null, slug, clinicName };
}

export async function sendBookingNotifications(appointmentId: string): Promise<void> {
  try {
    const { data: appt } = await supabaseAdmin
      .from("appointments")
      .select(
        "id, profile_id, patient_name, patient_email, patient_phone, scheduled_date, start_time, treatment_id, treatment_name_snapshot, location_id, amount_paid_cents, total_amount, manage_token",
      )
      .eq("id", appointmentId)
      .maybeSingle();
    if (!appt) return;
    const a = appt as Record<string, any>;

    const branding = await loadBrandForProfile(a.profile_id);
    if (!branding) return;

    // Resolve treatment name if snapshot missing
    let treatmentName: string = a.treatment_name_snapshot || "";
    if (!treatmentName && a.treatment_id) {
      const { data: tr } = await supabaseAdmin
        .from("treatments")
        .select("name")
        .eq("id", a.treatment_id)
        .maybeSingle();
      treatmentName = (tr as { name?: string } | null)?.name || "Your appointment";
    }
    if (!treatmentName) treatmentName = "Your appointment";

    let locationName: string | null = null;
    let locationAddress: string | null = null;
    if (a.location_id) {
      const { data: loc } = await supabaseAdmin
        .from("locations")
        .select("name, address_line1, city, postcode")
        .eq("id", a.location_id)
        .maybeSingle();
      const l = loc as Record<string, string> | null;
      if (l) {
        locationName = l.name || null;
        locationAddress =
          [l.address_line1, l.city, l.postcode].filter(Boolean).join(", ") || null;
      }
    }

    const dateLabel = formatDateLabel(a.scheduled_date);
    const timeLabel = formatTimeLabel(a.start_time);
    const totalCents = Math.round(Number(a.total_amount || 0) * 100);
    const paidCents = Number(a.amount_paid_cents || 0);
    const outstandingCents = Math.max(0, totalCents - paidCents);

    const manageUrl =
      a.manage_token && branding.slug
        ? `https://modobook.uk/f/${a.manage_token}`
        : null;

    const fromName = `${branding.clinicName} via MODO`;
    const replyTo = branding.practitionerEmail || undefined;

    // 1. Patient confirmation
    if (a.patient_email) {
      const firstName = String(a.patient_name || "").trim().split(/\s+/)[0] || "";
      await sendBrandedEmail({
        templateName: "booking-confirmed-patient",
        recipientEmail: a.patient_email,
        fromName,
        replyTo,
        idempotencyKey: `appt-patient-${appointmentId}`,
        templateData: {
          brand: branding.brand,
          patientFirstName: firstName,
          treatmentName,
          dateLabel,
          timeLabel,
          locationName,
          locationAddress,
          amountPaidLabel: paidCents > 0 ? formatMoney(paidCents) : null,
          outstandingLabel: outstandingCents > 0 ? formatMoney(outstandingCents) : null,
          manageUrl,
        },
      });
    }

    // 2. Practitioner alert
    if (branding.practitionerEmail) {
      await sendBrandedEmail({
        templateName: "booking-alert-practitioner",
        recipientEmail: branding.practitionerEmail,
        fromName: "MODO Bookings",
        replyTo: a.patient_email || undefined,
        idempotencyKey: `appt-prac-${appointmentId}`,
        templateData: {
          brand: branding.brand,
          practitionerFirstName: null,
          patientName: a.patient_name || "New patient",
          patientEmail: a.patient_email,
          patientPhone: a.patient_phone,
          treatmentName,
          dateLabel,
          timeLabel,
          locationName,
          amountPaidLabel: paidCents > 0 ? formatMoney(paidCents) : null,
          totalLabel: totalCents > 0 ? formatMoney(totalCents) : null,
          dashboardUrl: "https://modobook.uk/dashboard",
        },
      });
    }
  } catch (e) {
    console.error("[sendBookingNotifications] failed", e);
  }
}
