# Demo Mode for Zoom Calls

Give admins a one-click "Launch demo" button in the Admin Console that opens two tabs: a fully-populated demo practitioner dashboard and a demo patient hub. Bookings, payments, and emails are all mocked so nothing leaves the system. A nightly cron wipes the demo data back to its seeded baseline.

## What gets built

### 1. Demo accounts (seeded via migration)
- **Demo practitioner**: `demo-clinic@modo.demo` — profile slug `demo-clinic`, full theme, logo, brand colours, hero images.
- **Demo patient**: `demo-patient@modo.demo` — linked to the demo clinic with full history.
- Both flagged with `is_demo = true` on `profiles` / `clinic_clients` so the reset cron can find them.
- Passwords stored server-side; admins never type them.

### 2. Seeded content (mirrors a real live clinic)
- 6 treatment categories, ~15 treatments with prices, durations, before/after images, add-ons, packages.
- 2 locations, 3 practitioners with photos/bios, availability rules Mon–Sat.
- 4 sample patients (incl. the demo patient) with:
  - Past + upcoming appointments spanning the week
  - Consultations with photos, face-map annotations, product logs
  - Signed consents, completed medical forms, notes
  - Treatment plans, prescriptions, aftercare
- Rewards enabled with 3 tiers, sample referrals + points ledger.
- 2 marketing automations (birthday + newsletter), 1 past campaign.
- 3 training courses (fixed date + availability modes) with 2 bookings.
- Model slots (mix of dated + flexible).
- Gallery, testimonials, reviews, FAQ.

### 3. Mock guards (no real side-effects)
A shared `isDemoContext()` helper checks whether the current profile is the demo one, and:
- `sendAppEmail` / auth emails / marketing dispatch: log + return `{ ok: true }`, never call the mail route.
- Stripe checkout/subscriptions/charge card: return simulated success responses with fake IDs.
- Push notifications: skipped.
- SMS: skipped.
- Cron jobs (reminders, rebook, review requests): skip rows where `profile.is_demo = true`.

### 4. Admin "Launch demo" button
New card in the Admin Console → User Support panel:
- **Launch practitioner view** — server fn mints a one-time login token for the demo practitioner, opens `/dashboard` in a new tab already signed in.
- **Launch patient view** — same for the demo patient, opens `/m/demo-clinic/account`.
- **Reset demo now** — manual trigger for the nightly reset (useful mid-demo).
- Uses `supabaseAdmin.auth.admin.generateLink({ type: 'magiclink' })` under the hood, gated by `has_role(admin)`.

### 5. Nightly reset cron
- New route: `src/routes/api/public/hooks/demo-reset.ts`.
- Deletes all `is_demo = true` appointments, consultations, notes, forms, consents, messages, referrals, points ledger entries, campaign sends, training bookings.
- Re-runs the seed inserts so tomorrow's demos start clean.
- Scheduled via `pg_cron` at 03:00 UTC.

### 6. Visible "Demo mode" banner
When signed in as the demo practitioner or viewing the demo public page, a subtle top banner says "Demo environment — bookings and payments are simulated." So admins never mistake it for a real clinic on a Zoom share.

## Technical notes

- New migration: `profiles.is_demo boolean`, `clinic_clients.is_demo boolean`, `appointments.is_demo boolean` (denormalised so cron cleanup is one filter), seeded rows, indexes on `is_demo`.
- New file `src/lib/demo.server.ts` with `isDemoProfile(profileId)` cache + `assertNotDemoOrMock(action)` helpers used by Stripe/email/push server fns.
- New file `src/lib/demo.functions.ts` with `launchDemoPractitioner`, `launchDemoPatient`, `resetDemoNow` — all `requireSupabaseAuth` + admin role check, then load `supabaseAdmin` inside the handler.
- New file `src/lib/demo-seed.server.ts` — pure functions that idempotently seed the demo data; used by both the migration and the reset cron.
- Admin UI edit: `src/components/admin/AdminShell.tsx` + a new `DemoLaunchCard` in the User Support tab.
- Public banner: small component rendered in `src/routes/_authenticated.tsx` and `src/routes/m.$slug.tsx` when `profile.is_demo`.
- Cron scheduled via `supabase--insert` after the route ships.

## Out of scope

- Real Stripe test-mode charges (user picked "fully mocked").
- Real email sends to a demo inbox (user picked "fully mocked").
- Live-editing seed data through a UI — seed lives in code; changes need a code edit.
