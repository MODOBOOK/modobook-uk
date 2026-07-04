import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-3-flash-preview";

const SYSTEM_PROMPT = `You write short, patient-friendly UK aesthetics clinic treatment descriptions for a booking page.

Rules:
- 2 to 4 sentences, plain English, no marketing hype, no emojis, no markdown, no headings, no bullet points.
- Describe what the treatment is, what it helps with, and what to expect.
- Do not invent specific brand names, prices, durations, or medical claims not implied by the treatment name.
- Do not include disclaimers, consent language, or aftercare.
- Output ONLY the description text, no preamble.`;

export const generateTreatmentDescription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { name: string; notes?: string }) => {
    if (!i?.name?.trim()) throw new Error("Treatment name is required");
    return { name: i.name.trim(), notes: i.notes?.trim() ?? "" };
  })
  .handler(async ({ data }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY is not configured");

    const userMsg = data.notes
      ? `Treatment name: ${data.name}\nPractitioner notes: ${data.notes}`
      : `Treatment name: ${data.name}`;

    const res = await fetch(GATEWAY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Lovable-API-Key": apiKey },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userMsg },
        ],
      }),
    });

    if (res.status === 402) throw new Error("AI credits exhausted. Add credits in workspace settings.");
    if (res.status === 429) throw new Error("AI rate limit hit. Try again shortly.");
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      throw new Error(`AI request failed (${res.status}): ${txt.slice(0, 200)}`);
    }

    const body = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const text = (body.choices?.[0]?.message?.content ?? "")
      .trim()
      .replace(/^["']|["']$/g, "")
      .replace(/^```[a-z]*\s*|\s*```$/gi, "")
      .trim();

    if (!text) throw new Error("AI returned an empty description. Try again.");
    return { description: text };
  });
