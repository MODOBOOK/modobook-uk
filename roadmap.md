# Mobile redesign — practitioner dashboard

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
- [x] MODO No-Reply sender and clinic-contact Reply-To handling
- [ ] Apply the shared design to all patient appointment emails
- [ ] Apply the shared design to clinic and staff emails
- [ ] Apply the shared design to marketing emails with unsubscribe links
- [ ] Apply an appropriate MODO-branded version to account emails
- [ ] Add preparation notes, cancellation policy, directions and social links where relevant
- [ ] Verify every template in HTML and plain text
- [ ] Switch delivery to Resend (connection was skipped)
