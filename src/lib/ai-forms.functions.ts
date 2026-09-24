import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function __activeProfileId(supabase: any, userId: string) {
  const { activeProfileId } = await import("./clinic-context.server");
  return (await activeProfileId(supabase, userId)) ?? "00000000-0000-0000-0000-000000000000";
}

/* ============================================================
   AI-assisted matching: pair the practitioner's existing
   treatments with the appropriate medical forms, consent forms
   and aftercare templates available to them.
   ============================================================ */

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-3-flash-preview";

const SYSTEM_PROMPT = `You match aesthetics treatments to the correct medical forms, consent forms and aftercare templates for a UK clinic.

You will be given:
- treatments:    [{ id, name, description? }]
- medical_forms: [{ id, name, description? }]
- consents:      [{ id, name, treatment_type? }]
- aftercares:    [{ id, name, category?, summary? }]

For EACH treatment, decide:
- medical_form_ids: the most appropriate medical / intake form(s) the patient should fill in BEFORE this treatment. Almost every treatment should have at least one general intake form if one exists in the list. Add procedure-specific forms (e.g. an "Injectables" or "Skin" form) where they match.
- consent_ids: the consent form(s) the patient signs for that treatment. Pick by name match (e.g. "Botox consent" goes on toxin treatments, "Filler consent" goes on dermal fillers). If a generic "Treatment consent" exists, use it as a fallback only when no specific one fits.
- aftercare_ids: the aftercare template(s) sent after the treatment. Match by treatment family (toxin, filler, skin, laser, etc.).

STRICT RULES:
- Only use ids that appear in the provided lists. Never invent ids.
- Be conservative — if nothing in the list is a sensible match, return an empty array for that field.
- Output ONLY raw JSON, no markdown.

Return ONLY:
{ "matches": [ { "treatment_id": string, "medical_form_ids": string[], "consent_ids": string[], "aftercare_ids": string[] } ] }`;

export type FormMatch = {
  treatment_id: string;
  medical_form_ids: string[];
  consent_ids: string[];
  aftercare_ids: string[];
};

type IdName = { id: string; name: string };

export const suggestFormMatches = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { treatmentIds?: string[] }) => i ?? {})
  .handler(async ({ data, context }): Promise<{
    matches: FormMatch[];
    treatments: IdName[];
    medicalForms: IdName[];
    consents: IdName[];
    aftercares: IdName[];
  }> => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY is not configured");

    const { supabase, userId } = context;
    const { data: profile, error: pErr } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", await __activeProfileId(supabase, userId))
      .single();
    if (pErr) throw pErr;
    const profileId = profile.id;

    // Load treatments
    let trQuery = supabase
      .from("treatments")
      .select("id, name, description")
      .eq("profile_id", profileId);
    if (data.treatmentIds?.length) trQuery = trQuery.in("id", data.treatmentIds);
    const { data: treatments } = await trQuery;
    if (!treatments?.length) throw new Error("No treatments to match yet. Add or import treatments first.");

    // Pull forms available to this practitioner (own + system)
    const ownOrSystem = `is_system.eq.true,profile_id.eq.${profileId}`;
    const [mfRes, cRes, aRes] = await Promise.all([
      supabase.from("medical_form_templates").select("id, name, description").or(ownOrSystem),
      supabase.from("consent_templates").select("id, name, treatment_type").or(ownOrSystem),
      supabase.from("aftercare_templates").select("id, name, category, summary").or(ownOrSystem),
    ]);
    const medicalForms = (mfRes.data ?? []) as Array<{ id: string; name: string; description: string | null }>;
    const consents = (cRes.data ?? []) as Array<{ id: string; name: string; treatment_type: string | null }>;
    const aftercares = (aRes.data ?? []) as Array<{ id: string; name: string; category: string | null; summary: string | null }>;

    if (!medicalForms.length && !consents.length && !aftercares.length) {
      throw new Error("No forms found to match. Add medical, consent or aftercare templates first.");
    }

    // Use short aliases instead of UUIDs to keep prompts/outputs small & fast.
    const tAlias = new Map<string, string>();
    const mfAlias = new Map<string, string>();
    const cAlias = new Map<string, string>();
    const aAlias = new Map<string, string>();
    treatments.forEach((t, i) => tAlias.set(`t${i + 1}`, t.id));
    medicalForms.forEach((m, i) => mfAlias.set(`m${i + 1}`, m.id));
    consents.forEach((c, i) => cAlias.set(`c${i + 1}`, c.id));
    aftercares.forEach((a, i) => aAlias.set(`a${i + 1}`, a.id));

    const formsPayload = {
      medical_forms: medicalForms.map((m, i) => ({
        id: `m${i + 1}`,
        name: m.name,
        description: (m.description ?? "").slice(0, 100) || undefined,
      })),
      consents: consents.map((c, i) => ({
        id: `c${i + 1}`,
        name: c.name,
        treatment_type: c.treatment_type ?? undefined,
      })),
      aftercares: aftercares.map((a, i) => ({
        id: `a${i + 1}`,
        name: a.name,
        category: a.category ?? undefined,
      })),
    };

    const allT = treatments.map((t, i) => ({
      id: `t${i + 1}`,
      name: t.name,
      description: (t.description ?? "").slice(0, 100) || undefined,
    }));
    const BATCH = 20;
    const batches: typeof allT[] = [];
    for (let i = 0; i < allT.length; i += BATCH) batches.push(allT.slice(i, i + BATCH));

    async function runBatch(batch: typeof allT): Promise<FormMatch[]> {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 60_000);
      let res: Response;
      try {
        res = await fetch(GATEWAY_URL, {
          method: "POST",
          signal: controller.signal,
          headers: { "Content-Type": "application/json", "Lovable-API-Key": apiKey! },
          body: JSON.stringify({
            model: MODEL,
            reasoning_effort: "low",
            max_tokens: 4000,
            messages: [
              { role: "system", content: SYSTEM_PROMPT },
              {
                role: "user",
                content: `Match forms to treatments. Source data:\n\n${JSON.stringify({ treatments: batch, ...formsPayload })}`,
              },
            ],
            response_format: { type: "json_object" },
          }),
        });
      } catch {
        throw new Error("AI took too long to respond. Try again.");
      } finally {
        clearTimeout(timer);
      }
      if (res.status === 402) throw new Error("AI credits exhausted. Add credits in workspace settings.");
      if (res.status === 429) throw new Error("AI rate limit hit. Retry shortly.");
      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(`AI request failed (${res.status}): ${txt.slice(0, 300)}`);
      }
      const body = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
      const raw = (body.choices?.[0]?.message?.content ?? "").trim().replace(/^```json\s*/i, "").replace(/```$/, "");
      let parsed: { matches?: FormMatch[] };
      try {
        parsed = JSON.parse(raw);
      } catch {
        return [];
      }
      const map = (ids: string[] | undefined, m: Map<string, string>) =>
        Array.from(new Set((ids ?? []).map((x) => m.get(String(x))).filter((x): x is string => !!x)));
      return (parsed.matches ?? [])
        .filter((m) => m && tAlias.has(String(m.treatment_id)))
        .map((m) => ({
          treatment_id: tAlias.get(String(m.treatment_id))!,
          medical_form_ids: map(m.medical_form_ids, mfAlias),
          consent_ids: map(m.consent_ids, cAlias),
          aftercare_ids: map(m.aftercare_ids, aAlias),
        }));
    }

    const results = await Promise.allSettled(batches.map(runBatch));
    const matches = results.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
    if (!matches.length) {
      const firstErr = results.find((r) => r.status === "rejected") as PromiseRejectedResult | undefined;
      throw new Error(firstErr ? (firstErr.reason as Error).message : "AI returned no matches. Try again.");
    }

    return {
      matches,
      treatments: treatments.map((t) => ({ id: t.id, name: t.name })),
      medicalForms: medicalForms.map((m) => ({ id: m.id, name: m.name })),
      consents: consents.map((c) => ({ id: c.id, name: c.name })),
      aftercares: aftercares.map((a) => ({ id: a.id, name: a.name })),
    };
  });

export const commitFormMatches = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { matches: FormMatch[]; mode?: "merge" | "replace" }) => i)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: profile, error: pErr } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", await __activeProfileId(supabase, userId))
      .single();
    if (pErr) throw pErr;
    const profileId = profile.id;
    const mode = data.mode ?? "merge";

    let medical = 0;
    let consent = 0;
    let aftercare = 0;
    const errors: string[] = [];

    for (const m of data.matches) {
      if (!m.treatment_id) continue;

      if (mode === "replace") {
        await supabase.from("treatment_medical_forms").delete().eq("treatment_id", m.treatment_id);
        await supabase.from("treatment_consents").delete().eq("treatment_id", m.treatment_id);
        await supabase.from("treatment_aftercare_templates").delete().eq("treatment_id", m.treatment_id);
      }

      if (m.medical_form_ids.length) {
        const { data: existing } = await supabase
          .from("treatment_medical_forms")
          .select("template_id")
          .eq("treatment_id", m.treatment_id);
        const have = new Set((existing ?? []).map((r: { template_id: string }) => r.template_id));
        const rows = m.medical_form_ids
          .filter((id) => !have.has(id))
          .map((template_id) => ({ treatment_id: m.treatment_id, template_id }));
        if (rows.length) {
          const { error } = await supabase.from("treatment_medical_forms").insert(rows as never);
          if (error) errors.push(`Medical link: ${error.message}`);
          else medical += rows.length;
        }
      }

      if (m.consent_ids.length) {
        const { data: existing } = await supabase
          .from("treatment_consents")
          .select("consent_template_id")
          .eq("treatment_id", m.treatment_id);
        const have = new Set((existing ?? []).map((r: { consent_template_id: string }) => r.consent_template_id));
        const rows = m.consent_ids
          .filter((id) => !have.has(id))
          .map((consent_template_id) => ({
            treatment_id: m.treatment_id,
            consent_template_id,
            profile_id: profileId,
          }));
        if (rows.length) {
          const { error } = await supabase.from("treatment_consents").insert(rows as never);
          if (error) errors.push(`Consent link: ${error.message}`);
          else consent += rows.length;
        }
      }

      if (m.aftercare_ids.length) {
        const { data: existing } = await supabase
          .from("treatment_aftercare_templates")
          .select("template_id")
          .eq("treatment_id", m.treatment_id);
        const have = new Set((existing ?? []).map((r: { template_id: string }) => r.template_id));
        const rows = m.aftercare_ids
          .filter((id) => !have.has(id))
          .map((template_id) => ({ treatment_id: m.treatment_id, template_id }));
        if (rows.length) {
          const { error } = await supabase.from("treatment_aftercare_templates").insert(rows as never);
          if (error) errors.push(`Aftercare link: ${error.message}`);
          else aftercare += rows.length;
        }
      }
    }

    return { medical, consent, aftercare, errors };
  });

