import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/* ============================================================
   AI-assisted onboarding: extract clinic data from PDFs/images/
   spreadsheets/URLs and import into MODO Book.
   ============================================================ */

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-3-flash-preview";

/* --- Types returned to the client review screen --- */

export type ExtractedClinic = {
  clinic_name?: string;
  tagline?: string;
  bio?: string;
  phone?: string;
  email?: string;
  address?: string;
};
export type ExtractedCategory = {
  name: string;
  description?: string;
  parent?: string | null;
};
export type ExtractedTreatment = {
  name: string;
  duration_min?: number;
  price_gbp?: number;
  description?: string;
  category?: string | null;
  aftercare_hint?: string | null;
};
export type ExtractedAddon = {
  name: string;
  price_gbp?: number;
  duration_min?: number;
};
export type ExtractedPackage = {
  name: string;
  treatment_names?: string[];
  price_gbp?: number;
  sessions?: number;
  description?: string;
};
export type ExtractedDraft = {
  clinic: ExtractedClinic;
  categories: ExtractedCategory[];
  treatments: ExtractedTreatment[];
  addons: ExtractedAddon[];
  packages: ExtractedPackage[];
};

/* ----------------------------- helpers ----------------------------- */

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 25000);
}

async function fetchUrlText(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 MODO-Book Importer" },
    redirect: "follow",
  });
  if (!res.ok) throw new Error(`Could not load ${url} (${res.status})`);
  const ct = res.headers.get("content-type") || "";
  const text = await res.text();
  return ct.includes("html") ? stripHtml(text) : text.slice(0, 25000);
}

const SYSTEM_PROMPT = `You are an assistant that extracts aesthetics-clinic price-list data.

Given source content (text or a file/image), return a SINGLE JSON object with this exact shape:
{
  "clinic":     { "clinic_name"?, "tagline"?, "bio"?, "phone"?, "email"?, "address"? },
  "categories": [ { "name", "description"?, "parent"? } ],
  "treatments": [ { "name", "duration_min"?, "price_gbp"?, "description"?, "category"?, "aftercare_hint"? } ],
  "addons":     [ { "name", "price_gbp"?, "duration_min"? } ],
  "packages":   [ { "name", "treatment_names"?, "price_gbp"?, "sessions"?, "description"? } ]
}

Rules:
- Output ONLY raw JSON, no markdown fences, no commentary.
- All prices in GBP as plain numbers (e.g. 180, not "£180").
- duration_min is in whole minutes.
- "category" on a treatment must match a name in "categories" (create one if missing).
- "parent" is the parent category name when it is a subcategory.
- If a value is not visible in the source, omit the key entirely.
- Hard caps: up to 25 categories, 100 treatments, 40 add-ons, 20 packages. Skip anything beyond.
- Do not invent treatments. Only include items present in the source.`;

type GatewayContent =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } }
  | { type: "file"; file: { filename: string; file_data: string } };

async function callGateway(content: GatewayContent[]): Promise<ExtractedDraft> {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) throw new Error("LOVABLE_API_KEY is not configured");

  const res = await fetch(GATEWAY_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Lovable-API-Key": apiKey,
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content },
      ],
      response_format: { type: "json_object" },
    }),
  });

  if (res.status === 402) throw new Error("AI credits exhausted. Please add credits in workspace settings.");
  if (res.status === 429) throw new Error("AI rate limit hit. Please retry in a moment.");
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`AI request failed (${res.status}): ${txt.slice(0, 300)}`);
  }

  const body = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const raw = body.choices?.[0]?.message?.content ?? "";
  const cleaned = raw.trim().replace(/^```json\s*/i, "").replace(/```$/, "");
  let parsed: Partial<ExtractedDraft>;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error("AI returned malformed output. Try a clearer source.");
  }

  return {
    clinic: parsed.clinic ?? {},
    categories: (parsed.categories ?? []).slice(0, 25),
    treatments: (parsed.treatments ?? []).slice(0, 100),
    addons: (parsed.addons ?? []).slice(0, 40),
    packages: (parsed.packages ?? []).slice(0, 20),
  };
}

/* ------------------------ Server functions ------------------------ */

/**
 * Extract a draft from a source. Exactly ONE of `text`, `url`, or
 * `file_data_url` should be supplied.
 *   - text          : pasted text (spreadsheet rows, copied price list)
 *   - url           : public webpage URL
 *   - file_data_url : a base64 data URL ("data:application/pdf;base64,..." or "data:image/png;base64,...")
 */
export const extractClinicData = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      text?: string;
      url?: string;
      file_data_url?: string;
      file_name?: string;
    }) => input,
  )
  .handler(async ({ data }): Promise<ExtractedDraft> => {
    const content: GatewayContent[] = [];

    if (data.text && data.text.trim()) {
      content.push({
        type: "text",
        text: `Extract from this content:\n\n${data.text.slice(0, 25000)}`,
      });
    } else if (data.url) {
      const txt = await fetchUrlText(data.url);
      content.push({
        type: "text",
        text: `Extract from this clinic website content (source: ${data.url}):\n\n${txt}`,
      });
    } else if (data.file_data_url) {
      const url = data.file_data_url;
      const mime = url.match(/^data:([^;]+);base64,/)?.[1] ?? "";
      content.push({ type: "text", text: "Extract from this file:" });
      if (mime.startsWith("image/")) {
        content.push({ type: "image_url", image_url: { url } });
      } else {
        content.push({
          type: "file",
          file: { filename: data.file_name || "upload.pdf", file_data: url },
        });
      }
    } else {
      throw new Error("Provide text, a URL, or a file.");
    }

    return callGateway(content);
  });

/* --------------------------- Commit import ------------------------ */

type CommitInput = {
  clinic: Partial<ExtractedClinic> & { _include?: boolean };
  categories: Array<ExtractedCategory & { _include: boolean }>;
  treatments: Array<ExtractedTreatment & { _include: boolean }>;
  addons: Array<ExtractedAddon & { _include: boolean }>;
  packages: Array<ExtractedPackage & { _include: boolean }>;
};

export const commitClinicImport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: CommitInput) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: profile, error: pErr } = await supabase
      .from("profiles")
      .select("id, clinic_name, tagline, bio, welcome_intro_html")
      .eq("user_id", userId)
      .single();
    if (pErr) throw pErr;
    const profileId = profile.id;

    const created = {
      clinic: false,
      categories: 0,
      treatments: 0,
      addons: 0,
      packages: 0,
      skipped: 0,
    };

    /* --- Clinic info (only fields the user kept and are non-empty) --- */
    if (data.clinic && data.clinic._include !== false) {
      const update: Record<string, unknown> = {};
      if (data.clinic.clinic_name && !profile.clinic_name) update.clinic_name = data.clinic.clinic_name;
      if (data.clinic.tagline && !profile.tagline) update.tagline = data.clinic.tagline;
      if (data.clinic.bio) {
        if (!profile.bio) update.bio = data.clinic.bio;
        if (!profile.welcome_intro_html) update.welcome_intro_html = `<p>${escapeHtml(data.clinic.bio)}</p>`;
      }
      if (Object.keys(update).length) {
        const { error } = await supabase.from("profiles").update(update as never).eq("id", profileId);
        if (!error) created.clinic = true;
      }
    }

    /* --- Categories first (parents before children) --- */
    const catNameToId = new Map<string, string>();

    // Load existing for dedupe
    const { data: existingCats } = await supabase
      .from("treatment_categories")
      .select("id, name, parent_id")
      .eq("profile_id", profileId);
    (existingCats ?? []).forEach((c: { id: string; name: string }) => {
      catNameToId.set(c.name.toLowerCase(), c.id);
    });

    const selectedCats = data.categories.filter((c) => c._include && c.name?.trim());
    const parents = selectedCats.filter((c) => !c.parent);
    const children = selectedCats.filter((c) => c.parent);

    for (const c of [...parents, ...children]) {
      const key = c.name.toLowerCase();
      if (catNameToId.has(key)) {
        created.skipped++;
        continue;
      }
      const parentId = c.parent ? catNameToId.get(c.parent.toLowerCase()) ?? null : null;
      const slug = slugify(c.name);
      const { data: row, error } = await supabase
        .from("treatment_categories")
        .insert({
          profile_id: profileId,
          name: c.name.trim(),
          slug,
          parent_id: parentId,
          description: c.description ?? null,
          sort_order: 0,
        } as never)
        .select("id")
        .single();
      if (!error && row) {
        catNameToId.set(key, row.id);
        created.categories++;
      }
    }

    /* --- Treatments --- */
    const { data: existingTr } = await supabase
      .from("treatments")
      .select("id, name")
      .eq("profile_id", profileId);
    const existingTrNames = new Set(
      (existingTr ?? []).map((t: { name: string }) => t.name.toLowerCase()),
    );
    const trNameToId = new Map<string, string>();
    (existingTr ?? []).forEach((t: { id: string; name: string }) => {
      trNameToId.set(t.name.toLowerCase(), t.id);
    });

    // Load aftercare templates for hint matching
    const { data: aftercareTpls } = await supabase
      .from("aftercare_templates")
      .select("id, name")
      .or(`is_system.eq.true,profile_id.eq.${profileId}`);
    const aftercareByName = new Map<string, string>();
    (aftercareTpls ?? []).forEach((t: { id: string; name: string }) =>
      aftercareByName.set(t.name.toLowerCase(), t.id),
    );

    for (const t of data.treatments.filter((x) => x._include && x.name?.trim())) {
      if (existingTrNames.has(t.name.toLowerCase())) {
        created.skipped++;
        continue;
      }
      const categoryId = t.category
        ? catNameToId.get(t.category.toLowerCase()) ?? null
        : null;
      const { data: row, error } = await supabase
        .from("treatments")
        .insert({
          profile_id: profileId,
          name: t.name.trim(),
          duration: Math.max(5, Math.round(t.duration_min ?? 30)),
          price: Number(t.price_gbp ?? 0),
          description: t.description ?? null,
          category_id: categoryId,
          active: true,
          payment_mode: "full",
          session_count: 1,
        } as never)
        .select("id")
        .single();
      if (!error && row) {
        trNameToId.set(t.name.toLowerCase(), row.id);
        created.treatments++;

        // Link aftercare suggestion if it matches a known template
        if (t.aftercare_hint) {
          const tplId = bestAftercareMatch(t.aftercare_hint, aftercareByName);
          if (tplId) {
            await supabase
              .from("treatment_aftercare_templates")
              .insert({ treatment_id: row.id, template_id: tplId } as never);
          }
        }
      }
    }

    /* --- Add-ons --- */
    const { data: existingAddons } = await supabase
      .from("addons")
      .select("name")
      .eq("profile_id", profileId);
    const existingAddonNames = new Set(
      (existingAddons ?? []).map((a: { name: string }) => a.name.toLowerCase()),
    );
    for (const a of data.addons.filter((x) => x._include && x.name?.trim())) {
      if (existingAddonNames.has(a.name.toLowerCase())) {
        created.skipped++;
        continue;
      }
      const { error } = await supabase.from("addons").insert({
        profile_id: profileId,
        name: a.name.trim(),
        price_cents: Math.round((a.price_gbp ?? 0) * 100),
        duration_min: Math.max(0, Math.round(a.duration_min ?? 0)),
        active: true,
        sort_order: 0,
      } as never);
      if (!error) created.addons++;
    }

    /* --- Packages --- */
    const { data: existingPkgs } = await supabase
      .from("packages")
      .select("name")
      .eq("profile_id", profileId);
    const existingPkgNames = new Set(
      (existingPkgs ?? []).map((p: { name: string }) => p.name.toLowerCase()),
    );
    for (const pkg of data.packages.filter((x) => x._include && x.name?.trim())) {
      if (existingPkgNames.has(pkg.name.toLowerCase())) {
        created.skipped++;
        continue;
      }
      const trIds = (pkg.treatment_names ?? [])
        .map((n) => trNameToId.get(n.toLowerCase()))
        .filter(Boolean) as string[];
      const primary = trIds[0] ?? null;
      const { error } = await supabase.from("packages").insert({
        profile_id: profileId,
        name: pkg.name.trim(),
        treatment_id: primary,
        treatment_ids: trIds.length ? trIds : null,
        session_count: Math.max(1, Math.round(pkg.sessions ?? trIds.length ?? 1)),
        price: Number(pkg.price_gbp ?? 0),
        active: true,
        description: pkg.description ?? null,
      } as never);
      if (!error) created.packages++;
    }

    return created;
  });

/* -------------------------- small helpers ------------------------- */

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function bestAftercareMatch(hint: string, map: Map<string, string>): string | null {
  const h = hint.toLowerCase();
  // exact
  if (map.has(h)) return map.get(h)!;
  // contains either direction
  for (const [name, id] of map) {
    if (h.includes(name) || name.includes(h)) return id;
  }
  return null;
}
