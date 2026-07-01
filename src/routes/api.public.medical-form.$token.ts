import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export const Route = createFileRoute("/api/public/medical-form/$token")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const token = tokenFromRequest(request);
        if (!token) return json({ error: "Missing form token" }, 400);

        const sb = publicClient();
        const { data: rows, error } = await sb.rpc("get_medical_form_by_token", { p_token: token });
        if (error) return json({ error: "Form could not be loaded" }, 500);

        const form = Array.isArray(rows) ? rows[0] : rows;
        if (form) return json({ form });

        const { data: slug } = await sb.rpc("get_clinic_slug_for_form_token", { p_token: token });
        return json({ form: null, fallbackSlug: slug ?? null }, 404);
      },
      POST: async ({ request }) => {
        const token = tokenFromRequest(request);
        if (!token) return json({ error: "Missing form token" }, 400);

        let body: { response?: unknown } = {};
        try {
          body = await request.json();
        } catch {
          return json({ error: "Invalid form submission" }, 400);
        }

        const sb = publicClient();
        const { data: ok, error } = await sb.rpc("submit_medical_form", {
          p_token: token,
          p_response: (body.response ?? {}) as never,
        });
        if (error) return json({ error: "Form could not be submitted" }, 500);
        return json({ ok: !!ok });
      },
    },
  },
});

function publicClient() {
  return createClient<Database>(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
  );
}

function tokenFromRequest(request: Request) {
  const url = new URL(request.url);
  return decodeURIComponent(url.pathname.split("/").filter(Boolean).pop() ?? "");
}

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}