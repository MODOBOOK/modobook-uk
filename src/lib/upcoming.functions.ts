import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function getProfileId(supabase: any, userId: string) {
  const { data } = await supabase
    .from("profiles")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();
  return data?.id as string | undefined;
}

export type UpcomingAppointment = {
  id: string;
  patient_name: string;
  patient_email: string | null;
  patient_phone: string | null;
  patient_dob: string | null;
  scheduled_date: string;
  start_time: string;
  end_time: string;
  status: string | null;
  payment_status: string | null;
  payment_method: string | null;
  total_amount: number | null;
  amount_paid_cents: number;
  deposit_required_cents: number | null;
  notes: string | null;
  practitioner_notes: string | null;
  treatment_name: string | null;
  treatment_color: string | null;
  location_id: string | null;
  location_name: string | null;
  practitioner_id: string | null;
  practitioner_name: string | null;
  client_id: string | null;
  forms: { medical_total: number; medical_done: number; consent_total: number; consent_done: number };
  allergies: string | null;
  has_allergies: boolean;
  medications: string[];
  concerns: { label: string; severity: string; notes: string | null }[];
  last_visit: { date: string; treatment: string | null } | null;
  last_note: string | null;
  is_new_patient: boolean;
};

export const listUpcomingAppointments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { days?: number } | undefined) => ({ days: Math.min(Math.max(d?.days ?? 7, 1), 60) }))
  .handler(async ({ data, context }): Promise<UpcomingAppointment[]> => {
    const sb = context.supabase;
    const profileId = await getProfileId(sb, context.userId);
    if (!profileId) return [];

    const today = new Date();
    const from = today.toISOString().slice(0, 10);
    const toDate = new Date(today.getTime() + data.days * 86400000);
    const to = toDate.toISOString().slice(0, 10);

    const { data: appts, error } = await sb
      .from("appointments")
      .select(
        "id, patient_name, patient_email, patient_phone, patient_dob, scheduled_date, start_time, end_time, status, payment_status, payment_method, total_amount, amount_paid_cents, deposit_required_cents, notes, practitioner_notes, has_allergies, allergies_text, location_id, practitioner_id, treatments(name, color), locations(name), practitioners(name)",
      )
      .eq("profile_id", profileId)
      .gte("scheduled_date", from)
      .lte("scheduled_date", to)
      .neq("status", "cancelled")
      .order("scheduled_date", { ascending: true })
      .order("start_time", { ascending: true });
    if (error) throw error;
    const rows = (appts ?? []) as any[];
    if (rows.length === 0) return [];

    const ids = rows.map((r) => r.id);
    const emails = Array.from(
      new Set(rows.map((r) => (r.patient_email ?? "").trim().toLowerCase()).filter(Boolean)),
    );

    const [medRes, consentRes, clientRes] = await Promise.all([
      sb.from("appointment_medical_forms").select("appointment_id, status").in("appointment_id", ids),
      sb.from("appointment_consents").select("appointment_id, status, signed_at").in("appointment_id", ids),
      emails.length
        ? sb
            .from("clinic_clients")
            .select("id, email, allergies, has_allergies")
            .eq("profile_id", profileId)
            .in("email", emails)
        : Promise.resolve({ data: [] as any[] }),
    ]);

    const clients = ((clientRes as any).data ?? []) as any[];
    const clientByEmail = new Map<string, any>();
    for (const c of clients) if (c.email) clientByEmail.set(String(c.email).toLowerCase(), c);
    const clientIds = clients.map((c) => c.id);

    const [medsRes, concernsRes, notesRes, historyRes] = await Promise.all([
      clientIds.length
        ? sb
            .from("client_medications")
            .select("client_id, drug, dose, is_current")
            .in("client_id", clientIds)
            .eq("is_current", true)
        : Promise.resolve({ data: [] as any[] }),
      clientIds.length
        ? sb
            .from("client_concerns")
            .select("client_id, label, severity, notes, resolved, created_at")
            .in("client_id", clientIds)
            .eq("resolved", false)
            .order("created_at", { ascending: false })
        : Promise.resolve({ data: [] as any[] }),
      clientIds.length
        ? sb
            .from("client_notes")
            .select("client_id, body, created_at")
            .in("client_id", clientIds)
            .order("created_at", { ascending: false })
        : Promise.resolve({ data: [] as any[] }),
      emails.length
        ? sb
            .from("appointments")
            .select("patient_email, scheduled_date, treatments(name)")
            .eq("profile_id", profileId)
            .lt("scheduled_date", from)
            .neq("status", "cancelled")
            .order("scheduled_date", { ascending: false })
        : Promise.resolve({ data: [] as any[] }),
    ]);

    const byAppt = <T extends { appointment_id: string }>(list: T[]) => {
      const m = new Map<string, T[]>();
      for (const r of list) {
        if (!r.appointment_id) continue;
        if (!m.has(r.appointment_id)) m.set(r.appointment_id, []);
        m.get(r.appointment_id)!.push(r);
      }
      return m;
    };
    const medForms = byAppt(((medRes as any).data ?? []) as any[]);
    const consents = byAppt(((consentRes as any).data ?? []) as any[]);

    const medsByClient = new Map<string, string[]>();
    for (const m of ((medsRes as any).data ?? []) as any[]) {
      const label = [m.drug, m.dose].filter(Boolean).join(" ");
      const arr = medsByClient.get(m.client_id) ?? [];
      arr.push(label);
      medsByClient.set(m.client_id, arr);
    }
    const concernsByClient = new Map<string, any[]>();
    for (const c of ((concernsRes as any).data ?? []) as any[]) {
      const arr = concernsByClient.get(c.client_id) ?? [];
      if (arr.length < 5) arr.push({ label: c.label, severity: c.severity, notes: c.notes });
      concernsByClient.set(c.client_id, arr);
    }
    const noteByClient = new Map<string, string>();
    for (const n of ((notesRes as any).data ?? []) as any[]) {
      if (!noteByClient.has(n.client_id)) noteByClient.set(n.client_id, n.body);
    }
    const lastVisitByEmail = new Map<string, { date: string; treatment: string | null }>();
    for (const h of ((historyRes as any).data ?? []) as any[]) {
      const key = String(h.patient_email ?? "").toLowerCase();
      if (!key || lastVisitByEmail.has(key)) continue;
      lastVisitByEmail.set(key, { date: h.scheduled_date, treatment: h.treatments?.name ?? null });
    }

    return rows.map((r) => {
      const email = String(r.patient_email ?? "").toLowerCase();
      const client = clientByEmail.get(email);
      const mf = medForms.get(r.id) ?? [];
      const cf = consents.get(r.id) ?? [];
      const lastVisit = lastVisitByEmail.get(email) ?? null;
      return {
        id: r.id,
        patient_name: r.patient_name,
        patient_email: r.patient_email,
        patient_phone: r.patient_phone,
        patient_dob: r.patient_dob,
        scheduled_date: r.scheduled_date,
        start_time: r.start_time,
        end_time: r.end_time,
        status: r.status,
        payment_status: r.payment_status,
        payment_method: r.payment_method,
        total_amount: r.total_amount,
        amount_paid_cents: r.amount_paid_cents ?? 0,
        deposit_required_cents: r.deposit_required_cents,
        notes: r.notes,
        practitioner_notes: r.practitioner_notes,
        treatment_name: r.treatments?.name ?? null,
        treatment_color: r.treatments?.color ?? null,
        location_id: r.location_id,
        location_name: r.locations?.name ?? null,
        practitioner_id: r.practitioner_id,
        practitioner_name: r.practitioners?.name ?? null,
        client_id: client?.id ?? null,
        forms: {
          medical_total: mf.length,
          medical_done: mf.filter((f: any) => f.status === "submitted" || f.submitted_at).length,
          consent_total: cf.length,
          consent_done: cf.filter((f: any) => f.status === "signed" || f.signed_at).length,
        },
        allergies: r.allergies_text ?? client?.allergies ?? null,
        has_allergies: Boolean(r.has_allergies || client?.has_allergies),
        medications: client ? (medsByClient.get(client.id) ?? []) : [],
        concerns: client ? (concernsByClient.get(client.id) ?? []) : [],
        last_visit: lastVisit,
        last_note: client ? (noteByClient.get(client.id) ?? null) : null,
        is_new_patient: !lastVisit,
      } satisfies UpcomingAppointment;
    });
  });

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-3-flash-preview";

export const generateAppointmentBrief = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { appointment: UpcomingAppointment }) => d)
  .handler(async ({ data }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("AI is not configured");
    const a = data.appointment;

    const facts = {
      patient: a.patient_name,
      new_patient: a.is_new_patient,
      when: `${a.scheduled_date} ${String(a.start_time).slice(0, 5)}–${String(a.end_time).slice(0, 5)}`,
      booked: a.treatment_name,
      practitioner: a.practitioner_name,
      location: a.location_name,
      medical_forms: `${a.forms.medical_done}/${a.forms.medical_total} completed`,
      consent_forms: `${a.forms.consent_done}/${a.forms.consent_total} signed`,
      allergies: a.has_allergies ? a.allergies || "flagged, no detail recorded" : "none recorded",
      medications: a.medications,
      concerns: a.concerns,
      last_visit: a.last_visit,
      last_clinical_note: a.last_note?.slice(0, 600) ?? null,
      booking_notes: a.notes?.slice(0, 400) ?? null,
      payment: {
        total: a.total_amount,
        paid_pence: a.amount_paid_cents,
        status: a.payment_status,
        deposit_required_pence: a.deposit_required_cents,
      },
    };

    const res = await fetch(GATEWAY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Lovable-API-Key": apiKey },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          {
            role: "system",
            content:
              "You are a clinical prep assistant for an aesthetics practitioner in the UK. Given structured facts about an upcoming appointment, write a tight pre-appointment brief. Use ONLY the facts supplied — never invent history, diagnoses or allergies. Output plain text with these short sections, each on its own line prefixed by the label: 'Ready:' (what is complete), 'Missing:' (outstanding forms/payment/details, or 'Nothing outstanding'), 'Flags:' (allergies, medications, safeguarding-relevant items, or 'None recorded'), 'Focus:' (what they booked plus concerns raised, and one practical prep suggestion). Max 2 sentences per section. British English. No markdown, no bullets, no preamble.",
          },
          { role: "user", content: JSON.stringify(facts) },
        ],
      }),
    });
    if (res.status === 402) throw new Error("AI credits exhausted. Add credits in workspace settings.");
    if (res.status === 429) throw new Error("AI is busy — try again in a moment.");
    if (!res.ok) throw new Error(`AI request failed (${res.status})`);
    const body = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const text = (body.choices?.[0]?.message?.content ?? "").trim();
    if (!text) throw new Error("AI returned an empty brief");
    return { brief: text };
  });
