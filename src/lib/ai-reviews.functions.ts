import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function __activeProfileId(supabase: any, userId: string) {
  const { activeProfileId } = await import("./clinic-context.server");
  return (await activeProfileId(supabase, userId)) ?? "00000000-0000-0000-0000-000000000000";
}

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-3-flash-preview";

export type ExtractedReview = {
  author_name: string;
  quote: string;
  rating?: number | null;
};

const SYSTEM_PROMPT = `You extract patient/customer reviews from screenshots, photos, PDFs or pasted text.

Return ONLY raw JSON of this exact shape:
{ "reviews": [ { "author_name": string, "quote": string, "rating"?: number } ] }

Rules:
- Only include reviews literally present in the source. Never invent or pad.
- "author_name" = first name (or first name + initial) of the reviewer. If only a username or full name is visible, take the first word. If completely anonymous or no name is shown, use "Anonymous".
- "quote" = the review text only, verbatim, trimmed. Strip emojis only if they break sentences. No quotation marks around it. If the review is a star rating with NO written text, return an empty string "" for quote — still include it.
- "rating" = whole number 1-5 when visible (stars filled, "5/5", "★★★★★"). Omit if unclear.
- IMPORTANT: include EVERY review entry, even ones with no name, no text, no rating, or all three — never drop an entry just because a field is missing. The count you return must match the number of review entries visible in the source.
- Skip replies from the business / clinic owner — only patient-written reviews.
- Hard cap: 200 reviews.
- If nothing review-like is present, return { "reviews": [] }.`;

type GatewayContent =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } }
  | { type: "file"; file: { filename: string; file_data: string } };

async function callGateway(content: GatewayContent[]): Promise<ExtractedReview[]> {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) throw new Error("LOVABLE_API_KEY is not configured");

  const res = await fetch(GATEWAY_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Lovable-API-Key": apiKey },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content },
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
  const raw = (body.choices?.[0]?.message?.content ?? "").trim().replace(/^```json\s*/i, "").replace(/```$/, "");
  let parsed: { reviews?: ExtractedReview[] };
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("AI returned malformed output. Try a clearer source.");
  }
  const out = (parsed.reviews ?? []).slice(0, 200).filter((r) => Boolean(r));
  for (const r of out) {
    r.author_name = (r.author_name ?? "").trim() || "Anonymous";
    r.quote = (r.quote ?? "").trim();
    if (r.rating != null) {
      const n = Math.round(Number(r.rating));
      r.rating = Number.isFinite(n) && n >= 1 && n <= 5 ? n : null;
    }
  }
  return out;
}

export const extractReviews = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      text?: string;
      files?: Array<{ data_url: string; name?: string }>;
    }) => input,
  )
  .handler(async ({ data }): Promise<{ reviews: ExtractedReview[] }> => {
    const content: GatewayContent[] = [];
    if (data.text && data.text.trim()) {
      content.push({ type: "text", text: `Extract reviews from this content:\n\n${data.text.slice(0, 25000)}` });
    } else if (data.files && data.files.length) {
      content.push({
        type: "text",
        text:
          data.files.length === 1
            ? "Extract every patient review you can see in this file:"
            : `Extract every patient review across these ${data.files.length} files (treat as one combined source; de-dupe identical reviews):`,
      });
      for (const f of data.files) {
        const mime = f.data_url.match(/^data:([^;]+);base64,/)?.[1] ?? "";
        if (mime.startsWith("image/")) {
          content.push({ type: "image_url", image_url: { url: f.data_url } });
        } else {
          content.push({ type: "file", file: { filename: f.name || "upload.pdf", file_data: f.data_url } });
        }
      }
    } else {
      throw new Error("Paste review text or attach at least one screenshot.");
    }
    const reviews = await callGateway(content);
    return { reviews };
  });

export const commitReviews = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: { reviews: Array<{ author_name: string; quote: string; rating?: number | null }> }) => input,
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: profile, error: pErr } = await supabase
      .from("profiles").select("id").eq("id", await __activeProfileId(supabase, userId)).single();
    if (pErr) throw pErr;

    const rows = data.reviews
      .map((r) => ({
        profile_id: profile.id,
        author_name: (r.author_name ?? "").trim() || "Anonymous",
        quote: (r.quote ?? "").trim(),
        rating: r.rating ?? null,
        display_order: 0,
      }));
    if (!rows.length) return { inserted: 0 };

    const { error } = await supabase.from("clinic_testimonials").insert(rows as never);
    if (error) throw new Error(error.message);
    return { inserted: rows.length };
  });
