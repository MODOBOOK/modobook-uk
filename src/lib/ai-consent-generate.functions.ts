import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { ConsentSection } from "@/components/ConsentSections";

/* ============================================================
   Generate a consent form (sectioned) from uploaded photos/PDFs
   and/or free-text notes. Returns { name, treatment_type,
   summary, sections, requires_signature } in the shape the
   consent editor uses.
   ============================================================ */

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-3-flash-preview";

const SYSTEM_PROMPT = `You draft UK aesthetics clinic consent forms as structured JSON.

Return ONLY raw JSON (no markdown fences) with this exact shape:
{
  "name": string,                 // short title, e.g. "Anti-wrinkle (Botox) consent"
  "treatment_type": string,       // short tag, e.g. "anti_wrinkle", "filler", "peel", "laser"
  "summary": string,              // one-line summary (<= 160 chars)
  "requires_signature": true,
  "sections": [
    {
      "title": string,            // e.g. "About the treatment"
      "body"?: string,            // paragraph text (optional)
      "bullets"?: string[]        // bullet points (optional)
    }
  ]
}

Typical sections to include when relevant:
- "About the treatment"        (body: what it is, how it's done)
- "Expected results"           (bullets)
- "Risks & possible complications" (bullets — be thorough and honest)
- "Contraindications"          (bullets — who should not have it)
- "Aftercare"                  (bullets — do's and don'ts after treatment)
- "Acknowledgement"            (body: patient confirms they understand)

RULES
- Wording must be clear, plain English, patient-facing, UK-appropriate.
- Be conservative and medically responsible; do NOT invent claims.
- If the practitioner's notes name a specific treatment, tailor the form to it.
- If sources are attached (photos/PDFs of an existing consent), preserve their intent and add anything obviously missing.
- Do NOT include ids. Do NOT include markdown. Do NOT wrap in code fences.
- Output ONLY the JSON object.`;

function nid() { return Math.random().toString(36).slice(2, 9); }

type RawSection = { title?: unknown; body?: unknown; bullets?: unknown };

function sanitize(raw: any): {
  name: string;
  treatment_type: string;
  summary: string;
  requires_signature: boolean;
  sections: ConsentSection[];
} {
  const name = typeof raw?.name === "string" && raw.name.trim()
    ? raw.name.trim().slice(0, 140)
    : "AI generated consent";
  const treatment_type = typeof raw?.treatment_type === "string"
    ? raw.treatment_type.trim().slice(0, 60)
    : "";
  const summary = typeof raw?.summary === "string"
    ? raw.summary.trim().slice(0, 240)
    : "";
  const inSections: RawSection[] = Array.isArray(raw?.sections) ? raw.sections : [];
  const sections: ConsentSection[] = inSections
    .map((s): ConsentSection | null => {
      const title = typeof s?.title === "string" && s.title.trim() ? s.title.trim() : "";
      if (!title) return null;
      const body = typeof s?.body === "string" ? s.body.trim() : "";
      const bullets = Array.isArray(s?.bullets)
        ? (s!.bullets as unknown[])
            .filter((b): b is string => typeof b === "string" && b.trim().length > 0)
            .map((b) => b.trim())
        : [];
      const out: ConsentSection = { title } as ConsentSection;
      if (body) (out as any).body = body;
      if (bullets.length) (out as any).bullets = bullets;
      // Attach a stable id for the editor
      (out as any).id = nid();
      return out;
    })
    .filter((s): s is ConsentSection => !!s);

  if (sections.length === 0) {
    sections.push({ title: "About the treatment", body: "AI could not draft this consent — please edit before use." } as ConsentSection);
  }

  return {
    name,
    treatment_type,
    summary,
    requires_signature: true,
    sections,
  };
}

export const generateConsentFromUpload = createServerFn({ method: "POST" })
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
      throw new Error("Type a description or upload a photo/PDF of an existing consent.");
    }

    const userContent: any[] = [];
    const instruction = files.length && data.notes?.trim()
      ? `Draft a consent form using the attached source(s) as reference. Practitioner notes:\n${data.notes.trim()}`
      : files.length
        ? "Draft a consent form based on the attached source(s). If multiple are attached, combine them into ONE cohesive consent."
        : `Draft a consent form from scratch based on these practitioner notes:\n${data.notes!.trim()}`;
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
          file: { filename: f.name || "consent.pdf", file_data: url },
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
