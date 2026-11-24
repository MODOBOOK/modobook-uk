import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export const Route = createFileRoute("/api/public/hooks/aftercare-dispatch")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!(await (await import('@/lib/cron-auth.server')).isAuthorizedCron(request))) {
          return new Response('Unauthorized', { status: 401 })
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

        const now = new Date();
        // Never email historic patients: anything due more than 48h ago is retired.
        const staleBefore = new Date(now.getTime() - 48 * 60 * 60 * 1000).toISOString();
        const { count: expired } = await supabase
          .from("appointment_aftercare")
          .update({ status: "expired", updated_at: now.toISOString() } as never, { count: "exact" })
          .eq("status", "scheduled")
          .lt("send_at", staleBefore);

        const { data: rows, error } = await supabase
          .from("appointment_aftercare")
          .select("id, appointment_id, profile_id, body_html, recipient_email, send_at")
          .eq("status", "scheduled")
          .lte("send_at", now.toISOString())
          .gte("send_at", staleBefore)
          .order("send_at", { ascending: true })
          .limit(100);

        if (error) {
          console.error("[aftercare-dispatch] fetch failed", error);
          return new Response(JSON.stringify({ ok: false, error: 'internal error' }), { status: 500 });
        }

        const { tryEnqueueAppEmail, getPractitionerBranding } = await import("@/lib/email/send.server");
        let sent = 0;
        let skipped = 0;

        for (const row of (rows ?? []) as any[]) {
          const mark = (status: string, extra: Record<string, unknown> = {}) =>
            supabase.from("appointment_aftercare")
              .update({ status, updated_at: new Date().toISOString(), ...extra } as never)
              .eq("id", row.id).eq("status", "scheduled");
          try {
            const { data: appt } = await supabase
              .from("appointments")
              .select("id, patient_name, patient_email, profile_id, status, aftercare_sent_at")
              .eq("id", row.appointment_id)
              .maybeSingle();
            const a = appt as any;
            if (!a || a.status === "cancelled" || a.status === "no_show") { await mark("cancelled"); skipped++; continue; }
            if (a.aftercare_sent_at) { await mark("sent", { sent_at: a.aftercare_sent_at }); skipped++; continue; }
            const email = row.recipient_email || a.patient_email;
            if (!email || !row.body_html) { await mark("skipped"); skipped++; continue; }

            const profileId = a.profile_id ?? row.profile_id;
            const branding = await getPractitionerBranding(profileId);
            const firstName = (a.patient_name ?? "").split(" ")[0] || "there";
            await tryEnqueueAppEmail({
              templateName: "patient-message",
              recipientEmail: email,
              messageId: `aftercare-${a.id}`,
              templateData: {
                profileId,
                patientName: a.patient_name,
                clinicName: branding.clinicName,
                subject: `Aftercare instructions from ${branding.clinicName}`,
                body: `Hi ${firstName},\n\nThank you for visiting ${branding.clinicName}.\n\n${row.body_html}\n\nIf you have any questions, please contact your practitioner.`,
                logoUrl: branding.logoUrl,
                brandColor: branding.brandColor,
              },
            });
            const at = new Date().toISOString();
            await mark("sent", { sent_at: at, sent_via: { email: true } });
            await supabase.from("appointments").update({ aftercare_sent_at: at } as never).eq("id", a.id);
            sent++;
          } catch (e) {
            console.error(`[aftercare-dispatch] failed for ${row.id}`, e);
            skipped++;
          }
        }

        return new Response(JSON.stringify({ ok: true, sent, skipped, expired: expired ?? 0, checked: (rows ?? []).length }), { status: 200 });
      },
    },
  },
});
