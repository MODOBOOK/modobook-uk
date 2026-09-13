// Platform health checks: daily automated integrity scan over bookings,
// payments and emails. Admin-only.
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

export type HealthFinding = {
  id: string;
  check_key: string;
  severity: string;
  title: string;
  affected_count: number;
  sample: any;
  status: string;
  first_seen_at: string;
  last_seen_at: string;
  resolved_at: string | null;
};

export const listHealthFindings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { data, error } = await context.supabase
      .from("health_findings")
      .select(
        "id, check_key, severity, title, affected_count, sample, status, first_seen_at, last_seen_at, resolved_at",
      )
      .order("status", { ascending: true })
      .order("severity", { ascending: true })
      .order("affected_count", { ascending: false });
    if (error) throw error;
    return (data ?? []) as HealthFinding[];
  });

export const runHealthChecksNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin.rpc("run_health_checks");
    if (error) throw error;
    return { issues: (data as number) ?? 0 };
  });
