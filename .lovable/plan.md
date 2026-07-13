
Three related additions to the Locations + manual booking flow.

## 1. Hidden (private) locations

Right now `locations.active` fully hides a location everywhere. You want a middle state: a location that is **hidden from the public booking page** but still usable when you book someone in manually (e.g. message-only bookings, VIP address, prescriber visits).

- Add `locations.is_public` boolean, default `true`.
- Dashboard → Locations: new toggle **"Show on public booking page"** on each location (on = public, off = private/internal-only). `active` stays as the master on/off.
- Public booking page (`/m/{slug}` and `/book/{slug}`) filters to `active = true AND is_public = true` — hidden locations disappear from the public picker, map, and treatment→location price display.
- Internal new-appointment picker, patient hub, admin views: show every `active = true` location regardless of `is_public`, with a small "Private" pill on the hidden ones so you know.
- Practitioner assignments (`location_practitioners`) still work — a practitioner who only takes bookings by message can be assigned to a private location and stay off the public page entirely.

## 2. Private price list per location

Per-location pricing already exists in the database (`treatment_location_pricing`: price + duration + available-per-location) and is editable under **Dashboard → Services** on each treatment. What's missing is discoverability from the Locations page.

- Locations page: on each location card add a **"Price list"** link that opens a dialog listing every treatment with editable price, duration, and an available-here toggle for that location. Saves through the existing `setTreatmentLocationPricing` server fn — no schema change.
- Private locations use the same table, so a hidden location can carry an entirely different (private) price list without affecting the public one.
- Manual bookings already let you type any price per treatment line — that stays.

## 3. Mark deposit / payment as already paid on manual bookings

Today the manual booking flow can only *send* a Stripe deposit link. You want to also record that a deposit (or the full amount) has already been taken outside the app — cash, bank transfer, terminal, etc.

New section on the New Appointment page, above the Stripe deposit block:

- **"Deposit already paid"** checkbox → amount field + method (cash / card in person / bank transfer / other) + optional reference. On save, sets `appointments.deposit_paid_at = now()`, `deposit_required_cents = amount`, and writes a row in `payments` with the chosen method so it shows in reporting.
- **"Mark full payment as received"** checkbox → sets `payment_status = 'paid'`, `amount_paid_cents = total`, same method dropdown, same `payments` row.
- The two are mutually exclusive with the "Send Stripe deposit link" option — picking one hides the others so you can't double-charge.

Same controls also appear on the appointment detail view so you can tick "deposit paid" after the fact if someone pays on arrival.

## Technical notes

- Migration: `ALTER TABLE public.locations ADD COLUMN is_public boolean NOT NULL DEFAULT true;` and update the two public-booking server fns (`practitioner-public.functions.ts`, `public-booking.functions.ts`) to add `.eq("is_public", true)` on the locations queries. No RLS changes needed — reads are already scoped correctly.
- Locations upsert (`upsertLocation`) gains an `is_public` field.
- New server fn `markAppointmentPaymentReceived({ appointment_id, kind: 'deposit'|'full', amount_cents, method, reference })` under `appointments.functions.ts`, gated by `requireSupabaseAuth` + owner check, writing to `appointments` + `payments` in a single call.
- New Appointment page state gets `paidMode: 'none' | 'deposit_paid' | 'full_paid' | 'send_link'` to keep the three options mutually exclusive.
- No changes to Stripe, webhooks, or the split-payment flow.

## Out of scope for this pass

- Refund/void tooling for manually-marked-paid appointments (can be added later; for now editing/deleting the appointment is the escape hatch).
- Per-practitioner private price lists (only per-location for now — matches the schema).
