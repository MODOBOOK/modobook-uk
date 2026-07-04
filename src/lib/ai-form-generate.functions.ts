import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/* ============================================================
   Generate a medical form schema from an uploaded photo or PDF
   (or from free-text notes). Returns { name, description, schema }
   in the same shape the medical-forms builder uses.
   ============================================================ */

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-3-flash-preview";

const SYSTEM_PROMPT = `You convert medical / consultation / intake forms into a structured JSON schema for a UK aesthetics clinic builder.

Return ONLY raw JSON (no markdown fences) with this exact shape:
{
  "name": string,                 // short form title, e.g. "Botox Consultation"
  "description": string,          // one line summary (<= 140 chars)
  "schema": {
    "steps": [
      {
        "title": string,          // step title
        "elements": [ Element ]
      }
    ]
  }
}

Element is one of:
- { "type": "heading",   "text": string, "level": 1|2|3 }
- { "type": "paragraph", "text": string }
- { "type": "info",      "text": string, "variant": "info"|"warning"|"success" }
- { "type": "field",     "label": string, "fieldType": "text"|"email"|"tel"|"number"|"date"|"textarea", "required"?: boolean, "placeholder"?: string, "helpText"?: string }
- { "type": "select",    "label": string, "options": string[], "required"?: boolean }
- { "type": "radio",     "label": string, "options": string[], "required"?: boolean }
- { "type": "checkbox_group", "label": string, "options": string[], "required"?: boolean }
- { "type": "checkbox",  "label": string, "required"?: boolean }
- { "type": "rating",    "label": string, "max": number }
- { "type": "signature", "label": string, "required"?: boolean }
- { "type": "separator" }
- { "type": "space" }

RULES
- Preserve the wording of the source form as closely as possible.
- Group logically (About You, Medical History, Consent, Signature).
- Yes/No questions -> "radio" with ["Yes","No"]. Multi-select -> "checkbox_group".
- Long free-text answers -> "field" with fieldType "textarea".
- Every question a patient must answer -> required: true.
- If the source ends with a signature line, add a "signature" element.
- Do NOT invent unrelated fields. Do NOT include ids (the app assigns them).
- Output ONLY the JSON object.

PLAIN-ENGLISH WORDING (CRITICAL — applies to every user-visible string: "name", "description", step "title", element "text", "label", "placeholder", "helpText", "options"):
- Write everything as natural, plain English sentences a patient would read. Never as code.
- NO snake_case, camelCase, kebab-case, ALL_CAPS_CONSTANTS, or programmer-style identifiers. "full_name" -> "Full name". "dob" -> "Date of birth". "gpName" -> "GP name".
- NO code fences, backticks, angle brackets, curly/square brackets, JSON, HTML tags, markdown syntax, or template placeholders like {{name}} or \${x}.
- NO field keys, variable names, type annotations, or references to "field", "input", "schema", "JSON" in visible text.
- Use sentence case for labels and titles. Use normal punctuation and spaces. Options like "Yes"/"No" stay natural words, never "yes_no" or "Y/N".
- Placeholders and help text must be short, friendly sentences ("e.g. 07123 456789"), not code samples.`;


type Element = Record<string, unknown>;
type Step = { title: string; elements: Element[] };

const ALLOWED_TYPES = new Set([
  "heading","paragraph","info","field","select","radio","checkbox_group",
  "checkbox","rating","signature","separator","space",
]);

function nid() { return Math.random().toString(36).slice(2, 9); }

function decodeEntities(s: string) {
  const named: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
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

function visibleText(value: string) {
  return decodeEntities(value)
    .replace(/<\s*br\s*\/?\s*>/gi, "\n")
    .replace(/<\/\s*(p|div|h[1-6]|li|ul|ol|section|article)\s*>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/[`{}[\]<>]/g, "")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanVisibleStrings(el: Element): Element {
  const out: Element = { ...el };
  for (const key of ["text", "label", "placeholder", "helpText"] as const) {
    if (typeof out[key] === "string") out[key] = visibleText(out[key] as string);
  }
  if (Array.isArray(out.options)) {
    out.options = out.options
      .filter((option): option is string => typeof option === "string" && option.trim().length > 0)
      .map(visibleText)
      .filter(Boolean);
  }
  return out;
}

function sanitize(raw: any): { name: string; description: string; schema: { steps: any[] } } {
  const name = typeof raw?.name === "string" && raw.name.trim() ? visibleText(raw.name).slice(0, 120) : "AI generated form";
  const description = typeof raw?.description === "string" ? visibleText(raw.description).slice(0, 200) : "";
  const inSteps: Step[] = Array.isArray(raw?.schema?.steps) ? raw.schema.steps : [];
  const steps: Array<{ id: string; title: string; elements: any[] }> = inSteps.map((s, i) => {
    const title = typeof s?.title === "string" && s.title.trim() ? visibleText(s.title) : `Step ${i + 1}`;
    const elements = (Array.isArray(s?.elements) ? s.elements : [])
      .filter((el: any) => el && typeof el === "object" && ALLOWED_TYPES.has(el.type))
      .map((el: any) => ({ ...cleanVisibleStrings(el), id: nid() }));
    return { id: nid(), title, elements };
  }).filter((s) => s.elements.length > 0);
  if (steps.length === 0) {
    steps.push({ id: nid(), title: "About You", elements: [
      { id: nid(), type: "paragraph", text: "AI could not extract fields from this source." },
    ] });
  }
  // Always guarantee a signature field so patients can sign the form
  const hasSignature = steps.some((s) => (s.elements as any[]).some((el) => el?.type === "signature"));
  if (!hasSignature) {
    steps.push({
      id: nid(),
      title: "Signature",
      elements: [
        { id: nid(), type: "paragraph", text: "By signing below, I confirm the information above is accurate to the best of my knowledge." },
        { id: nid(), type: "signature", label: "Patient signature", required: true },
      ],
    });
  }
  return { name, description, schema: { steps } };
}

export const generateFormFromUpload = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: {
    fileDataUrl?: string;   // legacy single-file input
    fileName?: string;
    files?: Array<{ dataUrl: string; name?: string }>;  // multiple files
    notes?: string;
  }) => i ?? {})
  .handler(async ({ data }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY is not configured");

    const files: Array<{ dataUrl: string; name?: string }> = [];
    if (data.files?.length) files.push(...data.files);
    if (data.fileDataUrl) files.push({ dataUrl: data.fileDataUrl, name: data.fileName });

    if (!files.length && !data.notes?.trim()) {
      throw new Error("Upload a photo/PDF or type notes to describe the form.");
    }

    const userContent: any[] = [];
    const instruction = data.notes?.trim()
      ? `Build a medical / consultation form by combining the attached source(s) into ONE cohesive form. Merge duplicate questions and keep a logical order. Additional notes from the practitioner:\n${data.notes.trim()}`
      : files.length > 1
        ? "Combine the attached forms into ONE cohesive JSON schema. Merge duplicate questions and keep a logical order."
        : "Convert the attached form into the JSON schema.";
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
          file: { filename: f.name || "form.pdf", file_data: url },
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
