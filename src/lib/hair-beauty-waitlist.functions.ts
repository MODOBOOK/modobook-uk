// Private hair & beauty waitlist (link-only signup) + admin listing.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export const CLINIC_TYPES = [
  { value: "hair", label: "Hair salon" },
  { value: "beauty", label: "Beauty salon" },
  { value: "multi", label: "Multi-service (hair & beauty)" },
] as const;

const schema = z.object({
  fullName: z.string().trim().min(2).max(120),
  email: z.string().trim().toLowerCase().email().max(255),
  clinicName: z.string().trim().max(160).optional().nullable(),
  phone: z.string().trim().max(40).optional().nullable(),
  instagram: z.string().trim().max(120).optional().nullable(),
  clinicType: z.enum(["hair", "beauty", "multi"]),
  ideas: z.string().trim().max(2000).optional().nullable(),
});

export const joinHairBeautyWaitlist = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => schema.parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const insta = (data.instagram ?? "").trim().replace(/^@+/, "");

    const { error } = await (supabaseAdmin as any).from("hair_beauty_waitlist").insert({
      full_name: data.fullName,
      email: data.email,
      clinic_name: data.clinicName?.trim() || null,
      phone: data.phone?.trim() || null,
      instagram: insta ? `@${insta}` : null,
      clinic_type: data.clinicType,
      ideas: data.ideas?.trim() || null,
      source: "hair-beauty-link",
    });

    if (error) {
      console.error("[hair-beauty-waitlist] insert failed", error);
      return { ok: false as const, error: "Could not save your details. Please try again." };
    }
    return { ok: true as const };
  });

export type HairBeautyWaitlistRow = {
  id: string;
  full_name: string;
  email: string;
  clinic_name: string | null;
  phone: string | null;
  instagram: string | null;
  clinic_type: "hair" | "beauty" | "multi";
  ideas: string | null;
  created_at: string;
};

export const adminListHairBeautyWaitlist = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isAdmin, error: roleErr } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (roleErr) throw roleErr;
    if (!isAdmin) throw new Error("Forbidden");

    const { data, error } = await (context.supabase as any)
      .from("hair_beauty_waitlist")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []) as HairBeautyWaitlistRow[];
  });
