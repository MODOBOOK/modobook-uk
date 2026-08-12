import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

function publicClient() {
  return createClient<Database>(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
  );
}

async function getProfileId(supabase: any, userId: string) {
  const { data } = await supabase.from("profiles").select("id").eq("user_id", userId).maybeSingle();
  return data?.id ?? null;
}

/* ---------- Form categories ---------- */
export const listFormCategories = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const profileId = await getProfileId(context.supabase, context.userId);
    if (!profileId) return [];
    const { data, error } = await context.supabase
      .from("medical_form_categories")
      .select("*")
      .eq("profile_id", profileId)
      .order("sort_order")
      .order("name");
    if (error) throw error;
    return data ?? [];
  });

export const upsertFormCategory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { id?: string; name: string }) => i)
  .handler(async ({ data, context }) => {
    const profileId = await getProfileId(context.supabase, context.userId);
    if (!profileId) throw new Error("Profile not found");
    if (data.id) {
      const { data: row, error } = await context.supabase
        .from("medical_form_categories")
        .update({ name: data.name })
        .eq("id", data.id)
        .eq("profile_id", profileId)
        .select()
        .single();
      if (error) throw error;
      return row;
    }
    const { data: row, error } = await context.supabase
      .from("medical_form_categories")
      .insert({ profile_id: profileId, name: data.name })
      .select()
      .single();
    if (error) throw error;
    return row;
  });

export const deleteFormCategory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { id: string }) => i)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("medical_form_categories")
      .delete()
      .eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

/* ---------- Form templates ---------- */
export const listForms = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const profileId = await getProfileId(context.supabase, context.userId);
    if (!profileId) return [];
    const { data, error } = await context.supabase
      .from("medical_form_templates")
      .select("*")
      .or(`profile_id.eq.${profileId},is_system.eq.true`)
      .order("is_system", { ascending: false })
      .order("name");
    if (error) throw error;
    return data ?? [];
  });

export const getForm = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { id: string }) => i)
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("medical_form_templates")
      .select("*, treatment_medical_forms(treatment_id)")
      .eq("id", data.id)
      .single();
    if (error) throw error;
    return row;
  });

export const saveForm = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: {
    id?: string;
    name: string;
    description?: string | null;
    category_id?: string | null;
    validity?: string;
    schema: unknown;
    treatment_ids?: string[];
  }) => i)
  .handler(async ({ data, context }) => {
    const profileId = await getProfileId(context.supabase, context.userId);
    if (!profileId) throw new Error("Profile not found");
    let id = data.id;
    if (id) {
      const { error } = await context.supabase
        .from("medical_form_templates")
        .update({
          name: data.name,
          description: data.description ?? null,
          category_id: data.category_id ?? null,
          validity: data.validity ?? "always_required",
          schema: data.schema as any,
        })
        .eq("id", id)
        .eq("profile_id", profileId);
      if (error) throw error;
    } else {
      const { data: row, error } = await context.supabase
        .from("medical_form_templates")
        .insert({
          profile_id: profileId,
          name: data.name,
          description: data.description ?? null,
          category_id: data.category_id ?? null,
          validity: data.validity ?? "always_required",
          schema: data.schema as any,
          is_system: false,
        })
        .select("id")
        .single();
      if (error) throw error;
      id = row.id;
    }
    // sync treatment links — scope to current practitioner's treatments so
    // this doesn't affect other practitioners who share a system template.
    if (data.treatment_ids) {
      const { data: myTreatments } = await context.supabase
        .from("treatments").select("id").eq("profile_id", profileId);
      const myIds = (myTreatments ?? []).map((t: any) => t.id as string);
      if (myIds.length) {
        await context.supabase
          .from("treatment_medical_forms")
          .delete()
          .eq("template_id", id)
          .in("treatment_id", myIds);
      }
      const allowed = data.treatment_ids.filter((tid) => myIds.includes(tid));
      if (allowed.length) {
        await context.supabase.from("treatment_medical_forms").insert(
          allowed.map((tid) => ({ template_id: id!, treatment_id: tid })),
        );
      }
    }
    return { id };
  });

export const deleteForm = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { id: string }) => i)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("medical_form_templates")
      .delete()
      .eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

/* ---------- Treatment form links (for treatments editor) ---------- */
export const getTreatmentFormIds = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { treatment_id: string }) => i)
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("treatment_medical_forms")
      .select("template_id")
      .eq("treatment_id", data.treatment_id);
    if (error) throw error;
    return (rows ?? []).map((r: any) => r.template_id as string);
  });

export const setTreatmentFormIds = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { treatment_id: string; template_ids: string[] }) => i)
  .handler(async ({ data, context }) => {
    await context.supabase.from("treatment_medical_forms").delete().eq("treatment_id", data.treatment_id);
    if (data.template_ids.length) {
      const { error } = await context.supabase.from("treatment_medical_forms").insert(
        data.template_ids.map((tid) => ({ treatment_id: data.treatment_id, template_id: tid })),
      );
      if (error) throw error;
    }
    return { ok: true };
  });

/* ---------- Per-appointment forms (practitioner side) ---------- */
export const listFormsForAppointment = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { appointment_id: string }) => i)
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("appointment_medical_forms")
      .select("id, status, token, submitted_at, template:template_id (id, name)")
      .eq("appointment_id", data.appointment_id);
    if (error) throw error;
    return rows ?? [];
  });

/* ---------- Public token-based fill flow ---------- */
export const getFormByToken = createServerFn({ method: "GET" })
  .inputValidator((i: { token: string }) => i)
  .handler(async ({ data }) => {
    const sb = publicClient();
    const { data: rows, error } = await sb.rpc("get_medical_form_by_token", { p_token: data.token });
    if (error) throw error;
    const row = Array.isArray(rows) ? rows[0] : rows;
    return row ?? null;
  });

export const getClinicSlugForFormToken = createServerFn({ method: "GET" })
  .inputValidator((i: { token: string }) => i)
  .handler(async ({ data }) => {
    const sb = publicClient();
    const { data: slug, error } = await sb.rpc("get_clinic_slug_for_form_token", { p_token: data.token });
    if (error) return null;
    return (slug as string | null) ?? null;
  });

export const submitFormByToken = createServerFn({ method: "POST" })
  .inputValidator((i: { token: string; response: unknown }) => i)
  .handler(async ({ data }) => {
    const sb = publicClient();
    const { data: ok, error } = await sb.rpc("submit_medical_form", {
      p_token: data.token,
      p_response: data.response as any,
    });
    if (error) throw error;
    return { ok: !!ok };
  });

/* ---------- Standalone send-to-patient (no appointment) ---------- */
export const sendFormToClient = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { client_id: string; template_id: string; email?: string; phone?: string; sendEmail?: boolean }) => i)
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase.rpc("send_medical_form_to_client", {
      p_client_id: data.client_id,
      p_template_id: data.template_id,
      p_email: data.email ?? null,
      p_phone: data.phone ?? null,
    } as any);
    if (error) throw error;
    const r = Array.isArray(row) ? row[0] : row;
    const formId = r.id as string;
    const token = r.token as string;

    // Send branded email invite when requested and email present
    if (data.sendEmail && data.email) {
      try {
        const [{ data: tpl }, { data: client }, { data: profile }] = await Promise.all([
          context.supabase.from("medical_form_templates").select("name").eq("id", data.template_id).maybeSingle(),
          context.supabase.from("clinic_clients").select("full_name, profile_id").eq("id", data.client_id).maybeSingle(),
          context.supabase.from("profiles").select("id, clinic_name").eq("user_id", context.userId).maybeSingle(),
        ]);
        const { tryEnqueueAppEmail, getPractitionerBranding } = await import("@/lib/email/send.server");
        const branding = await getPractitionerBranding((profile as { id?: string } | null)?.id);
        const origin = process.env.PUBLIC_APP_URL || process.env.APP_URL || "https://modobook.uk";
        await tryEnqueueAppEmail({
          templateName: "medical-form-request",
          recipientEmail: data.email,
          messageId: `form-request-${formId}`,
          templateData: {
            patientName: (client?.full_name ?? "").split(" ")[0] || "there",
            clinicName: profile?.clinic_name ?? branding.clinicName,
            formName: tpl?.name ?? "medical form",
            formUrl: `${origin}/f/${token}`,
            logoUrl: branding.logoUrl,
            brandColor: branding.brandColor,
          },
        });
      } catch (e) { console.error("[sendFormToClient] email failed", e); }
    }

    return { id: formId, token };
  });

export const listFormsForClient = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { client_id: string }) => i)
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("appointment_medical_forms")
      .select("id, token, status, submitted_at, created_at, recipient_email, recipient_phone, appointment_id, template:template_id (id, name)")
      .eq("client_id", data.client_id)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return rows ?? [];
  });

/* ---------- View a single submission (renders for practitioner) ---------- */
export const getFormSubmission = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { id: string }) => i)
  .handler(async ({ data, context }) => {
    const profileId = await getProfileId(context.supabase, context.userId);
    if (!profileId) throw new Error("Profile not found");
    const { data: row, error } = await context.supabase
      .from("appointment_medical_forms")
      .select("id, status, response, submitted_at, created_at, client_id, appointment_id, recipient_email, recipient_phone, token, template:template_id (id, name, schema), client:client_id (id, full_name)")
      .eq("id", data.id)
      .eq("profile_id", profileId)
      .single();
    if (error) throw error;
    return row;
  });

/* ---------- Practitioner edits a submitted form ---------- */
export const updateFormSubmission = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { id: string; response: Record<string, unknown> }) => i)
  .handler(async ({ data, context }) => {
    const profileId = await getProfileId(context.supabase, context.userId);
    if (!profileId) throw new Error("Profile not found");
    const { data: row, error } = await context.supabase
      .from("appointment_medical_forms")
      .update({
        response: data.response as any,
        status: "submitted",
        submitted_at: new Date().toISOString(),
      })
      .eq("id", data.id)
      .eq("profile_id", profileId)
      .select("id, client_id")
      .single();
    if (error) throw error;
    if (row?.client_id) {
      await (context.supabase.rpc as any)("sync_medical_form_to_client", {
        p_client_id: row.client_id,
        p_response: data.response,
      }).then(() => null, () => null);
    }
    return { ok: true };
  });

/* ---------- Resend an existing form link to the patient ---------- */
export const resendFormToClient = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { id: string; email?: string }) => i)
  .handler(async ({ data, context }) => {
    const profileId = await getProfileId(context.supabase, context.userId);
    if (!profileId) throw new Error("Profile not found");
    const { data: row, error } = await context.supabase
      .from("appointment_medical_forms")
      .select("id, token, recipient_email, client_id, template:template_id (name), client:client_id (full_name, email)")
      .eq("id", data.id)
      .eq("profile_id", profileId)
      .single();
    if (error) throw error;
    const r = row as any;
    const to = data.email || r.recipient_email || r.client?.email;
    if (!to) throw new Error("No email on file for this patient");

    const { data: profile } = await context.supabase
      .from("profiles").select("id, clinic_name").eq("user_id", context.userId).maybeSingle();
    const { tryEnqueueAppEmail, getPractitionerBranding } = await import("@/lib/email/send.server");
    const branding = await getPractitionerBranding(profileId);
    const origin = process.env.PUBLIC_APP_URL || process.env.APP_URL || "https://modobook.uk";
    await tryEnqueueAppEmail({
      templateName: "medical-form-request",
      recipientEmail: to,
      messageId: `form-resend-${r.id}-${Date.now()}`,
      templateData: {
        patientName: (r.client?.full_name ?? "").split(" ")[0] || "there",
        clinicName: profile?.clinic_name ?? branding.clinicName,
        formName: r.template?.name ?? "medical form",
        formUrl: `${origin}/f/${r.token}`,
        logoUrl: branding.logoUrl,
        brandColor: branding.brandColor,
      },
    });
    return { ok: true, email: to as string };
  });

/* ---------- Delete a form from a patient profile ---------- */
export const deleteFormSubmission = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { id: string }) => i)
  .handler(async ({ data, context }) => {
    const profileId = await getProfileId(context.supabase, context.userId);
    if (!profileId) throw new Error("Profile not found");
    const { error } = await context.supabase
      .from("appointment_medical_forms")
      .delete()
      .eq("id", data.id)
      .eq("profile_id", profileId);
    if (error) throw error;
    return { ok: true };
  });





/* ---------- Recent submissions across the practitioner ---------- */
export const listRecentFormSubmissions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { limit?: number; status?: "sent" | "submitted" | null } = {}) => i)
  .handler(async ({ data, context }) => {
    const profileId = await getProfileId(context.supabase, context.userId);
    if (!profileId) return [];
    let q = context.supabase
      .from("appointment_medical_forms")
      .select("id, token, status, submitted_at, created_at, recipient_email, template:template_id (id, name), client:client_id (id, full_name)")
      .eq("profile_id", profileId)
      .order("created_at", { ascending: false })
      .limit(data.limit ?? 20);
    if (data.status) q = q.eq("status", data.status);
    const { data: rows, error } = await q;
    if (error) throw error;
    return rows ?? [];
  });


