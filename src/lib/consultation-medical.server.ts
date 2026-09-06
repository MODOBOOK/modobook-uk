/**
 * Mirrors the medical history captured inside a consultation into the
 * patient's profile (appointment_medical_forms) so it appears in their
 * Forms list immediately — whether or not the consultation is completed.
 */

type AnyClient = any;

const TEMPLATE_NAME = "Consultation medical history";

function slug(label: string) {
  return (
    "q_" +
    label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 60)
  );
}

function buildSchema(questions: string[]) {
  return {
    steps: [
      {
        id: "medical",
        title: "Medical history",
        elements: [
          ...questions.map((q) => ({ id: slug(q), type: "yesno", label: q })),
          { id: "notes", type: "textarea", label: "Additional notes" },
        ],
      },
    ],
  };
}

async function ensureTemplate(
  supabase: AnyClient,
  profileId: string,
  questions: string[],
): Promise<string | null> {
  const schema = buildSchema(questions);
  const { data: existing } = await supabase
    .from("medical_form_templates")
    .select("id")
    .eq("profile_id", profileId)
    .eq("name", TEMPLATE_NAME)
    .maybeSingle();

  if (existing?.id) {
    await supabase
      .from("medical_form_templates")
      .update({ schema })
      .eq("id", existing.id);
    return existing.id as string;
  }

  const { data: created, error } = await supabase
    .from("medical_form_templates")
    .insert({
      profile_id: profileId,
      name: TEMPLATE_NAME,
      description: "Medical history recorded during a consultation.",
      schema,
      is_system: false,
      is_published: true,
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

export async function syncConsultationMedical(
  supabase: AnyClient,
  profileId: string,
  consultationId: string,
): Promise<{ saved: number; client_id: string | null }> {
  const { data: cons, error } = await supabase
    .from("consultations")
    .select("id, patient_id, patient_name, patient_email, patient_phone, medical")
    .eq("id", consultationId)
    .eq("profile_id", profileId)
    .maybeSingle();
  if (error) throw error;
  if (!cons) throw new Error("Consultation not found");

  const medical = (cons.medical ?? {}) as any;
  const answers = (medical.answers ?? {}) as Record<string, any>;
  const notes: string = typeof medical.notes === "string" ? medical.notes : "";
  const questions = Object.keys(answers);
  if (questions.length === 0 && !notes.trim()) {
    return { saved: 0, client_id: cons.patient_id ?? null };
  }

  const clientId = await ensurePatient(supabase, profileId, cons);
  if (!clientId) return { saved: 0, client_id: null };

  const templateId = await ensureTemplate(supabase, profileId, questions);
  if (!templateId) return { saved: 0, client_id: clientId };

  const response: Record<string, any> = { notes };
  for (const q of questions) response[slug(q)] = answers[q] ? "Yes" : "No";

  const token = `consmed-${consultationId}`.slice(0, 120);
  const now = new Date().toISOString();

  const { data: existing } = await supabase
    .from("appointment_medical_forms")
    .select("id")
    .eq("token", token)
    .maybeSingle();

  if (existing?.id) {
    const { error: uErr } = await supabase
      .from("appointment_medical_forms")
      .update({ response, status: "submitted", submitted_at: now, template_id: templateId })
      .eq("id", existing.id);
    if (uErr) throw uErr;
  } else {
    const { error: iErr } = await supabase.from("appointment_medical_forms").insert({
      profile_id: profileId,
      client_id: clientId,
      template_id: templateId,
      token,
      status: "submitted",
      submitted_at: now,
      response,
      recipient_email: cons.patient_email ?? null,
      recipient_phone: cons.patient_phone ?? null,
    });
    if (iErr) throw iErr;
  }

  return { saved: 1, client_id: clientId };
}
