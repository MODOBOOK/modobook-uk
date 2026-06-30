## AI Onboarding Wizard

A new "Import with AI" flow that lets a practitioner upload a PDF, image, spreadsheet, or paste a website URL and have Lovable AI populate their entire MODO Book — clinic info, categories, treatments, add-ons, packages, and suggested aftercare — in one go.

### Where it lives

- New route: `/dashboard/onboarding/ai-import` (also surfaced as a big "Import with AI" card on the dashboard home for accounts with zero services, and as a button on the Services page).
- Three steps: **Upload → AI review → Import**.

### Step 1 — Upload

Single screen, four input tiles:
- **PDF price list / menu** — drag-and-drop, up to 20 MB.
- **Photo / screenshot** — JPG/PNG of a printed menu or competitor site.
- **Spreadsheet (CSV / Excel)** — parsed in browser to text before sending.
- **Website URL** — scraped server-side via Firecrawl (existing connector if linked, otherwise we add it).

Files upload to a private `ai-imports` storage bucket scoped to the practitioner. URL inputs skip storage.

### Step 2 — AI extraction (server function)

New TanStack server function `extractClinicData` (`src/lib/ai-import.functions.ts`, behind `requireSupabaseAuth`):

1. Loads the source (signed URL for PDF/image, raw text for CSV, Firecrawl markdown for URLs).
2. Calls Lovable AI `google/gemini-3-flash-preview` with multimodal input and a tight Zod-validated `Output.object` schema:
   - `clinic`: name, tagline, short bio, contact details if present.
   - `categories[]`: name, optional description, parent name for subcategories.
   - `treatments[]`: name, duration_mins, price_gbp, description, category name, suggested add-ons, suggested aftercare template name.
   - `addons[]`: name, price, duration.
   - `packages[]`: name, included treatment names, total price, sessions.
3. Returns the draft as JSON — nothing is written yet.

A second lightweight call maps each treatment to the closest existing aftercare template by name similarity so the practitioner sees a suggestion rather than a blank.

### Step 3 — Review & import

A single review screen with collapsible sections (Clinic, Categories, Treatments, Add-ons, Packages). For each row:
- Checkbox to include / exclude.
- Inline editable fields (name, price, duration, description, category dropdown, aftercare dropdown).
- "Select all" / "Deselect all" per section.
- Diff badges when an item with the same name already exists ("Update existing" vs "Create new").

A sticky footer shows totals ("12 treatments, 4 categories, 3 add-ons will be imported") and a single **Import** button. Import runs in a server function that:
- Upserts clinic profile fields (only the ones the practitioner ticked).
- Inserts categories first, then subcategories, then treatments with the correct `category_id`, then add-ons and `treatment_addons` links, then packages.
- Links suggested aftercare via `treatment_aftercare_templates`.
- Wraps everything in a single transaction; on failure nothing is written and the practitioner sees the row that failed.

### Safety & UX details

- Hard server-side caps: max 80 treatments, 20 categories, 30 add-ons per import to keep the AI schema bounded.
- All AI calls surface gateway errors clearly (rate limit, credits exhausted).
- Imports never overwrite existing rows silently — duplicates are flagged in the review step and default to "skip".
- Free for the practitioner; AI cost is on the platform's Lovable AI credits.

### Technical notes

- New files: `src/routes/dashboard/onboarding/ai-import.tsx`, `src/lib/ai-import.functions.ts`, `src/components/ai-import/{UploadStep,ReviewStep,ImportSummary}.tsx`, `src/lib/ai-import/schema.ts` (Zod), storage bucket migration for `ai-imports`.
- Reuses existing Firecrawl connector pattern if a URL is supplied; we will prompt to link it the first time.
- No DB schema changes required beyond the storage bucket — we write into existing `treatment_categories`, `treatments`, `addons`, `treatment_addons`, `packages`, `profiles`.

### Also addressed in this turn

The "About" page question: the old `/about` route was intentionally folded into **Welcome & policies** on the dashboard. The heading + rich-text intro saved there renders as the Welcome card on the public booking page. If it's not showing, those two fields are still empty — filling them brings it back. No code change needed.