import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function activeClinicProfileId(supabase: any, userId: string) {
  const { activeProfileId } = await import("./clinic-context.server");
  return (await activeProfileId(supabase, userId)) as string | null;
}

type LedgerRow = {
  id: string;
  delta_pennies: number;
  reason: string | null;
  note: string | null;
  created_at: string;
};

const ClientSchema = z.object({ clientId: z.string().uuid() });

/** Practitioner: current account credit for one of the clinic's patients. */
export const getClientCredit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: z.infer<typeof ClientSchema>) => ClientSchema.parse(data))
  .handler(async ({ data, context }) => {
    const clinicProfileId = await activeClinicProfileId(context.supabase, context.userId);
    if (!clinicProfileId) return { linked: false as const, balanceCents: 0, entries: [] as LedgerRow[] };

    // Ownership: the client record must belong to this clinic.
    const { data: client } = await context.supabase
      .from("clinic_clients")
      .select("id")
      .eq("id", data.clientId)
      .eq("profile_id", clinicProfileId)
      .maybeSingle();
    if (!client) return { linked: false as const, balanceCents: 0, entries: [] as LedgerRow[] };

    const { data: account } = await context.supabase
      .from("patient_accounts")
      .select("user_id")
      .eq("client_id", data.clientId)
      .maybeSingle();
    if (!account?.user_id) {
      return { linked: false as const, balanceCents: 0, entries: [] as LedgerRow[] };
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows } = await supabaseAdmin
      .from("patient_credit_ledger")
      .select("id, delta_pennies, reason, note, created_at")
      .eq("clinic_profile_id", clinicProfileId)
      .eq("patient_user_id", account.user_id)
      .order("created_at", { ascending: false })
      .limit(50);

    const entries = (rows ?? []) as LedgerRow[];
    const balanceCents = entries.reduce((s, r) => s + Number(r.delta_pennies ?? 0), 0);
    return { linked: true as const, balanceCents, entries };
  });

const AdjustSchema = z.object({
  clientId: z.string().uuid(),
  deltaCents: z.number().int().min(-1_000_000).max(1_000_000),
  note: z.string().trim().max(200).optional(),
});

/** Practitioner: add or deduct account credit for one of the clinic's patients. */
export const adjustClientCredit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: z.infer<typeof AdjustSchema>) => AdjustSchema.parse(data))
  .handler(async ({ data, context }) => {
    if (!data.deltaCents) return { ok: false as const, reason: "zero" };
    const clinicProfileId = await activeClinicProfileId(context.supabase, context.userId);
    if (!clinicProfileId) throw new Error("Not authorised");

    const { data: client } = await context.supabase
      .from("clinic_clients")
      .select("id")
      .eq("id", data.clientId)
      .eq("profile_id", clinicProfileId)
      .maybeSingle();
    if (!client) throw new Error("Not authorised");

    const { data: account } = await context.supabase
      .from("patient_accounts")
      .select("user_id")
      .eq("client_id", data.clientId)
      .maybeSingle();
    if (!account?.user_id) return { ok: false as const, reason: "not_linked" };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    if (data.deltaCents < 0) {
      const { data: all } = await supabaseAdmin
        .from("patient_credit_ledger")
        .select("delta_pennies")
        .eq("clinic_profile_id", clinicProfileId)
        .eq("patient_user_id", account.user_id);
      const balance = (all ?? []).reduce(
        (s: number, r: { delta_pennies: number }) => s + Number(r.delta_pennies ?? 0),
        0,
      );
      if (balance + data.deltaCents < 0) return { ok: false as const, reason: "insufficient", balance };
    }

    const { error } = await supabaseAdmin.from("patient_credit_ledger").insert({
      patient_user_id: account.user_id,
      clinic_profile_id: clinicProfileId,
      delta_pennies: data.deltaCents,
      reason: "clinic_adjustment",
      note: data.note || (data.deltaCents > 0 ? "Added by clinic" : "Deducted by clinic"),
    } as never);
    if (error) throw error;
    return { ok: true as const };
  });

/** Patient: their credit balance with one clinic. */
export const getMyClinicCredit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { slug: string }) => data)
  .handler(async ({ data, context }) => {
    const { data: profile } = await context.supabase
      .from("profiles")
      .select("id")
      .eq("slug", data.slug)
      .maybeSingle();
    if (!profile) return { balanceCents: 0, entries: [] as LedgerRow[] };

    const { data: rows } = await context.supabase
      .from("patient_credit_ledger")
      .select("id, delta_pennies, reason, note, created_at")
      .eq("clinic_profile_id", (profile as { id: string }).id)
      .eq("patient_user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(50);

    const entries = (rows ?? []) as LedgerRow[];
    return {
      balanceCents: entries.reduce((s, r) => s + Number(r.delta_pennies ?? 0), 0),
      entries,
    };
  });
