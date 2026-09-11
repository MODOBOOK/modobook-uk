import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export const Route = createFileRoute("/api/public/hooks/aftercare-dispatch")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apikey = request.headers.get("apikey");
        const expected = process.env.SUPABASE_PUBLISHABLE_KEY;
        if (!apikey || apikey !== expected) {
          return new Response("Unauthorized", { status: 401 });
        }

        const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
        const supabase = createClient<Database>(process.env.SUPABASE_URL!, key, {
          auth: { persistSession: false },
          global: {
            fetch: (input, init) => {
              const h = new Headers(init?.headers);
              if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization");
              h.set("apikey", key);
              return fetch(input, { ...init, headers: h });
            },
          },
        });

        const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
        const { data: appts, error } = await supabase
          .from("appointments")
          .select("id, patient_name, patient_email, patient_phone, aftercare_html, aftercare_sent_at, checked_out_at, scheduled_date, start_time, end_time, profile_id, status")
          .lte("end_time", twoHoursAgo)
          .not("aftercare_html", "is", null)
          .is("aftercare_sent_at", null)
          .is("checked_out_at", null)
          .not("status", "in", "(cancelled,no_show)");

        if (error) {
          console.error("[aftercare-dispatch] fetch failed", error);
          return new Response(JSON.stringify({ ok: false, error: error.message }), { status: 500 });
        }

        const { tryEnqueueAppEmail, getPractitionerBranding } = await import("@/lib/email/send.server");
        let sent = 0;
        let skipped = 0;

        for (const raw of (appts ?? []) as any[]) {
          if (!raw.patient_email || !raw.aftercare_html) {
            skipped++;
            continue;
          }
          try {
            const branding = await getPractitionerBranding(raw.profile_id);
            const firstName = (raw.patient_name ?? "").split(" ")[0] || "there";
            await tryEnqueueAppEmail({
              templateName: "patient-message",
              recipientEmail: raw.patient_email,
              messageId: `aftercare-${raw.id}`,
              templateData: {
                profileId: raw.profile_id,
                patientName: raw.patient_name,
                clinicName: branding.clinicName,
                subject: `Aftercare instructions from ${branding.clinicName}`,
                body: `Hi ${firstName},\n\nThank you for visiting ${branding.clinicName}.\n\n${raw.aftercare_html}\n\nIf you have any questions, please contact your practitioner.`,
                logoUrl: branding.logoUrl,
                brandColor: branding.brandColor,
              },
            });
            await supabase
              .from("appointments")
              .update({ aftercare_sent_at: new Date().toISOString() } as never)
              .eq("id", raw.id);
            sent++;
          } catch (e) {
            console.error(`[aftercare-dispatch] failed for ${raw.id}`, e);
            skipped++;
          }
        }

        return new Response(JSON.stringify({ ok: true, sent, skipped, checked: (appts ?? []).length }), { status: 200 });
      },
    },
  },
});
