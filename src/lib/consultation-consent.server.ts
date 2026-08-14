/**
 * Mirrors a signed consultation consent into the patient's profile
 * (appointment_consents) so it shows in the patient's Consents list
 * immediately — whether or not the consultation has been completed.
 */

type AnyClient = any;

async function ensureFallbackTemplate(
  supabase: AnyClient,
  profileId: string,
  body: string,
): Promise<string | null> {
  const name = "Consultation consent";
  const { data: existing } = await supabase
    .from("consent_templates")
    .select("id")
    .eq("profile_id", profileId)
    .eq("name", name)
    .maybeSingle();
  if (existing?.id) return existing.id as string;

  const { data: created, error } = await supabase
    .from("consent_templates")
    .insert({
      profile_id: profileId,
      name,
      body_markdown: body || "Consultation treatment consent.",
      is_system: false,
      requires_signature: true,
    })
    .select("id")
    .maybeSingle();
  if (error) return null;
  return (created?.id as string) ?? null;
}

async function ensurePatient(
  supabase: AnyClient,
  profileId: string,
  cons: any,
): Promise<string | null> {
  if (cons.patient_id) return cons.patient_id as string;

  let clientId: string | null = null;
  if (cons.patient_email) {
    const { data } = await supabase
      .from("clinic_clients")
      .select("id")
      .eq("profile_id", profileId)
      .ilike("email", cons.patient_email)
      .maybeSingle();
    if (data?.id) clientId = data.id as string;
  }
  if (!clientId && cons.patient_name) {
    const { data } = await supabase
      .from("clinic_clients")
      .select("id")
      .eq("profile_id", profileId)
      .ilike("full_name", cons.patient_name)
      .maybeSingle();
    if (data?.id) clientId = data.id as string;
  }
  if (!clientId) {
    const { data: created } = await supabase
      .from("clinic_clients")
      .insert({
        profile_id: profileId,
        full_name: cons.patient_name || "Unnamed patient",
        email: cons.patient_email ?? null,
        phone: cons.patient_phone ?? null,
      })
      .select("id")
      .maybeSingle();
    clientId = (created?.id as string) ?? null;
  }
  if (clientId) {
    await supabase
      .from("consultations")
      .update({ patient_id: clientId })
      .eq("id", cons.id)
      .eq("profile_id", profileId);
  }
  return clientId;
}

export async function syncConsultationConsent(
  supabase: AnyClient,
  profileId: string,
  consultationId: string,
): Promise<{ saved: number; client_id: string | null }> {
  const { data: cons, error } = await supabase
    .from("consultations")
    .select("id, patient_id, patient_name, patient_email, patient_phone, consent")
    .eq("id", consultationId)
    .eq("profile_id", profileId)
    .maybeSingle();
  if (error) throw error;
  if (!cons) throw new Error("Consultation not found");

  const consent = (cons.consent ?? {}) as any;
  const signature: string | null = consent.signature ?? null;
  if (!signature) return { saved: 0, client_id: cons.patient_id ?? null };

  const clientId = await ensurePatient(supabase, profileId, cons);
  if (!clientId) return { saved: 0, client_id: null };

  const signedAt: string = consent.signed_at ?? new Date().toISOString();
  const signerName: string | null = consent.signer_name ?? cons.patient_name ?? null;

  let templateIds: string[] = Array.isArray(consent.attached_template_ids)
    ? consent.attached_template_ids.filter(Boolean)
    : [];
  if (templateIds.length === 0) {
    const fallback = await ensureFallbackTemplate(supabase, profileId, consent.body ?? "");
    if (!fallback) return { saved: 0, client_id: clientId };
    templateIds = [fallback];
  }

  let saved = 0;
  for (const templateId of templateIds) {
    const token = `cons-${consultationId}-${templateId}`.slice(0, 120);
    const payload = {
      profile_id: profileId,
      client_id: clientId,
      consent_template_id: templateId,
      token,
      status: "signed",
      signature_data: signature,
      signature_name: signerName,
      signed_at: signedAt,
    };
    const { data: existing } = await supabase
      .from("appointment_consents")
      .select("id")
      .eq("token", token)
      .maybeSingle();
    if (existing?.id) {
      const { error: uErr } = await supabase
        .from("appointment_consents")
        .update({
          status: "signed",
          signature_data: signature,
          signature_name: signerName,
          signed_at: signedAt,
        })
        .eq("id", existing.id);
      if (!uErr) saved += 1;
    } else {
      const { error: iErr } = await supabase.from("appointment_consents").insert(payload);
      if (!iErr) saved += 1;
    }
  }

  return { saved, client_id: clientId };
}
