import { createFileRoute } from "@tanstack/react-router";
import { buildPushPayload } from "@block65/webcrypto-web-push";

export const Route = createFileRoute("/api/public/push/dispatch")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env.PUSH_DISPATCH_SECRET;
        if (!secret) return new Response("Not configured", { status: 500 });
        const provided = request.headers.get("x-push-secret") ?? "";
        // Constant-time compare
        if (provided.length !== secret.length) return new Response("Unauthorized", { status: 401 });
        let diff = 0;
        for (let i = 0; i < secret.length; i++) diff |= secret.charCodeAt(i) ^ provided.charCodeAt(i);
        if (diff !== 0) return new Response("Unauthorized", { status: 401 });

        let body: { notification_id?: string } = {};
        try {
          body = (await request.json()) as { notification_id?: string };
        } catch {
          return new Response("Bad request", { status: 400 });
        }
        if (!body.notification_id) return new Response("Missing notification_id", { status: 400 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const admin = supabaseAdmin as unknown as {
          from: (t: string) => {
            select: (cols: string) => {
              eq: (c: string, v: string) => {
                maybeSingle: () => Promise<{ data: Record<string, unknown> | null; error: unknown }>;
              } & Promise<{ data: Array<Record<string, unknown>> | null; error: unknown }>;
            };
            delete: () => { eq: (c: string, v: string) => Promise<unknown> };
          };
        };

        const noteRes = await admin
          .from("notifications")
          .select("id, profile_id, type, title, body, emoji, link")
          .eq("id", body.notification_id)
          .maybeSingle();
        const note = noteRes.data as
          | { id: string; profile_id: string; type: string; title: string; body: string | null; emoji: string | null; link: string | null }
          | null;
        if (!note) return new Response("ok", { status: 200 });

        const profRes = await admin
          .from("profiles")
          .select("user_id")
          .eq("id", note.profile_id)
          .maybeSingle();
        const prof = profRes.data as { user_id: string } | null;
        if (!prof?.user_id) return new Response("ok", { status: 200 });

        const subsRes = await admin
          .from("push_subscriptions")
          .select("id, endpoint, p256dh, auth")
          .eq("user_id", prof.user_id);
        const subs = (subsRes.data ?? []) as Array<{ id: string; endpoint: string; p256dh: string; auth: string }>;
        if (subs.length === 0) return new Response("ok", { status: 200 });

        const vapid = {
          subject: process.env.VAPID_SUBJECT || "mailto:info@modobook.co.uk",
          publicKey: process.env.VAPID_PUBLIC_KEY!,
          privateKey: process.env.VAPID_PRIVATE_KEY!,
        };

        const payloadData = JSON.stringify({
          title: `${note.emoji ? note.emoji + " " : ""}${note.title}`,
          body: note.body ?? "",
          url: note.link ?? "/dashboard",
          tag: note.type || undefined,
          icon: "/icon-192.png",
          badge: "/icon-192.png",
        });

        const message = { data: payloadData, options: { ttl: 60 * 60 * 24 } };

        await Promise.allSettled(
          subs.map(async (s) => {
            const subscription = {
              endpoint: s.endpoint,
              expirationTime: null,
              keys: { p256dh: s.p256dh, auth: s.auth },
            };
            try {
              const req = await buildPushPayload(message, subscription, vapid);
              const res = await fetch(subscription.endpoint, {
                ...req,
                body: req.body as unknown as BodyInit,
              });
              if (res.status === 404 || res.status === 410) {
                await admin.from("push_subscriptions").delete().eq("id", s.id);
              }
            } catch {
              // ignore individual failures
            }
          }),
        );

        return new Response("ok", { status: 200 });
      },
    },
  },
});
