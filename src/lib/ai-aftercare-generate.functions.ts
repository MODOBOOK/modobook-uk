import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/* ============================================================
   Generate an aftercare template from a description or uploaded
   sources. Returns { name, delay_hours, body_html } — where
   body_html intentionally contains plain readable text only.
   ============================================================ */

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-3-flash-preview";

const SYSTEM_PROMPT = `You draft UK aesthetics clinic aftercare instructions as structured JSON.

Return ONLY raw JSON (no markdown fences) with this exact shape:
{
  "name": string,             // short title, e.g. "Lip filler aftercare"
  "delay_hours": number,      // when to send after appointment (default 2)
  "sections": [
    {
      "title": string,        // section heading, e.g. "First 24 hours"
      "body"?: string,        // short paragraph (optional)
      "bullets"?: string[]    // bullet points (optional)
    }
  ]
}

Typical sections (include those that are relevant):
- "What to expect"           (body/bullets — normal reactions)
- "First 24 hours"           (bullets — do's and don'ts)
- "First 1–2 weeks"          (bullets)
- "Avoid"                    (bullets — clear no-go list)
- "When to contact us"       (bullets — warning signs)

RULES
- UK plain English, warm and reassuring but medically responsible.
- Never invent claims. Do not diagnose. Do not recommend specific medications by brand.
- If practitioner notes name a specific treatment, tailor the aftercare to it.
- Keep bullets short and scannable.
- Do NOT include ids, markdown, HTML tags, code-like text, angle brackets, or code fences.
- Every visible word must be patient-readable plain English, not markup or code.
- Output ONLY the JSON object.`;

type RawSection = { title?: unknown; body?: unknown; bullets?: unknown };

function decodeEntities(s: string) {
  const named: Record<string, string> = {
    amp: "&",
    lt: "<",
    gt: ">",
    quot: '"',
    apos: "'",
    nbsp: " ",
  };
  return s.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (match, entity) => {
    const key = String(entity).toLowerCase();
    if (key.startsWith("#x")) {
      const code = Number.parseInt(key.slice(2), 16);
      return Number.isFinite(code) ? String.fromCodePoint(code) : match;
    }
    if (key.startsWith("#")) {
      const code = Number.parseInt(key.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : match;
    }
    return named[key] ?? match;
  });
}

function toPlainText(s: string) {
  return decodeEntities(s)
    .replace(/<\s*br\s*\/?\s*>/gi, "\n")
    .replace(/<\s*li[^>]*>/gi, "• ")
    .replace(/<\/\s*(p|div|h[1-6]|li|ul|ol|section|article)\s*>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function sectionsToPlainText(sections: { title: string; body?: string; bullets?: string[] }[]): string {
  const blocks: string[] = [];
  for (const s of sections) {
    const lines = [toPlainText(s.title)].filter(Boolean);
    if (s.body && s.body.trim()) lines.push(toPlainText(s.body));
    if (s.bullets && s.bullets.length) {
      lines.push(...s.bullets.map((b) => `• ${toPlainText(b)}`).filter((b) => b !== "• "));
    }
    if (lines.length) blocks.push(lines.join("\n"));
  }
  return blocks.join("\n\n");
}

function sanitize(raw: any): { name: string; delay_hours: number; body_html: string } {
  const name = typeof raw?.name === "string" && raw.name.trim()
    ? raw.name.trim().slice(0, 140)
    : "AI generated aftercare";
  const delayNum = Number(raw?.delay_hours);
  const delay_hours = Number.isFinite(delayNum) && delayNum >= 0 ? Math.min(168, Math.round(delayNum)) : 2;
  const inSections: RawSection[] = Array.isArray(raw?.sections) ? raw.sections : [];
  const sections = inSections
    .map((s) => {
      const title = typeof s?.title === "string" ? toPlainText(s.title) : "";
      if (!title) return null;
      const body = typeof s?.body === "string" ? toPlainText(s.body) : "";
      const bullets = Array.isArray(s?.bullets)
        ? (s!.bullets as unknown[])
            .filter((b): b is string => typeof b === "string" && b.trim().length > 0)
            .map((b) => toPlainText(b))
            .filter(Boolean)
        : [];
      return { title, body, bullets };
    })
    .filter((s): s is { title: string; body: string; bullets: string[] } => !!s);

  if (sections.length === 0) {
    sections.push({
      title: "Aftercare",
      body: "AI could not draft aftercare — please edit before use.",
      bullets: [],
    });
  }

  return { name: toPlainText(name), delay_hours, body_html: sectionsToPlainText(sections) };
}

export const generateAftercareFromUpload = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: {
    files?: Array<{ dataUrl: string; name?: string }>;
    notes?: string;
  }) => i ?? {})
  .handler(async ({ data }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY is not configured");

    const files = data.files ?? [];
    if (!files.length && !data.notes?.trim()) {
      throw new Error("Type a description or upload a photo/PDF of existing aftercare.");
    }

    const userContent: any[] = [];
    const instruction = files.length && data.notes?.trim()
      ? `Draft an aftercare template using the attached source(s) as reference. Practitioner notes:\n${data.notes.trim()}`
      : files.length
        ? "Draft an aftercare template based on the attached source(s). Merge multiple sources into ONE cohesive aftercare."
        : `Draft an aftercare template from scratch based on these practitioner notes:\n${data.notes!.trim()}`;
    userContent.push({ type: "text", text: instruction });

    for (const f of files) {
      const url = f.dataUrl;
      const mimeMatch = /^data:([^;]+);base64,/.exec(url);
      const mime = mimeMatch?.[1] ?? "";
      if (mime.startsWith("image/")) {
        userContent.push({ type: "image_url", image_url: { url } });
      } else if (mime === "application/pdf") {
        userContent.push({
          type: "file",
          file: { filename: f.name || "aftercare.pdf", file_data: url },
        });
      } else if (mime) {
        throw new Error(`Unsupported file type: ${mime}. Upload photos or PDFs.`);
      }
    }

    const res = await fetch(GATEWAY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Lovable-API-Key": apiKey },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userContent },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (res.status === 402) throw new Error("AI credits exhausted. Add credits in workspace settings.");
    if (res.status === 429) throw new Error("AI rate limit hit. Try again shortly.");
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      throw new Error(`AI request failed (${res.status}): ${txt.slice(0, 300)}`);
    }

    const body = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const raw = (body.choices?.[0]?.message?.content ?? "").trim()
      .replace(/^```json\s*/i, "").replace(/```$/, "");
    let parsed: any;
    try { parsed = JSON.parse(raw); }
    catch { throw new Error("AI returned malformed output. Try again."); }

    return sanitize(parsed);
  });
