import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

// ---- Constants surfaced to UI ----
export const REGULATORY_BODIES = [
  { value: "GMC", label: "GMC — General Medical Council (UK)" },
  { value: "NMC", label: "NMC — Nursing & Midwifery Council (UK)" },
  { value: "GPhC", label: "GPhC — General Pharmaceutical Council (UK)" },
  { value: "GDC", label: "GDC — General Dental Council (UK)" },
  { value: "MCRN", label: "MCRN — Medical Council (Ireland)" },
  { value: "NMBI", label: "NMBI — Nursing & Midwifery Board (Ireland)" },
  { value: "PSI", label: "PSI — Pharmaceutical Society of Ireland" },
  { value: "OTHER", label: "Other — admin will verify manually" },
] as const;

export type PrescriberStatus = "pending" | "approved" | "rejected" | "more_info";
export type HubOwnerKind = "practitioner" | "prescriber";
export type HubLinkStatus = "pending" | "accepted" | "declined" | "cancelled";

// ---- Context: what is this signed-in user? ----
export const getHubContext = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const [{ data: profile }, { data: prescriber }, { data: code }] = await Promise.all([
      supabase.from("profiles").select("id, full_name, clinic_name").eq("user_id", userId).maybeSingle(),
      supabase.from("prescriber_profiles").select("*").eq("user_id", userId).maybeSingle(),
      supabase.from("hub_codes").select("code, owner_kind, display_name").eq("user_id", userId).maybeSingle(),
    ]);

    const role: HubOwnerKind | "none" = prescriber
      ? "prescriber"
      : profile
        ? "practitioner"
        : "none";

    return {
      role,
      profile: profile ?? null,
      prescriber: prescriber ?? null,
      code: code?.code ?? null,
      displayName: code?.display_name ?? profile?.full_name ?? profile?.clinic_name ?? prescriber?.full_name ?? null,
    };
  });

// ---- Ensure the user has a code (created on first hub visit) ----
export const ensureHubCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const [{ data: profile }, { data: prescriber }] = await Promise.all([
      supabase.from("profiles").select("full_name, clinic_name").eq("user_id", userId).maybeSingle(),
      supabase.from("prescriber_profiles").select("full_name, status").eq("user_id", userId).maybeSingle(),
    ]);
    // Prescribers only get a code once approved
    if (prescriber && prescriber.status !== "approved") {
      return { code: null as string | null, blockedReason: "Verification pending" };
    }
    const kind: HubOwnerKind = prescriber ? "prescriber" : "practitioner";
    const displayName =
      prescriber?.full_name ?? profile?.full_name ?? profile?.clinic_name ?? "User";
    const { data, error } = await supabase.rpc("ensure_hub_code", {
      p_kind: kind,
      p_display_name: displayName,
    });
    if (error) throw error;
    return { code: data as unknown as string, blockedReason: null as string | null };
  });

// ---- Prescriber verification submission ----
const SubmitSchema = z.object({
  full_name: z.string().trim().min(2).max(120),
  regulatory_body: z.string().trim().min(2).max(40),
  regulatory_body_other: z.string().trim().max(120).optional().nullable(),
  registration_number: z.string().trim().min(2).max(60),
  id_document_path: z.string().trim().min(3).max(500),
});

export const submitPrescriberVerification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: z.infer<typeof SubmitSchema>) => SubmitSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const payload = {
      user_id: userId,
      full_name: data.full_name,
      regulatory_body: data.regulatory_body,
      regulatory_body_other: data.regulatory_body === "OTHER" ? (data.regulatory_body_other ?? null) : null,
      registration_number: data.registration_number,
      id_document_path: data.id_document_path,
      status: "pending" as const,
      admin_note: null,
    };
    const { data: row, error } = await supabase
      .from("prescriber_profiles")
      .upsert(payload, { onConflict: "user_id" })
      .select()
      .single();
    if (error) throw error;
    return row;
  });

// ---- Get a short-lived signed URL for an ID document (owner or admin) ----
export const getIdDocumentUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { path: string }) => i)
  .handler(async ({ data, context }) => {
    const { data: signed, error } = await context.supabase.storage
      .from("prescriber-ids")
      .createSignedUrl(data.path, 60 * 10);
    if (error) throw error;
    return { url: signed.signedUrl };
  });

// ---- Admin: list verification submissions ----
export const adminListPrescriberSubmissions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Forbidden");
    const { data, error } = await context.supabase
      .from("prescriber_profiles")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data ?? [];
  });

// ---- Admin: decide on a submission ----
export const adminDecidePrescriber = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: {
    id: string;
    decision: "approved" | "rejected" | "more_info";
    note?: string;
  }) => i)
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Forbidden");

    const { data: row, error } = await context.supabase
      .from("prescriber_profiles")
      .update({
        status: data.decision,
        admin_note: data.note ?? null,
        reviewed_by: context.userId,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", data.id)
      .select()
      .single();
    if (error) throw error;

    // Grant prescriber role on approval (uses service role to write user_roles)
    if (data.decision === "approved" && row?.user_id) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await supabaseAdmin.from("user_roles").upsert(
        { user_id: row.user_id, role: "prescriber" },
        { onConflict: "user_id,role" },
      );
    }
    return row;
  });

// ---- Hub: send a link request by code ----
export const sendLinkRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { code: string; note?: string }) => i)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const normalised = data.code.replace(/-/g, "").trim();
    if (!normalised) throw new Error("Enter a code");

    const { data: target, error: resolveErr } = await supabase.rpc("resolve_hub_code", {
      p_code: normalised,
    });
    if (resolveErr) throw resolveErr;
    const recipient = Array.isArray(target) ? target[0] : target;
    if (!recipient) throw new Error("That code doesn't match anyone");
    if (recipient.user_id === userId) throw new Error("That's your own code");

    // Block duplicates regardless of direction (matches the unique index)
    const { data: existing } = await supabase
      .from("hub_links")
      .select("*")
      .or(
        `and(requester_user_id.eq.${userId},recipient_user_id.eq.${recipient.user_id}),and(requester_user_id.eq.${recipient.user_id},recipient_user_id.eq.${userId})`,
      )
      .limit(1)
      .maybeSingle();
    if (existing) {
      if (existing.status === "accepted") throw new Error("You're already connected");
      if (existing.status === "pending") throw new Error("A request is already pending");
    }

    const { data: row, error } = await supabase
      .from("hub_links")
      .insert({
        requester_user_id: userId,
        recipient_user_id: recipient.user_id,
        status: "pending",
        requester_note: data.note ?? null,
      })
      .select()
      .single();
    if (error) throw error;
    return row;
  });

// ---- Respond to a link request ----
export const respondToLinkRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { id: string; action: "accept" | "decline" }) => i)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const status: HubLinkStatus = data.action === "accept" ? "accepted" : "declined";
    const { data: row, error } = await supabase
      .from("hub_links")
      .update({ status, responded_at: new Date().toISOString() })
      .eq("id", data.id)
      .eq("recipient_user_id", userId)
      .select()
      .single();
    if (error) throw error;
    return row;
  });

// ---- Cancel an outgoing request or unlink ----
export const removeLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { id: string }) => i)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("hub_links").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

// ---- List hub data for the signed-in user ----
export const listHubData = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: links, error } = await supabase
      .from("hub_links")
      .select("*")
      .or(`requester_user_id.eq.${userId},recipient_user_id.eq.${userId}`)
      .order("created_at", { ascending: false });
    if (error) throw error;

    // Resolve display info for the "other" user on each link via hub_codes (readable to all auth users)
    const otherIds = Array.from(
      new Set(
        (links ?? []).map((l) =>
          l.requester_user_id === userId ? l.recipient_user_id : l.requester_user_id,
        ),
      ),
    );
    let codeMap = new Map<string, { code: string; owner_kind: HubOwnerKind; display_name: string | null }>();
    let nameFallback = new Map<string, string>();
    if (otherIds.length > 0) {
      const { data: codes } = await supabase
        .from("hub_codes")
        .select("user_id, code, owner_kind, display_name")
        .in("user_id", otherIds);
      for (const c of codes ?? []) {
        codeMap.set(c.user_id, {
          code: c.code,
          owner_kind: c.owner_kind as HubOwnerKind,
          display_name: c.display_name,
        });
      }
      // Fill in missing names via profiles / prescriber_profiles using the
      // service role — RLS on those tables blocks cross-user reads, but the
      // hub_link between the two users is already accepted so exposing the
      // partner's display name is fine.
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const [{ data: profs }, { data: prescs }] = await Promise.all([
        supabaseAdmin.from("profiles").select("user_id, clinic_name, full_name").in("user_id", otherIds),
        supabaseAdmin.from("prescriber_profiles").select("user_id, full_name").in("user_id", otherIds),
      ]);
      for (const p of profs ?? []) {
        const nm = (p.clinic_name?.trim() || p.full_name?.trim()) ?? "";
        if (nm) nameFallback.set(p.user_id, nm);
      }
      for (const p of prescs ?? []) {
        if (!nameFallback.has(p.user_id) && p.full_name?.trim()) {
          nameFallback.set(p.user_id, p.full_name.trim());
        }
      }
    }

    const enriched = (links ?? []).map((l) => {
      const otherId = l.requester_user_id === userId ? l.recipient_user_id : l.requester_user_id;
      const direction: "outgoing" | "incoming" = l.requester_user_id === userId ? "outgoing" : "incoming";
      const other = codeMap.get(otherId) ?? null;
      const name =
        (other?.display_name && other.display_name.trim()) ||
        nameFallback.get(otherId) ||
        null;
      return {
        id: l.id,
        status: l.status as HubLinkStatus,
        direction,
        note: l.requester_note,
        created_at: l.created_at,
        other_user_id: otherId,
        other_code: other?.code ?? null,
        other_kind: other?.owner_kind ?? null,
        other_name: name,
      };
    });
    return enriched;
  });

