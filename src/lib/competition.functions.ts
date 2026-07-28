// Hidden competition entry form (TLAs pop-up) + admin listing.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export const COMPETITION_CONSENT_TEXT =
  "I confirm my entry details are correct, I'm 18 or over, and I agree that MODO Book may store and use my details to run this competition and contact me about the result. I've read and accept the competition terms.";

const schema = z.object({
  fullName: z.string().trim().min(2).max(120),
  clinicName: z.string().trim().min(1).max(160),
  instagram: z.string().trim().max(120).optional().nullable(),
  email: z.string().trim().toLowerCase().email().max(255),
  phone: z.string().trim().max(40).optional().nullable(),
  notes: z.string().trim().max(1000).optional().nullable(),
  consent: z.boolean(),
  marketingOptIn: z.boolean().optional(),
});

export const enterCompetition = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => schema.parse(input))
  .handler(async ({ data }) => {
    if (!data.consent) {
      return { ok: false as const, error: "Please tick the consent box to enter." };
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const insta = (data.instagram ?? "").trim().replace(/^@+/, "");

    const { error } = await supabaseAdmin.from("competition_entries").insert({
      campaign: "tla-popup",
      full_name: data.fullName,
      clinic_name: data.clinicName,
      instagram: insta ? `@${insta}` : null,
      email: data.email,
      phone: data.phone?.trim() || null,
      notes: data.notes?.trim() || null,
      consent_at: new Date().toISOString(),
      consent_text: COMPETITION_CONSENT_TEXT,
      marketing_opt_in: !!data.marketingOptIn,
    });

    if (error) {
      if ((error as any).code === "23505") {
        return { ok: true as const, duplicate: true as const };
      }
      console.error("[competition] insert failed", error);
      return { ok: false as const, error: "Could not save your entry. Please try again." };
    }

    return { ok: true as const, duplicate: false as const };
  });

export const adminListCompetitionEntries = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isAdmin, error: roleErr } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (roleErr) throw roleErr;
    if (!isAdmin) throw new Error("Forbidden");

    const { data, error } = await context.supabase
      .from("competition_entries")
      .select("*")
      .eq("campaign", "tla-popup")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []) as Array<{
      id: string;
      full_name: string;
      clinic_name: string;
      instagram: string | null;
      email: string;
      phone: string | null;
      notes: string | null;
      marketing_opt_in: boolean;
      status: string;
      created_at: string;
    }>;
  });
