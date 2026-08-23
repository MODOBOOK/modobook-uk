import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function __activeProfileId(supabase: any, userId: string) {
  const { activeProfileId } = await import("./clinic-context.server");
  return (await activeProfileId(supabase, userId)) ?? "00000000-0000-0000-0000-000000000000";
}

/* ============================================================
   AI-assisted onboarding: extract clinic data from PDFs/images/
   spreadsheets/URLs and import into MODO.
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
  session_count?: number;
  allow_split_payment?: boolean;
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
    .replace(/<nav[\s\S]*?<\/nav>/gi, " ")
    .replace(/<footer[\s\S]*?<\/footer>/gi, " ")
    .replace(/<header[\s\S]*?<\/header>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 40000);
}

function isBlockedHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  if (!h) return true;
  if (h === "localhost" || h.endsWith(".localhost") || h.endsWith(".internal") || h.endsWith(".local")) return true;
  // IPv6 loopback / link-local / unique-local
  if (h === "::1" || h.startsWith("[::1") || h.startsWith("[fc") || h.startsWith("[fd") || h.startsWith("[fe80")) return true;
  // IPv4 literal – block loopback / private / link-local / CGNAT / metadata
  const m = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (m) {
    const [a, b] = [parseInt(m[1], 10), parseInt(m[2], 10)];
    if (a === 10) return true;
    if (a === 127) return true;
    if (a === 0) return true;
    if (a === 169 && b === 254) return true; // link-local incl. AWS/GCP metadata 169.254.169.254
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
    if (a >= 224) return true; // multicast / reserved
  }
  return false;
}

function assertSafeUrl(target: string): URL {
  let u: URL;
  try { u = new URL(target); } catch { throw new Error("Invalid URL"); }
  if (u.protocol !== "http:" && u.protocol !== "https:") {
    throw new Error("Only http and https URLs are allowed");
  }
  if (isBlockedHost(u.hostname)) {
    throw new Error("URL points to a private or reserved address");
  }
  return u;
}

async function fetchUrlText(url: string): Promise<string> {
  const collected: string[] = [];
  const tried = new Set<string>();

  async function pull(target: string) {
    if (tried.has(target)) return;
    tried.add(target);
    try {
      // Re-validate on every hop; refuse to follow redirects into private space.
      assertSafeUrl(target);
      const res = await fetch(target, {
        headers: { "User-Agent": "Mozilla/5.0 MODO Importer" },
        redirect: "follow",
      });
      if (!res.ok) return;
      // If the final URL after redirects is now private, discard the response.
      try { assertSafeUrl(res.url); } catch { return; }
      const ct = res.headers.get("content-type") || "";
      const text = await res.text();
      collected.push(`--- ${target} ---\n` + (ct.includes("html") ? stripHtml(text) : text.slice(0, 25000)));
    } catch {
      /* ignore */
    }
  }

  const initial = assertSafeUrl(url);
  await pull(initial.toString());


  // Also try common price-list paths on the same origin so URL imports actually find treatments
  try {
    const u = new URL(url);
    const candidates = ["/treatments", "/services", "/pricing", "/price-list", "/menu", "/book"];
    for (const path of candidates) {
      if (collected.join("\n").length > 50000) break;
      await pull(`${u.origin}${path}`);
    }
  } catch {
    /* ignore */
  }

  const joined = collected.join("\n\n").slice(0, 60000);
  if (!joined.trim()) throw new Error(`Could not load ${url}`);
  return joined;
}

const SYSTEM_PROMPT = `You extract aesthetics-clinic price-list data from real source content.

Return a SINGLE JSON object with this exact shape:
{
  "clinic":     { "clinic_name"?, "tagline"?, "bio"?, "phone"?, "email"?, "address"? },
  "categories": [ { "name", "description"?, "parent"? } ],
  "treatments": [ { "name", "duration_min"?, "price_gbp"?, "description"?, "category"?, "aftercare_hint"? } ],
  "addons":     [ { "name", "price_gbp"?, "duration_min"? } ]
}

STRICT RULES — non-negotiable:
- Output ONLY raw JSON. No markdown fences, no commentary.
- NEVER invent, guess, or pad with "typical aesthetics treatments". Only include items that are literally named in the supplied source.
- If the source has no clear price list, return empty arrays for categories/treatments/addons. An empty result is correct and expected.
- Do NOT add categories that have no treatments under them in the source.
- DO NOT create or return packages — practitioners add packages manually. If the source lists "course of 3", "package", or "bundle" items, keep each item as a normal treatment under whatever category it sits in. Never invent a separate "Packages" category to dump them in. Only if the source itself has an explicit category literally called "Packages" / "Bundles" / "Courses" should you keep that as a category; the items inside still go into "treatments".
- Do NOT carry over examples from your training data (no Botox, lip filler, microneedling, etc. unless those exact words appear in the source).
- All prices in GBP as plain numbers (e.g. 180, not "£180"). Omit price if not stated.
- duration_min is whole minutes. Omit if not stated.
- "category" on a treatment must match a name in "categories". Create the category if missing.
- "parent" is the parent category name when something is a subcategory (e.g. "Lip filler" under parent "Injectables").
- If a value is not visible, omit the key entirely — never write "N/A" or guess.
- Treatment "name" must be the treatment ONLY, never "Category: Treatment", "Category - Treatment", or "Category – Treatment". Put the category part in "category" (and "parent" if it's a subcategory) and keep "name" as the clean treatment label. Example: source "Advanced Muscle Injections: Forehead — £180" -> category "Advanced Muscle Injections", name "Forehead", price 180.
- Include "description" ONLY when a literal description, blurb, or "what to expect" line appears in the source for a treatment. When you do include it, copy the source text VERBATIM (you may fix obvious OCR typos and trim leading/trailing whitespace, but do not rewrite, summarise, paraphrase, expand, or "improve" it — the practitioner will click a separate button if they want an AI rewrite). Never invent a description. If the source has no description text for a treatment, omit the "description" field entirely.
- Hard caps: up to 25 categories, 100 treatments, 40 add-ons.`;



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

  const categories = (parsed.categories ?? []).slice(0, 25);
  const treatments = (parsed.treatments ?? []).slice(0, 100);
  const addons = (parsed.addons ?? []).slice(0, 40);
  const packages: ExtractedPackage[] = []; // AI no longer extracts packages — practitioners add them manually.

  // Defensive cleanup: strip "Category: Treatment" / "Category - Treatment"
  // prefixes the model sometimes leaves on the name.
  const catNames = new Set(
    categories.map((c) => (c.name ?? "").toLowerCase().trim()).filter(Boolean),
  );
  const SEP = /\s*[:\-–—|>/]\s+/; // colon, dash, en-dash, em-dash, pipe, >, slash
  for (const t of treatments) {
    if (!t?.name) continue;
    const parts = t.name.split(SEP);
    if (parts.length >= 2) {
      const head = parts[0].trim();
      const tail = parts.slice(1).join(" - ").trim();
      const headLower = head.toLowerCase();
      const matchesCat =
        catNames.has(headLower) ||
        (t.category && t.category.toLowerCase().trim() === headLower);
      if (matchesCat && tail) {
        t.name = tail;
        if (!t.category) t.category = head;
      }
    }
  }

  return { clinic: parsed.clinic ?? {}, categories, treatments, addons, packages };
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
      files?: Array<{ data_url: string; name?: string }>;
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
    } else {
      const files: Array<{ data_url: string; name?: string }> = [];
      if (data.files && data.files.length) files.push(...data.files);
      if (data.file_data_url)
        files.push({ data_url: data.file_data_url, name: data.file_name });

      if (!files.length) throw new Error("Provide text, a URL, or a file.");

      content.push({
        type: "text",
        text:
          files.length === 1
            ? "Extract from this file:"
            : `Extract from these ${files.length} files. Treat them as one combined source (e.g. multiple pages or photos of the same price list / treatment menu) and merge duplicates:`,
      });

      for (const f of files) {
        const mime = f.data_url.match(/^data:([^;]+);base64,/)?.[1] ?? "";
        if (mime.startsWith("image/")) {
          content.push({ type: "image_url", image_url: { url: f.data_url } });
        } else {
          content.push({
            type: "file",
            file: { filename: f.name || "upload.pdf", file_data: f.data_url },
          });
        }
      }
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
      .eq("id", await __activeProfileId(supabase, userId))
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
      errors: [] as string[],
    };
    const noteError = (label: string, err: { message?: string } | null) => {
      if (err?.message) created.errors.push(`${label}: ${err.message}`);
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
    const catParentById = new Map<string, string | null>();

    // Load existing for dedupe + parent reassignment
    const { data: existingCats } = await supabase
      .from("treatment_categories")
      .select("id, name, parent_id")
      .eq("profile_id", profileId);
    (existingCats ?? []).forEach((c: { id: string; name: string; parent_id: string | null }) => {
      catNameToId.set(c.name.toLowerCase(), c.id);
      catParentById.set(c.id, c.parent_id);
    });

    const selectedCats = data.categories.filter((c) => c._include && c.name?.trim());
    const parents = selectedCats.filter((c) => !c.parent);
    const children = selectedCats.filter((c) => c.parent);

    for (const c of [...parents, ...children]) {
      const key = c.name.toLowerCase();
      const desiredParent = c.parent ? catNameToId.get(c.parent.toLowerCase()) ?? null : null;

      if (catNameToId.has(key)) {
        // Already exists — reassign parent if the user changed it in review
        const existingId = catNameToId.get(key)!;
        const currentParent = catParentById.get(existingId) ?? null;
        if (desiredParent && desiredParent !== existingId && currentParent !== desiredParent) {
          const { error } = await supabase
            .from("treatment_categories")
            .update({ parent_id: desiredParent } as never)
            .eq("id", existingId);
          if (error) noteError(`Move category "${c.name}"`, error);
          else catParentById.set(existingId, desiredParent);
        }
        created.skipped++;
        continue;
      }

      const slug = slugify(c.name);
      const { data: row, error } = await supabase
        .from("treatment_categories")
        .insert({
          profile_id: profileId,
          name: c.name.trim(),
          slug,
          parent_id: desiredParent,
          description: c.description ?? null,
          sort_order: 0,
        } as never)
        .select("id")
        .single();
      if (!error && row) {
        catNameToId.set(key, row.id);
        catParentById.set(row.id, desiredParent);
        created.categories++;
      } else noteError(`Category "${c.name}"`, error);
    }

    /* --- Treatments --- */
    const { data: existingTr } = await supabase
      .from("treatments")
      .select("id, name, category_id")
      .eq("profile_id", profileId);
    const existingTrByName = new Map<string, { id: string; category_id: string | null }>();
    (existingTr ?? []).forEach((t: { id: string; name: string; category_id: string | null }) => {
      existingTrByName.set(t.name.toLowerCase(), { id: t.id, category_id: t.category_id });
    });
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
      const nameKey = t.name.toLowerCase();
      const desiredCategoryId = t.category
        ? catNameToId.get(t.category.toLowerCase()) ?? null
        : null;
      const sessions = Math.max(1, Math.round(t.session_count ?? 1));

      const existing = existingTrByName.get(nameKey);
      if (existing) {
        // Update category (and a few safe fields) so re-runs actually apply the user's review picks
        const patch: Record<string, unknown> = {};
        if (desiredCategoryId && existing.category_id !== desiredCategoryId) {
          patch.category_id = desiredCategoryId;
        }
        if (t.description) patch.description = t.description;
        if (Object.keys(patch).length) {
          const { error } = await supabase
            .from("treatments")
            .update(patch as never)
            .eq("id", existing.id);
          if (error) noteError(`Update treatment "${t.name}"`, error);
          else created.treatments++;
        } else {
          created.skipped++;
        }
        continue;
      }

      const { data: row, error } = await supabase
        .from("treatments")
        .insert({
          profile_id: profileId,
          name: t.name.trim(),
          duration: Math.max(5, Math.round(t.duration_min ?? 30)),
          price: Number(t.price_gbp ?? 0),
          description: t.description ?? null,
          category_id: desiredCategoryId,
          active: true,
          payment_mode: "full",
          session_count: sessions,
          allow_split_payment: sessions > 1 ? !!t.allow_split_payment : false,
        } as never)
        .select("id")
        .single();
      if (!error && row) {
        trNameToId.set(nameKey, row.id);
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
      } else noteError(`Treatment "${t.name}"`, error);
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
      else noteError(`Add-on "${a.name}"`, error);
    }

    /* --- Packages: intentionally not imported. Practitioners add them manually. --- */


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

/* ----------- Generate a client-facing description on demand ----------- */

export const generateDescription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      kind: "treatment" | "package";
      name: string;
      treatment_names?: string[];
      sessions?: number;
      price_gbp?: number;
    }) => input,
  )
  .handler(async ({ data }): Promise<{ description: string }> => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY is not configured");

    const ctx =
      data.kind === "package"
        ? `Package name: ${data.name}\nIncludes treatments: ${(data.treatment_names ?? []).join(", ") || "(unspecified)"}\nSessions: ${data.sessions ?? "?"}\nPrice (GBP): ${data.price_gbp ?? "?"}`
        : `Treatment name: ${data.name}`;

    const res = await fetch(GATEWAY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Lovable-API-Key": apiKey },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          {
            role: "system",
            content:
              "You write short, warm, client-facing descriptions for a UK aesthetics clinic booking page. 2-3 sentences max, ~40 words, no emojis, no clinical jargon, no claims of medical outcomes, no pricing. Plain prose only.",
          },
          { role: "user", content: ctx },
        ],
      }),
    });

    if (res.status === 402) throw new Error("AI credits exhausted.");
    if (res.status === 429) throw new Error("AI rate limit — try again shortly.");
    if (!res.ok) throw new Error(`AI failed (${res.status})`);
    const body = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const description = (body.choices?.[0]?.message?.content ?? "").trim();
    return { description };
  });

/* --------------------------- Reset import ------------------------- */
/* Lets a practitioner wipe everything the AI import created (or that
   they manually added) so they can re-run the import from a fresh slate. */

export const resetClinicServices = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { scope?: "treatments" | "all"; force?: boolean }) => input ?? {})
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const scope = data.scope ?? "all";
    const force = data.force ?? false;

    const { data: profile, error: pErr } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", await __activeProfileId(supabase, userId))
      .single();
    if (pErr) throw pErr;
    const profileId = profile.id;

    const removed = { treatments: 0, categories: 0, addons: 0 };
    const skipped = { treatments: 0 };
    const errors: string[] = [];

    const { data: ts } = await supabase
      .from("treatments")
      .select("id")
      .eq("profile_id", profileId);
    const allIds = (ts ?? []).map((t: { id: string }) => t.id);
    if (allIds.length) {
      let deletable: string[];
      if (force) {
        // Snapshot is auto-populated; FK is ON DELETE SET NULL so appointments stay.
        deletable = allIds;
      } else {
        const { data: used } = await supabase
          .from("appointments")
          .select("treatment_id")
          .in("treatment_id", allIds);
        const usedSet = new Set(
          (used ?? [])
            .map((a: { treatment_id: string | null }) => a.treatment_id)
            .filter((id): id is string => !!id),
        );
        deletable = allIds.filter((id) => !usedSet.has(id));
        skipped.treatments = allIds.length - deletable.length;
      }
      if (deletable.length) {
        const { error } = await supabase.from("treatments").delete().in("id", deletable);
        if (error) errors.push(`Treatments: ${error.message}`);
        else removed.treatments = deletable.length;
      }
    }

    if (scope === "all") {
      const { data: adds } = await supabase
        .from("addons")
        .select("id")
        .eq("profile_id", profileId);
      if (adds?.length) {
        const { error } = await supabase
          .from("addons")
          .delete()
          .eq("profile_id", profileId);
        if (error) errors.push(`Add-ons: ${error.message}`);
        else removed.addons = adds.length;
      }

      const { data: cats } = await supabase
        .from("treatment_categories")
        .select("id")
        .eq("profile_id", profileId);
      if (cats?.length) {
        const { error } = await supabase
          .from("treatment_categories")
          .delete()
          .eq("profile_id", profileId);
        if (error) errors.push(`Categories: ${error.message}`);
        else removed.categories = cats.length;
      }
    }

    return { removed, skipped, errors };
  });



