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
