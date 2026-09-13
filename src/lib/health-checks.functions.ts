// Platform health checks: daily automated integrity scan over bookings,
// payments and emails, plus the record of safe fixes applied automatically.
// Admin-only.
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
  auto_fixed_count: number | null;
  last_auto_fixed_at: string | null;
};

export type HealthFix = {
  id: string;
  check_key: string;
  action: string;
  affected_count: number;
  succeeded: boolean;
  error_message: string | null;
  created_at: string;
};

export type HealthSettings = {
  auto_fix_enabled: boolean;
  max_rows_per_fix: number;
};

export const listHealthFindings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const [findings, fixes, settings] = await Promise.all([
      context.supabase
        .from("health_findings")
        .select(
          "id, check_key, severity, title, affected_count, sample, status, first_seen_at, last_seen_at, resolved_at, auto_fixed_count, last_auto_fixed_at",
        )
        .order("status", { ascending: true })
        .order("severity", { ascending: true })
        .order("affected_count", { ascending: false }),
      context.supabase
        .from("health_fix_log")
        .select("id, check_key, action, affected_count, succeeded, error_message, created_at")
        .order("created_at", { ascending: false })
        .limit(25),
      context.supabase
        .from("health_check_settings")
        .select("auto_fix_enabled, max_rows_per_fix")
        .eq("id", 1)
        .maybeSingle(),
    ]);
    if (findings.error) throw findings.error;
    return {
      findings: (findings.data ?? []) as HealthFinding[],
      fixes: (fixes.data ?? []) as HealthFix[],
      settings: (settings.data ?? { auto_fix_enabled: true, max_rows_per_fix: 500 }) as HealthSettings,
    };
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

export const setAutoFixEnabled = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { enabled: boolean }) => ({ enabled: Boolean(d?.enabled) }))
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    const { error } = await context.supabase
      .from("health_check_settings")
      .update({ auto_fix_enabled: data.enabled, updated_at: new Date().toISOString() })
      .eq("id", 1);
    if (error) throw error;
    return { enabled: data.enabled };
  });
