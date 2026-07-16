## Marketing setup — full plan

The project already has: campaigns dashboard, segments, templates, block-based composer with images/buttons/dividers, send + schedule + test, opt-in on `clinic_clients`, `email_unsubscribe_tokens` table, and a `/unsubscribe` route. What's missing to make it "really good":

### 1. Fix unsubscribe (currently broken in marketing emails)

Marketing broadcast footer links to `/unsubscribe` **without a token**, so patients can't actually unsubscribe from a campaign.

- In `enqueueAppEmail` (send.server.ts), when the template is `marketing-broadcast`, overwrite `templateData.unsubscribeUrl` with `https://modobook.uk/unsubscribe?token=<token>` after the per-email token is resolved.
- Remove the hardcoded `unsubscribeUrl` passed from campaign dispatch and test-send in `marketing.functions.ts`.
- Result: every campaign email gets a real one-click unsubscribe link + working `List-Unsubscribe` header. Suppressed/unsubscribed recipients are already auto-skipped on send.

### 2. Richer composer (matches "Rich text, CTAs, merge tags, test send")

Test send already exists. Add:

- Merge-tag helper in the composer: buttons that insert `{{first_name}}`, `{{clinic_name}}`, `{{last_treatment}}` at cursor for heading/paragraph/button fields.
- New block type `rich_text` (paragraph with basic inline HTML: **bold**, *italic*, links) rendered safely (whitelist only b/i/strong/em/a). Existing `paragraph` stays.
- CTA button already supported — surface a "Book now" quick-add that pre-fills the practitioner's booking URL from `profiles.slug`.
- Preview panel next to the editor shows the current block list rendered in a compact card so you don't have to send a test to see it.
- Add `{{last_treatment}}` resolution in dispatch (join latest appointment.treatment name per recipient) and pass into `templateData`.

### 3. Recurring automations (day-one set)

Ship four automation types under `marketing_automations` (new table):

- **Birthday** — patients whose `date_of_birth` month/day = today, sent at 9am practitioner-time.
- **Treatment-interval** — X weeks after last appointment of treatment Y (e.g. 8 weeks after Botox). Multiple rules per practitioner.
- **Win-back** — no visit in N days.
- **Monthly newsletter** — recurring on Nth of month, uses a picked template.

Each automation stores: `name`, `type`, `enabled`, `template_id` (reuses `marketing_templates`), `config_json` (interval, treatment_id, day-of-month etc.), `last_run_at`. Practitioners can also make **custom** ones by picking any template and a schedule.

A single `/api/public/hooks/marketing-automations` route runs hourly via pg_cron; for each enabled automation it materialises today's recipient list, dedupes against a new `marketing_automation_sends` log (so nobody gets the same birthday email twice), and enqueues emails through the same `tryEnqueueAppEmail` path with `marketing-broadcast` template + branding.

### 4. Scheduled-send worker

`processScheduledCampaigns()` exists but isn't wired to cron. Add pg_cron job hitting `/api/public/hooks/marketing-dispatch` every 5 minutes (auth via `apikey` header) so `scheduled_for` campaigns actually fire.

### 5. Segment builder polish

Segment page already covers tags/last-visit/treatments/upcoming. Add:

- "Birthday this month" checkbox (dynamic rule).
- Live count preview (already exists in `previewSegmentCount`) shown on the campaign editor when a segment is picked.

### 6. Compliance & footer

- Every marketing email footer already shows clinic name + unsubscribe. After fix #1, clicking unsubscribe records `suppressed_emails` + marks token used → all future marketing (and app) emails skip that address automatically.
- Add a small "Marketing consent" note next to the opt-in toggle in patient profile explaining what they're consenting to.

### Technical summary

- Migration: `marketing_automations`, `marketing_automation_sends` tables + RLS + GRANTS.
- New file: `src/routes/api/public/hooks/marketing-automations.ts` — hourly cron entry.
- New file: `src/routes/api/public/hooks/marketing-dispatch.ts` — 5-min cron entry for scheduled campaigns.
- New file: `src/routes/_authenticated/dashboard.marketing.automations.tsx` — CRUD UI.
- Edit: `src/lib/marketing.functions.ts` — add automation CRUD + `last_treatment` merge; drop hardcoded unsubscribe URLs.
- Edit: `src/lib/email/send.server.ts` — inject tokenised unsubscribe URL for `marketing-broadcast`.
- Edit: `src/routes/_authenticated/dashboard.marketing.campaigns.$id.tsx` — merge-tag chips, "Book now" quick-add, live segment count.
- Edit: `src/lib/email-templates/marketing-broadcast.tsx` — support `rich_text` block with whitelisted inline HTML.
- pg_cron: two schedules pointing at the two hook routes.

### Out of scope (say so upfront)

- Open/click tracking pixels (would need extra domain plumbing) — noted for later.
- Drip sequences (multi-step series) — you said one-off + scheduled + recurring; skipping until requested.
- SMS — email only per your answers.
