import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-3-flash-preview";

const SYSTEM_PROMPT = `You match patient concerns to aesthetic treatments offered by a UK clinic.

You will be given:
- A list of treatments the clinic offers (id, name, optional description).
- One or more patient concerns (id, name, optional description, optional area like "Face" / "Body").

For each concern, pick ONLY treatments from the provided list that a UK aesthetics practitioner would reasonably offer for that concern. Be conservative — if you are not confident, leave it out. Never invent treatments not in the list. Never include a treatment id that is not in the provided list.

Return ONLY raw JSON of this exact shape:
{ "matches": [ { "concern_id": string, "treatment_ids": string[] } ] }`;

type Treatment = { id: string; name: string; description?: string | null };
type Concern = { id: string; name: string; description?: string | null; area?: string | null };

export const suggestConcernMatches = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { treatments: Treatment[]; concerns: Concern[] }) => i)
  .handler(async ({ data }): Promise<{ matches: Array<{ concern_id: string; treatment_ids: string[] }> }> => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY is not configured");
    if (!data.treatments.length) throw new Error("Add treatments first before using AI matching.");
    if (!data.concerns.length) throw new Error("Add at least one concern first.");

    const validIds = new Set(data.treatments.map((t) => t.id));

    const payload = {
      treatments: data.treatments.map((t) => ({
        id: t.id,
        name: t.name,
        description: (t.description ?? "").slice(0, 240) || undefined,
      })),
      concerns: data.concerns.map((c) => ({
        id: c.id,
        name: c.name,
        area: c.area ?? undefined,
        description: (c.description ?? "").slice(0, 240) || undefined,
      })),
    };

    const res = await fetch(GATEWAY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Lovable-API-Key": apiKey },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: `Match these concerns to treatments. Source data:\n\n${JSON.stringify(payload)}` },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (res.status === 402) throw new Error("AI credits exhausted. Add credits in workspace settings.");
    if (res.status === 429) throw new Error("AI rate limit hit. Retry shortly.");
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      throw new Error(`AI request failed (${res.status}): ${txt.slice(0, 300)}`);
    }

    const body = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const raw = (body.choices?.[0]?.message?.content ?? "")
      .trim()
      .replace(/^```json\s*/i, "")
      .replace(/```$/, "");
    let parsed: { matches?: Array<{ concern_id: string; treatment_ids: string[] }> };
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error("AI returned malformed output. Try again.");
    }
    const validConcernIds = new Set(data.concerns.map((c) => c.id));
    const matches = (parsed.matches ?? [])
      .filter((m) => m && validConcernIds.has(m.concern_id) && Array.isArray(m.treatment_ids))
      .map((m) => ({
        concern_id: m.concern_id,
        treatment_ids: Array.from(new Set(m.treatment_ids.filter((id) => validIds.has(id)))),
      }));
    return { matches };
  });

// --- Suggest NEW concerns derived from the practitioner's treatments ---

const CONCERNS_SYSTEM_PROMPT = `You generate patient-friendly aesthetic concerns for a UK clinic, then map each concern to the clinic's treatments.

Inputs:
- A list of treatments the clinic offers (id, name, optional description).
- Optional existing areas (id, name) such as "Face" or "Body".
- Optional list of existing concern names so you can AVOID duplicates.

Rules:
- Propose 6-14 high-quality concerns that genuinely match the treatments offered. Be conservative, do not invent concerns that don't map to at least one treatment.
- Use natural patient language ("Fine lines & wrinkles", "Lip volume", "Acne scarring", "Pigmentation", "Excess sweating"). UK English.
- Skip any concern whose name (case-insensitive) is already in the existing list.
- For each concern, set area_id ONLY to an id from the provided areas list, or null if none fits. Never invent area ids. If null, suggest a short area_name like "Face" or "Body".
- treatment_ids MUST only contain ids from the provided treatments list. Each concern must have at least one treatment_id.

Return ONLY raw JSON in this exact shape:
{ "concerns": [ { "name": string, "description": string, "area_id": string | null, "area_name": string | null, "treatment_ids": string[] } ] }`;

export type SuggestedConcern = {
  name: string;
  description: string;
  area_id: string | null;
  area_name: string | null;
  treatment_ids: string[];
};

export const suggestConcernsFromTreatments = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: {
    treatments: Treatment[];
    areas: { id: string; name: string }[];
    existingNames: string[];
  }) => i)
  .handler(async ({ data }): Promise<{ concerns: SuggestedConcern[] }> => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY is not configured");
    if (!data.treatments.length) throw new Error("Add treatments first before using AI.");

    const validTreatmentIds = new Set(data.treatments.map((t) => t.id));
    const validAreaIds = new Set(data.areas.map((a) => a.id));
    const existingLc = new Set(data.existingNames.map((n) => n.trim().toLowerCase()));

    const payload = {
      treatments: data.treatments.map((t) => ({
        id: t.id,
        name: t.name,
        description: (t.description ?? "").slice(0, 240) || undefined,
      })),
      areas: data.areas.map((a) => ({ id: a.id, name: a.name })),
      existing_concern_names: data.existingNames,
    };

    const res = await fetch(GATEWAY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Lovable-API-Key": apiKey },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: CONCERNS_SYSTEM_PROMPT },
          { role: "user", content: `Generate concerns for this clinic. Source data:\n\n${JSON.stringify(payload)}` },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (res.status === 402) throw new Error("AI credits exhausted. Add credits in workspace settings.");
    if (res.status === 429) throw new Error("AI rate limit hit. Retry shortly.");
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      throw new Error(`AI request failed (${res.status}): ${txt.slice(0, 300)}`);
    }

    const body = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const raw = (body.choices?.[0]?.message?.content ?? "")
      .trim()
      .replace(/^```json\s*/i, "")
      .replace(/```$/, "");
    let parsed: { concerns?: SuggestedConcern[] };
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error("AI returned malformed output. Try again.");
    }

    const out: SuggestedConcern[] = [];
    const seenLc = new Set<string>();
    for (const c of parsed.concerns ?? []) {
      if (!c || typeof c.name !== "string") continue;
      const name = c.name.trim();
      if (!name) continue;
      const lc = name.toLowerCase();
      if (existingLc.has(lc) || seenLc.has(lc)) continue;
      const tids = Array.isArray(c.treatment_ids)
        ? Array.from(new Set(c.treatment_ids.filter((id) => validTreatmentIds.has(id))))
        : [];
      if (tids.length === 0) continue;
      const areaId = c.area_id && validAreaIds.has(c.area_id) ? c.area_id : null;
      const areaName = typeof c.area_name === "string" && c.area_name.trim() ? c.area_name.trim() : null;
      seenLc.add(lc);
      out.push({
        name,
        description: typeof c.description === "string" ? c.description.slice(0, 280) : "",
        area_id: areaId,
        area_name: areaName,
        treatment_ids: tids,
      });
    }
    return { concerns: out };
  });

