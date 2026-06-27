Aesthetic Practitioner Booking Platform

Goal: A full booking platform where practitioners customise their own clinic page, treatments, packages, and consultations. Patients book and pay via a public link (`/book/{slug}`) using the practitioner's own Stripe account via Stripe Connect, with Klarna/Clearpay available at a 5% surcharge.

## Product scope

### Public patient flow
- Public clinic homepage at `/book/{practitionerSlug}` (SSR-friendly, custom branded).
- Practitioner controls: hero image, headline, intro/about, gallery, testimonials, contact info, booking CTA — all editable from the dashboard (no developer needed).
- Treatments, packages, and consultations are listed for booking.
- Booking flow:
  1. Patient picks a treatment / package session redemption / consultation.
  2. Selects optional add-on treatments (each with own duration/price).
  3. Picks an available date and time slot.
  4. Enters name, email, phone, notes.
  5. Reviews & signs/uploads consent forms required for the chosen treatments.
  6. Picks a payment method: card (Stripe), Klarna, or Clearpay.
     - If Klarna/Clearpay selected, total is recalculated to include a 5% surcharge and shown clearly before confirming.
  7. Stripe Checkout/Embedded for payment (full amount, deposit, or pay-in-clinic depending on treatment setting).
  8. Confirmation page + email.

### Patient packages (prepaid credits)
- Practitioner creates packages (e.g., "6 × Microneedling" for £900).
- Patient buys package via Stripe Connect; package becomes credit balance tied to patient email.
- When booking, patient enters email; if they have unused credits for that treatment, they redeem instead of paying again.
- Each redemption decrements credits; expiry date optional.

### Consultations (paid, deductible)
- Special treatment type with `is_consultation = true`, price, and `deductible_against` linked treatment IDs.
- When a patient books one of the linked treatments within X days of a paid consultation, the fee is deducted from the treatment total at checkout.

### Practitioner dashboard (`/dashboard`, authenticated)
- **Clinic page editor**: hero image, tagline, about, gallery (multi-image upload), testimonials, address, social links, brand colour.
- **Treatments**: name, description, duration, price, picture, consent form upload, timing notes, payment mode (full / deposit / pay-in-clinic), deposit amount, add-on treatments selector, `is_consultation` flag, `deductible_against` treatments.
- **Packages**: name, included treatment, session count, price, expiry days.
- **Availability**: weekly recurring slots, slot interval, blocked dates.
- **Appointments**: upcoming/past list, filter by status, view patient details + uploaded consent.
- **Patients**: list with their package credits and history.
- **Payments**: list of Stripe transactions, refunds.
- **Stripe Connect**: onboarding link, status, payouts.

### Auth
- Email/password + Google sign-in via Lovable Cloud.
- Profiles table with role (`practitioner`).
- First-time practitioner setup wizard (clinic name, slug, branding).

## Database schema
1. `profiles` — practitioner profile + clinic settings (slug, clinic_name, hero_url, tagline, about, brand_color, address, phone, social, active, stripe_connect_account_id, stripe_connect_onboarding_status).
2. `clinic_gallery` — images for clinic homepage.
3. `clinic_testimonials` — author, quote, rating.
4. `treatments` — name, description, duration, price, picture, consent_form_url, payment_mode, deposit_amount, is_consultation, deductible_against (uuid[]), deductible_window_days.
5. `treatment_addons` — parent_id ↔ addon_id (many-to-many).
6. `packages` — name, treatment_id, session_count, price, expiry_days, active.
7. `package_purchases` — patient_email, package_id, sessions_remaining, expires_at, stripe_payment_intent_id.
8. `availability_rules` — day_of_week, start_time, end_time, slot_interval.
9. `blocked_dates` — practitioner_id, date, reason.
10. `appointments` — practitioner_id, treatment_id, addon_ids, patient_name/email/phone/notes, scheduled_date, start_time, end_time, status, consent_signed_url, payment_status, payment_method, base_amount, surcharge_amount, total_amount, stripe_payment_intent_id, package_purchase_id.
11. `payments` — practitioner_id, appointment_id, package_purchase_id, amount, stripe_payment_intent_id, status.
12. RLS: practitioners manage only their own data; public read for clinic page, treatments, packages, availability of active practitioners; checkout writes happen via server functions using admin client after validation.

## Storage buckets
- `clinic-assets` (public): hero/gallery/treatment images, consent form templates.
- `consent-uploads` (private, signed URLs): patient-signed consent files.

## Stripe integration (Stripe Connect, bring-your-own-platform key)
- The platform owner provides a Stripe Platform Secret Key (`STRIPE_PLATFORM_SECRET_KEY`) stored as a secret.
- Each practitioner onboards their own Stripe Connect account via an onboarding link generated in their dashboard.
- Checkout sessions are created with `stripe_account: practitioner.stripe_connect_account_id` so funds go directly to the practitioner.
- Platform fee is 0%.
- Payment methods: card (default), Klarna, Clearpay (Afterpay). If Klarna/Clearpay is selected, the checkout total is pre-computed to include a 5% surcharge and stored separately on the appointment for reporting.
- Webhook handler at `/api/public/hooks/stripe` verifies signature, marks appointments/packages as paid, decrements credits when consultation is deducted, sends confirmation email.

## Server functions / routes
Public (no auth):
- `getClinic(slug)`, `getTreatments(slug)`, `getPackages(slug)`, `getAvailability(slug, date)`
- `checkPackageCredits(email, treatmentId)`
- `createBookingCheckout({ treatmentId, addonIds, slot, patient, paymentMethod, packageRedemption? })`
- `createPackageCheckout({ packageId, patient })`
- `/api/public/hooks/stripe` (webhook)

Authenticated (`requireSupabaseAuth`):
- Profile / clinic page CRUD
- Treatment / addon / package CRUD
- Availability + blocked date CRUD
- Appointments list, status updates, refund initiation
- Stripe Connect onboarding link generation

## Routes
- `/` — marketing landing for the platform itself.
- `/auth` — sign in / sign up.
- `/book/{slug}` — public clinic homepage.
- `/book/{slug}/checkout` — booking flow steps.
- `/book/{slug}/confirmation/{appointmentId}` — confirmation.
- `/dashboard` — overview (today's appointments, revenue this month).
- `/dashboard/clinic` — clinic homepage editor.
- `/dashboard/treatments` — treatments + add-ons + consultations.
- `/dashboard/packages` — package builder.
- `/dashboard/availability` — weekly schedule + blocked dates.
- `/dashboard/appointments` — calendar/list view.
- `/dashboard/patients` — patients & their credits.
- `/dashboard/payments` — Stripe transactions.
- `/dashboard/settings` — profile, branding, Stripe Connect status.

## Pricing math (Klarna/Clearpay surcharge)
- Base total = treatment + add-ons − deductible consultation credit.
- If Klarna/Clearpay: displayed total = round(base × 1.05, 2 dp). Surcharge stored separately on appointment for reporting.
- Surcharge logic lives server-side in `createBookingCheckout` so it can't be bypassed.

## UI/Design
- Clean clinical-luxury aesthetic: soft neutrals, generous whitespace, rounded cards, subtle gold/blush accents (configurable per clinic via brand_color).
- Mobile-first booking flow with progress stepper.
- shadcn/ui components throughout.

## Build order
1. Configure Google auth + store Stripe platform secret.
2. Migrations for full schema + RLS + GRANTs.
3. Create storage buckets.
4. Auth pages + `_authenticated` dashboard layout.
5. Practitioner onboarding wizard (slug, clinic name, Stripe Connect onboarding).
6. Clinic page editor + treatments CRUD + add-on linking.
7. Packages + consultations configuration.
8. Availability + blocked dates.
9. Public clinic homepage (`/book/{slug}`).
10. Booking flow with slot generation + consent + payment-method picker + surcharge math.
11. Stripe Connect Checkout integration + webhook.
12. Package credits redemption + consultation deduction logic.
13. Appointments / patients / payments dashboards.
14. Confirmation emails (Resend or Lovable AI fallback).
15. Verify with Playwright end-to-end.
