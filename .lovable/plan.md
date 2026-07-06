## Treatment Plans

A multi-session course of treatments a practitioner proposes to a patient (often after a consultation), which the patient reviews in their hub, accepts, then books and pays for under the practitioner's chosen rules.

### Data model (new tables)

**`treatment_plan_templates`** — reusable plans practitioner builds once
- `profile_id`, `name`, `description`, `default_interval_weeks`
- `booking_mode` `'upfront' | 'rolling'`
- `payment_mode` `'per_session' | 'course_upfront' | 'deposit_then_per_session'`
- `course_price_cents` (nullable, for upfront), `deposit_cents` (nullable)
- `is_active`

**`treatment_plan_template_items`**
- `template_id`, `treatment_id`, `session_number`, `interval_weeks_from_previous`, `notes`

**`treatment_plans`** — a plan assigned to a specific patient
- `profile_id` (practitioner), `client_id` (`clinic_clients.id`)
- `consultation_id` (nullable), `template_id` (nullable)
- `name`, `description`
- `booking_mode`, `payment_mode`, `course_price_cents`, `deposit_cents`
- `status` `'draft' | 'sent' | 'accepted' | 'declined' | 'in_progress' | 'completed' | 'cancelled'`
- `sent_at`, `accepted_at`, `completed_at`

**`treatment_plan_sessions`**
- `plan_id`, `session_number`, `treatment_id`
- `interval_weeks_from_previous`
- `suggested_date` (nullable)
- `appointment_id` (nullable — set when booked)
- `status` `'pending' | 'booked' | 'completed' | 'skipped'`
- `notes`

RLS: practitioner owns rows via `profile_id = auth.uid()`; patient reads their own plans via `clinic_clients` link (email/phone match through existing `patient-hub` pattern).

### Practitioner UX

- **New route `/dashboard/treatment-plans`** — list templates, create/edit template with drag-to-order sessions.
- **On patient profile (`dashboard.patients.$id`)** — "Treatment plans" section: create from template / build manually / view existing. Shows progress "2 of 6 completed".
- **On consultation page (`dashboard.consultations.$id`)** — "Create treatment plan from this consultation" button → prefills `consultation_id`, opens plan builder.
- Plan builder lets practitioner pick booking mode + payment mode per plan.
- "Send to patient" action sets status → `sent`, emails patient a summary with a hub link.

### Patient UX (hub)

- **New tab in `/hub` — "Treatment plans"** shows all sent/accepted plans.
- Plan detail page: overview card (progress bar, X of Y sessions), list of sessions with dates/status, "Accept plan" CTA when `sent`.
- After acceptance:
  - `upfront` booking → picks all session dates in one flow with suggested intervals prefilled
  - `rolling` → book session 1 now, after each completed appointment show "Book your next session" prompt
- Payment enforced at booking based on `payment_mode`:
  - `per_session` → normal per-appointment payment
  - `course_upfront` → single Stripe checkout for `course_price_cents` on acceptance, all subsequent bookings free
  - `deposit_then_per_session` → `deposit_cents` on acceptance, remainder per session
- Existing `BookingPaymentPicker` reused; plan enforces which options appear.

### Emails

- New app email template `treatment-plan-sent`: branded summary listing sessions + CTA button to hub plan page.
- Triggered on "Send to patient".

### Server functions (new file `src/lib/treatment-plans.functions.ts`)

- `listPlanTemplates`, `upsertPlanTemplate`, `deletePlanTemplate`
- `createPlanForClient` (from template or blank; optional `consultation_id`)
- `listPlansForClient`, `getPlan` (practitioner)
- `updatePlan`, `sendPlan`, `cancelPlan`
- `getPlanForPatient` (auth as patient via hub), `acceptPlan`, `declinePlan`
- `bookPlanSession` (links appointment to session), auto-called from existing booking flow when `?planSession=<id>` query param present
- `markSessionCompleted` (called from webhook / appointment completion)

### Integration points

- Extend `checkout.session.completed` webhook and appointment completion path to update `treatment_plan_sessions.status` when the appointment ties to a plan session.
- Extend `BookingPaymentPicker` / `m.$slug.pay` to accept `planSessionId` and enforce plan payment rules.

### Rollout order in this build

1. Migration (tables + RLS + grants).
2. Server functions.
3. Practitioner: templates page, patient-profile section, consultation button.
4. Patient hub: plans tab + detail + accept flow.
5. Booking integration + email template.
