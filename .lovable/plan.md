## Training section

A new dedicated area for practitioners who offer aesthetics training, separate from treatments but reusing the same availability, payment and reminder plumbing.

### 1. Database

Two new tables.

**`training_courses`** — one row per course a practitioner offers.
- `profile_id`, `name`, `description`, `cover_image_url`, `active`, `sort_order`
- `mode`: `one_to_one` | `group` | `multi_day`
- `duration_min` (for 1:1 slot length)
- `price`, `deposit_amount`, `payment_mode`, `allow_split_payment`
- `capacity` (group / multi_day seat count)
- `prerequisites` (rich text) + `require_prereq_confirm` (checkbox on booking)
- `cpd_hours`, `certificate_template_url`
- `materials_html` (pre-course pack sent after booking)
- `kit_list` (what to bring — shown in confirmation + reminders)

**`training_course_sessions`** — fixed dates for group / multi-day courses.
- `course_id`, `session_date`, `start_time`, `end_time`, `location_id`, `sort_order`
- Empty for 1:1 courses (they use the practitioner's normal availability).

**`training_bookings`** — one row per trainee booking.
- `course_id`, `profile_id`, `trainee_name`, `trainee_email`, `trainee_phone`
- `status` (pending / confirmed / cancelled / completed)
- `payment_status`, `stripe_payment_intent_id`, `amount_paid`
- For 1:1: `appointment_date`, `appointment_start`, `appointment_end`, `location_id` (also mirrored into `appointments` so it blocks the calendar)
- For group/multi-day: bookings link to the course's sessions; capacity enforced by count.

RLS: practitioners manage their own courses/bookings; anon can read `active = true` courses via the existing public-profile RPC pattern.

### 2. Dashboard

New nav item **Training** under the existing dashboard.

- `/dashboard/training` — list of courses with create/edit/duplicate/archive.
- Course editor: mode picker, price/deposit, capacity (when group/multi_day), sessions editor (add dates + start/end + location), prerequisites, CPD hours, certificate template upload, materials rich-text, kit list, cover image.
- `/dashboard/training/bookings` — list of upcoming and past bookings, per-course filter, quick actions (confirm, cancel, mark complete, resend materials).

### 3. Public booking

- Clinic page `/m/{slug}` gets a **Training** tab next to Treatments, only visible when the profile has at least one active course.
- Course card shows name, price, duration/dates, CPD hours, prerequisites summary, "Book training".

Booking flow (new route `/m/{slug}/training/{courseId}`):

- **1:1 courses**: reuses the existing treatment booking engine — practitioner availability, calendar, time slots, location, payment. Creates a normal appointment plus a `training_bookings` row.
- **Group / multi-day**: shows fixed course sessions with seats remaining; trainee picks one, fills details, pays. No calendar picker.
- Prerequisites step: if `require_prereq_confirm` is on, trainee ticks "I confirm I meet these prerequisites" before payment.
- Post-booking confirmation email includes materials link + kit list.

### 4. Emails

Reuse the branded email pipeline. Two new templates:

- **Training booking confirmation** — course details, date(s), location, kit list, materials link.
- **Training reminder** — sent 24h before (piggybacks on existing appointment reminder cron for 1:1; new dispatcher for group/multi-day sessions).

### 5. Out of scope for this pass

- Model-required training (integrating model slots for training sessions).
- Automatic certificate issuance / PDF generation on completion — the template is stored; issuing is a follow-up.

### Technical notes

- New server functions in `src/lib/training.functions.ts` and `src/lib/training-public.functions.ts` (public list + booking).
- New public server route unnecessary; use existing anon publishable client via slug RPC.
- 1:1 bookings write into `appointments` so the calendar, reminders, and payments already work.
- Group/multi-day capacity enforced in the booking server function inside a transaction (`select ... for update` on the session row).
- Public tab lives in the existing `m.$slug.index.tsx` — new route `m.$slug.training.$courseId.tsx` for the booking flow.

I'll ship steps 1–4 in this pass and leave (5) as follow-ups.