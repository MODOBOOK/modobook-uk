# Mobile redesign — practitioner dashboard

## Full system audit — 20 October 2026
- [ ] Check hosted service, email delivery and security findings
- [ ] Check live patient booking links and calendars with a real signed-in account
- [ ] Audit successful Stripe payments and card capture against booking records
- [ ] Report exceptions and audit limitations without changing bookings or publishing

## Paid booking confirmation recovery
- [x] Check seven pending attempts directly against Stripe; six received zero, seventh has no metadata-matched payment
- [x] Check successful retained practitioner-account payments against MODO; all 17 linked appointments are confirmed
- [x] Remove clinic-account prerequisite in payment/card confirmation; three regression tests pass and browser invocation finds Mr Skulpt's practitioner-account intent without confirming its unpaid attempt; build OK
- [x] Check confirmation delivery for the successful practitioner-account bookings; sent confirmations found except Jordan Morrison (suppressed); Emma Tuck's two treatments share one sent confirmation

## Zero-minute booking availability
- [x] Fix zero-minute date/time availability; regression tests pass and Ryan's 0-minute Personalised Program shows selectable times on 6 November in preview

## Model-slot locations
- [x] Restrict assigned slots to the selected location in both public lists; both location-rule tests pass (Ryan's current treatment eligibility prevents a populated-slot browser check)

## Model-slot booking mismatch
- [x] Release cancelled appointment model-slot claims and repair Supreme's stale slots
- [x] Verify cancellation regression and preserve confirmed bookings
- [x] Hide other practitioners' model slots once a patient picks someone, and refuse mismatches server-side; published to modobook.uk 19 Oct (live check: Supreme badge 8 -> 7 for Rebecca; no clinic currently has an open practitioner-assigned slot, so that exact case is covered by tests only)

## Practitioner messages
- [x] List clinics with no recorded sign-in for four weeks and flag The Nursing Lab's seven upcoming bookings
- [x] Draft one-week account-deletion notice and send Ryan one test only; no clinic sends or deletion scheduled
- [x] Check founding-price messages within practitioner pages
- [x] Remove early-feature-access contact invitation and verify in preview

Goal: MODO runs in an app WebView; dashboard must feel native on phones.

- [x] Global mobile CSS: 44px tap targets, larger inputs, no horizontal overflow
- [x] Dialogs become bottom sheets on phones (safe-area aware, slide up)
- [x] Bottom tab bar: 5 tabs with centre "New" booking button
- [x] Dashboard home: tighter mobile spacing
- [x] Month calendar: compact cells on phones (count badge only)
- [ ] User to review on phone and flag any screens still cramped
- [x] Let configured prescribing-clinic windows override the clinic's normal closed-day message
- [x] Stop Kerri Roma's clinic emails while imported bookings are reviewed
- [x] Prevent temporary billing-check failures from locking paid clinics out
# Supreme patient CSV import

- [x] Load all active and archived patients beyond 1,000
- [x] Prevent repeat imports recreating archived or duplicate patients
- [x] Verify Supreme list and import behavior


# Desktop sidebar parity with phone menu

- [x] Shared menu data module (single source for phone Menu + desktop sidebar)
- [x] Desktop sidebar rebuilt from the phone Menu groups (same items, same order)
- [x] Mobile-only features now on desktop: Memberships, Workspace appearance, Find a prescriber, SMS Marketing, admin
- [x] Verify signed-in in the browser

## Products & stock section (done 23 Sep 2026)
- [x] products / product_purchases / treatment_products tables with owner+staff RLS
- [x] src/lib/products.functions.ts (list, upsert, delete, logPurchase, adjustStock, treatment links)
- [x] /dashboard/products page: totals strip, product cards, purchase log, treatment-link dialog
- [x] Menu item "Products & stock" under Payments (owner/admin only via staff-nav)
- [ ] Commission: deduct product cost before split (next step, awaiting go-ahead)

# Email design system
- [x] Modern clinic-branded booking confirmation and optional clinic imagery
- [x] Appointment, payment, manage-booking and calendar details
- [x] Clinic-name-only sender and clinic-contact Reply-To handling
- [x] Apply the shared design to all patient appointment emails
- [x] Apply the shared design to clinic and staff emails
- [x] Apply the shared design to marketing emails with unsubscribe links
- [x] Apply an appropriate MODO-branded version to account emails
- [x] Add preparation notes, cancellation policy, directions and social links where relevant
- [x] Verify every template in HTML and plain text
- [x] Group all booking medical and consent forms into one patient email
- [x] Booking confirmation buttons: manage appointment, Google Calendar and Apple Calendar
- [ ] Switch delivery to Resend (connection was skipped)

# Clinic-wide rebook reminders
- [x] Add an optional clinic-wide reminder after 90 days without a visit
- [x] Exclude patients who already have an upcoming booking
- [x] Send one follow-up 30 days later, then stop until another completed visit
- [x] Keep treatment-specific rebook and top-up reminders available
- [x] Verify the settings screen and reminder email in preview
