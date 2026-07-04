## Email marketing for practitioners

A dedicated Marketing area in the practitioner dashboard for sending branded broadcasts to opted-in patients, with reusable segments, templates, scheduling, and per-campaign analytics. Reuses existing MODO email infrastructure (queue, suppression, unsubscribe, practitioner branding).

### 1. Consent (opt-in)

- Add `marketing_opt_in` (bool, default false) + `marketing_opt_in_at` (timestamp) to `clinic_clients`.
- Public booking form: add an explicit unticked "I'd like to receive occasional updates and offers from {clinic}" checkbox. Stores true only when ticked.
- Patient-facing "Manage preferences" page (reuses unsubscribe token flow) so patients can opt in/out any time. Unsubscribing from a marketing email flips this flag off (auth emails and transactional booking emails are unaffected — those keep using `suppressed_emails` only for hard bounces/complaints).
- Practitioner client detail view: read-only badge showing opt-in status + timestamp, plus a manual toggle (audit-logged) for in-person consent capture.

### 2. Segments (audience lists)

New table `marketing_segments` per practitioner. Each segment is either:
- **Dynamic** — filter rules evaluated at send time: last-visit window, treatment(s) received, tag, age of client record, has upcoming appointment (yes/no), gender, location.
- **Static** — a snapshotted list of client IDs (`marketing_segment_members`).

Segment builder UI: rule chips + live count preview ("Matches 142 opted-in patients"). Counts always exclude non-opted-in and suppressed addresses.

### 3. Templates & drafts

New table `marketing_templates` (practitioner-scoped). Rich composer:
- Subject, preheader, body (block-based: heading, paragraph, image, button, divider). No raw HTML input — safe blocks only.
- Automatic MODO shell wrap with practitioner logo/colour (same `getPractitionerBranding` used elsewhere).
- Variables: `{{first_name}}`, `{{clinic_name}}`, `{{unsubscribe_url}}` (auto-appended in footer if missing).
- Save as template, duplicate, delete. Drafts are campaigns with `status = 'draft'`.

### 4. Campaigns (broadcasts)

New table `marketing_campaigns`: name, subject, preheader, body_json, segment_id, status (`draft` | `scheduled` | `sending` | `sent` | `cancelled`), scheduled_for, sent_at, totals.

Send flow:
1. Compose → pick segment → preview (renders with sample patient) → send test to self → schedule or send now.
2. On send/schedule: resolve segment → filter to `marketing_opt_in = true` AND not in `suppressed_emails` → enqueue one row per recipient into a new `marketing_emails` pgmq queue with per-recipient rendered HTML and a unique `message_id` (`campaign-{campaignId}-{clientId}`).
3. Existing queue processor handles delivery, retries, DLQ, and logging into `email_send_log` (already dedupe-friendly by `message_id`).
4. Scheduled sends: `pg_cron` job every minute calls `/api/public/hooks/marketing-dispatch` which finds campaigns with `status='scheduled' AND scheduled_for <= now()` and enqueues them.

Rate/safety:
- Hard cap: max 1 campaign per practitioner per 6 hours, max 2000 recipients per campaign (raise later on request).
- Practitioner must have verified branding + a reply-to email set before first send.
- Every campaign includes the practitioner's clinic name and a one-click unsubscribe link. Footer includes clinic address if set on profile.

### 5. Analytics

Per-campaign dashboard, computed from `email_send_log` deduped by `message_id`:
- Recipients, sent, failed, suppressed, unsubscribed-from-this-campaign.
- Timeline of sends. Failure reasons table.
- Open/click tracking is **out of scope for v1** (would need tracking pixel + link rewriting infrastructure; call out as a follow-up).

Marketing overview page: last 30 days totals, most recent campaigns, unsubscribe rate trend.

### 6. Navigation

New "Marketing" section in the practitioner dashboard sidebar with three tabs: **Campaigns**, **Segments**, **Templates**. Guarded by `_authenticated` layout and practitioner role check.

---

### Technical notes

**Migrations (single migration file):**
- `clinic_clients`: add `marketing_opt_in bool default false`, `marketing_opt_in_at timestamptz`, `marketing_opt_in_source text`.
- New tables: `marketing_segments`, `marketing_segment_members`, `marketing_templates`, `marketing_campaigns`, `marketing_campaign_recipients` (join for per-recipient status/message_id).
- All in `public` with explicit `GRANT SELECT, INSERT, UPDATE, DELETE ... TO authenticated;` + `GRANT ALL ... TO service_role;` + RLS policies scoped to `practitioner_id = auth.uid()` (via existing role helpers).
- New pgmq queue `marketing_emails` created by extending the email-infra queue set (reuses existing `enqueue_email` RPC pattern; queue processor already loops over queues).

**Server functions** (`src/lib/marketing.functions.ts`, all with `requireSupabaseAuth`):
`listCampaigns`, `getCampaign`, `saveCampaignDraft`, `sendCampaignNow`, `scheduleCampaign`, `cancelScheduledCampaign`, `sendTestEmail`, `listSegments`, `saveSegment`, `previewSegmentCount`, `listTemplates`, `saveTemplate`, `getCampaignAnalytics`.

**Server route** (public, cron-called): `src/routes/api/public/hooks/marketing-dispatch.ts` — authenticates via `apikey` header, dispatches due scheduled campaigns.

**Email template**: `src/lib/email-templates/marketing-broadcast.tsx` — renders block JSON inside `ModoShell` with practitioner branding, guaranteed unsubscribe footer.

**Public booking form**: add opt-in checkbox to existing booking components; server-side flag write in `public-booking.functions.ts`.

**Unsubscribe route**: extend existing `src/routes/unsubscribe.tsx` to flip `marketing_opt_in=false` when the token was issued for a marketing send (recorded in token metadata).

### Out of scope for v1

- Open/click tracking (pixel + link rewriter).
- A/B testing, drip sequences, automations.
- Importing external contact lists (only existing `clinic_clients` are eligible).
- SMS marketing.
