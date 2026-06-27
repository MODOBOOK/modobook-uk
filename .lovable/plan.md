## Add-ons rebuild

### 1. Database
- New table `addons`: `name`, `price_cents`, `duration_min`, `active`, `sort`, `profile_id`. Practitioner-owned add-on items that aren't bookable on their own.
- New table `addon_links`: links one `addon` to either a `treatment_id` **or** a `treatment_category_id`, with an optional `discount_percent` per link. Either-or check constraint.
- Standard GRANTs (`authenticated` + `service_role`); `anon` SELECT on both for the public booking flow.
- RLS: practitioner CRUD on own rows; anon SELECT scoped through the profile's slug (active profiles only).
- Keep existing `treatment_addons` table untouched for now (legacy), but the UI moves to the new system.

### 2. Server functions (`src/lib/addons.functions.ts`)
- `listAddons` — practitioner: all add-ons + their current links.
- `upsertAddon` — name/price/duration/active.
- `deleteAddon`.
- `setAddonLinks({ addon_id, treatment_ids:[{id,discount}], category_ids:[{id,discount}] })` — replaces all links for one add-on (tickbox UX).
- `listAddonsForSlug(slug, treatment_ids[])` — public; returns deduped add-ons applicable to the chosen treatments (direct link OR via their category), with the best (highest) discount per add-on.

### 3. Dedicated practitioner page (`/dashboard/addons`)
- Mobile-first list of add-ons with quick edit (name, price, duration, active toggle).
- "Assign to" panel below each add-on: two collapsible groups — **Categories** and **Treatments** — each a clean tickbox list. A small `Discount %` input next to each ticked row. "Apply discount to all ticked" helper.
- Sort, delete, duplicate.
- Replace the per-treatment "Add-ons" section inside the treatment editor with a read-only summary + link to the new page (one source of truth).
- New menu tile on `/dashboard` → Add-ons.

### 4. Patient booking step
- After the treatment-selection screen and before patient details, insert a new **Add-ons** step.
- Pull `listAddonsForSlug` for selected treatments → render checkbox cards with name, +£price, +duration, original price struck through and discount badge when applicable.
- "Skip" continues with no add-ons. Selections flow through to the confirmation step, totals, and appointment record.

### 5. Bug fix (already applied)
- Tapping any patient in the client list now opens the full profile, even patients that only exist through a booking (we auto-create their clinic record on first open).

### Out of scope
- Quantity selectors (you chose tick-once).
- Migrating legacy `treatment_addons` rows — old data stays addressable but the new system supersedes it. Say the word if you want a one-shot import.
