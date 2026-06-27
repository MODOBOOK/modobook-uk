# Expansion Plan — Categories, Theming, Marketing & MODO Consultations

This builds on the existing foundation (Stripe Connect, treatments, bookings, clinic page) — nothing already built is rebuilt.

---

## 1. Categories & Subcategories (unlimited depth)

**New table `treatment_categories`**
- `id`, `profile_id`, `parent_id` (self-ref, nullable), `name`, `slug`, `sort_order`, `icon`, `description`
- Recursive — a category can have children which can have children
- RLS: practitioners CRUD their own; public anon SELECT for active clinics

**Treatment link**: add `category_id` (nullable FK) to `treatments`.

**Dashboard UI**: tree editor at `/dashboard/categories` — drag to reorder, nest, rename, delete (cascade with confirmation).

**Public page**: treatments grouped by category, expandable tree.

---

## 2. Theme Customisation (tokens + section layout)

**New table `clinic_theme`** (1:1 with profile)
- Colors: `primary`, `accent`, `background`, `surface`, `text`, `muted`
- Typography: `heading_font`, `body_font` (preset list of ~12 Google Fonts via `@fontsource`)
- Shape: `border_radius` (none / sm / md / lg / pill), `border_width`, `border_color`
- Buttons: `button_style` (solid / outline / ghost), `shadow_intensity`

**New table `clinic_sections`**
- `id`, `profile_id`, `section_type` (hero / about / treatments / gallery / testimonials / packages / contact), `sort_order`, `visible`, `background_color`, `settings` (jsonb for per-section options)

**Dashboard UI**: `/dashboard/appearance` — live preview iframe, color pickers, font dropdowns, slider for radius. Drag-reorder section list, eye-icon toggle visibility.

**Public page**: reads tokens into CSS variables on the root, renders sections in `sort_order` filtered by `visible`.

---

## 3. Marketing Integrations (per practitioner)

**New table `marketing_settings`** (1:1 with profile)
- `email_provider` (lovable_emails / resend / mailchimp), `email_from_name`, `email_from_address`
- `sms_provider` (twilio), `twilio_account_sid_secret_ref`, `twilio_phone`
- `review_request_enabled`, `review_request_delay_hours`, `review_url` (Google/Trustpilot)

**New table `marketing_campaigns`**
- For one-off / scheduled email blasts to the practitioner's patient list

**New table `patient_consents`** (already implicit in patients) — add `marketing_email_opt_in`, `marketing_sms_opt_in`, `unsubscribed_at`

**Server functions**:
- `sendMarketingEmail` → via Lovable Emails (queue) for default, gateway for Resend/Mailchimp
- `sendSms` → Twilio via stored secret (per-practitioner BYOK)
- Scheduled job: after appointment `completed_at + delay`, fire review-request email/SMS

**Dashboard UI**: `/dashboard/marketing` — campaign composer, Twilio connect, review automation toggle.

---

## 4. MODO — 8-Step Consultation Flow

**New tables**:
- `consultations` — `id`, `profile_id`, `patient_id`, `appointment_id` (nullable), `status` (draft / in_progress / completed / invoiced / paid), `current_step` (1–8), `started_at`, `completed_at`
- `consultation_medical` — step 1: jsonb of medical questionnaire answers (tick-box schema configurable per practitioner)
- `consultation_concerns` — step 2: jsonb tick-box concerns + free text
- `consultation_assessment` — step 3: notes, `face_map_data` (jsonb of marked points + annotations on a face SVG), before-pictures FK list
- `consultation_treatment_plan` — step 4: free text recommendations + selected treatment IDs
- `consultation_consents` — step 5: FK to `consent_forms` + `signature_svg` (canvas → svg path string) + `signed_at` + `patient_ip`
- `consultation_after_pictures` — step 6: image FK list
- `consultation_treatment_log` — step 7: `product_name`, `batch_number`, `expiry_date`, `dosage`, `injection_sites` (jsonb), `lot_notes`
- `consultation_invoices` — step 8: amount, line items, `stripe_payment_link_url`, `sent_to_email`, `sent_at`, `paid_at`

**New tables for templates (practitioner-customisable)**:
- `medical_form_templates` — practitioner-defined tick-box schemas reused across patients
- `concern_templates`
- `consent_form_templates` — rich text with merge-fields `{{patient_name}}`, `{{treatment}}`, etc.

**Storage**: new buckets — `consultation-photos` (private, signed URLs), `signatures` (private).

**Dashboard UI**: `/dashboard/consultations` list + `/dashboard/consultations/$id` wizard
- Left rail: 8 numbered steps with completion ticks
- Persist on every step (autosave)
- Face map: SVG of front + side face, click to drop pins, label each pin
- Signature pad: `react-signature-canvas`
- Step 8: generates a Stripe Payment Link (via practitioner's Connect account) → emails patient via Lovable Emails with secure pay button

**Patient access (optional later)**: tokenised link so the patient can complete Step 1 (medical form) and Step 5 (sign consent) themselves on their phone.

---

## 5. Build Order

1. **Categories** (foundation — treatments depend on it)
2. **Theme + sections** (visual layer, unblocks UI polish)
3. **MODO consultations** (largest — split into sub-PRs):
   - 3a. Tables + dashboard list + Step 1–2 (medical + concerns)
   - 3b. Step 3 face map + photo uploads (before)
   - 3c. Step 4–5 plan + consent signature
   - 3d. Step 6–7 after photos + treatment log
   - 3e. Step 8 Stripe Payment Link + email invoice
4. **Marketing** (depends on Lovable Emails setup + patient opt-in fields)
   - 4a. Lovable Emails infra + opt-in fields
   - 4b. Twilio connect + SMS sending
   - 4c. Automated review requests (cron-style trigger on appointment completion)

---

## Technical Notes (skip if not technical)

- All new tables: `profile_id` scoped RLS, `GRANT` blocks, `updated_at` triggers.
- Face map: store as `{ pins: [{ x, y, view: 'front'|'side', label, color }] }`.
- Signatures: capture as base64 PNG → upload to `signatures` bucket → store path.
- Payment Links use the practitioner's Connect account ID (`Stripe-Account` header) so funds route correctly with 0% platform fee.
- Marketing emails go through Lovable Emails queue by default; only switch to Resend/Mailchimp on practitioner request to keep deliverability tied to one verified domain.
- Twilio credentials stored as per-practitioner Vault secrets (not platform secret) — needs an `add_secret` style flow inside the dashboard.

---

This is roughly a 4–6 turn build. I'll start with Categories once you approve, then work down the list. Tell me if you want to drop, defer, or reorder anything.
