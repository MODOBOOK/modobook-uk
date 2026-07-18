# MODO platform billing

Bills practitioners for using MODO on your existing Stripe account. Reuses the plans / subscriptions / checkout scaffolding already in place and adds add-ons, a 30-day free trial, discount codes, enforcement, a practitioner-facing billing page, and full admin controls.

## 1. What practitioners see

New page: **Dashboard → Billing**.
- Trial banner counting down "X days left in your free trial".
- Current plan card (name, price, next renewal date).
- Add-ons: **+1 location** and **+1 practitioner** with `+/−` steppers; changes prorate via Stripe.
- Discount code box — apply a code you've issued.
- "Manage payment method / invoices" opens Stripe Customer Portal.
- Cancel / resume subscription buttons.

New practitioners get an automatic `trialing` subscription row on first sign-in (30-day trial, no card required). At day 30 they're prompted to add a card; if they don't, dashboard goes read-only and their public `/m/slug` page shows "Temporarily unavailable" until they pay.

## 2. What admins see (extends the existing Admin → Subscriptions section)

Plan management:
- Create **base** plans (MODO Standard £X/mo) and **add-on** plans (Extra location £Y, Extra practitioner £Z) — a `kind` field distinguishes them.
- Activate / deactivate plans.

Per practitioner:
- Assign / change base plan.
- Set add-on quantities (locations, practitioners).
- **Custom price** override (bespoke £/mo for this practitioner only — creates a one-off Stripe price).
- **Comp** toggle (fully free, keeps access, no Stripe charge).
- **Apply discount code** to their subscription.
- **Extend trial** (push `trial_end` forward N days).
- **Force-suspend** / reactivate immediately (independent of Stripe state).
- **Refund last invoice** (via Stripe).
- **Open in Stripe** deep link to the customer/subscription for anything not exposed in-app.

Discount codes:
- New "Discount codes" card. Create codes with percent-off or amount-off, once / forever / N months, expiry, max redemptions. Creates matching Stripe coupon + promotion code so it works at checkout and via `applyDiscountToSubscription`.

Audit: every admin action here writes to `admin_audit_log`.

## 3. Enforcement

A single `practitioner_has_platform_access(profile_id)` SQL function is the source of truth. It returns true when the practitioner is `comped`, has an active/trialing Stripe subscription, or `trial_end` is still in the future.

- Dashboard root loader calls it; if false, renders a "Subscription required" screen with a Stripe checkout button and Sign out (no other pages accessible).
- Public booking page (`m.$slug`) checks it via the existing public server fn; if false, shows a neutral "This clinic is temporarily unavailable" message and hides treatments/booking.

## 4. Database changes (one migration)

```text
subscription_plans
  + kind text (base | addon_location | addon_practitioner)  default 'base'
  + default_trial_days int  default 30

practitioner_subscriptions
  + trial_end timestamptz
  + custom_price_cents int
  + extra_locations int  default 0
  + extra_practitioners int  default 0
  + discount_code_id uuid  FK platform_discount_codes(id)
  + comped boolean  default false
  + suspended_at timestamptz
  + stripe_addon_items jsonb  (map plan_id -> stripe subscription item id)

platform_discount_codes  (new)
  id, code (unique), description,
  percent_off, amount_off_cents,
  duration (once | forever | repeating), duration_in_months,
  max_redemptions, redemptions, expires_at, active,
  stripe_coupon_id, stripe_promo_code_id,
  created_at, updated_at
  RLS: admins manage; also SELECT-by-code for authenticated (needed for practitioner code lookup)

function practitioner_has_platform_access(_profile_id uuid) returns boolean
  SECURITY DEFINER; true when comped, or status in (active, trialing),
  or trial_end > now(); false when suspended_at is set.

trigger on auth.users insert (practitioner role):
  auto-create practitioner_subscriptions row with status='trialing',
  trial_end = now() + 30 days.
```

All new tables get GRANTs to `authenticated` and `service_role`.

## 5. Server functions

Extend `src/lib/admin-subscriptions.functions.ts`:
- `createAddonPlan` (kind = addon_location | addon_practitioner)
- `setPractitionerAddons({ profileId, extraLocations, extraPractitioners })` — updates DB and, if a live Stripe sub exists, upserts subscription items with `proration_behavior: 'create_prorations'`.
- `setCustomPrice({ profileId, cents })` — creates a one-off Stripe price and swaps the base subscription item.
- `applyDiscountToSubscription({ profileId, codeId })` — attaches Stripe coupon.
- `compPractitioner({ profileId, comped })`.
- `extendTrial({ profileId, days })` — updates DB `trial_end` and, if Stripe sub exists, `trial_end` on Stripe.
- `forceSuspend({ profileId, suspended })`.
- `refundLastInvoice({ profileId })`.
- `openStripeCustomerLink({ profileId })` → returns dashboard deep link.
- `listPlatformDiscountCodes`, `createPlatformDiscountCode`, `updatePlatformDiscountCode`.

New `src/lib/practitioner-billing.functions.ts` (auth'd, self-scoped):
- `getMyBilling()` — subscription + plan + addons + trial_end + access status.
- `startBillingCheckout({ successUrl, cancelUrl })` — Stripe Checkout with base + addon line items, `subscription_data.trial_end` from DB, allow_promotion_codes true.
- `openStripePortal({ returnUrl })` — Stripe Billing Portal session.
- `updateMyAddons({ extraLocations, extraPractitioners })`.
- `redeemDiscountCode({ code })`.
- `cancelMySubscription()` / `resumeMySubscription()`.

Update the existing Stripe webhook (`src/routes/api/public/stripe/webhook.ts`) to handle `customer.subscription.created/updated/deleted` and `invoice.payment_failed/succeeded` for platform subscriptions — set `status`, `current_period_end`, `trial_end`, `cancel_at_period_end`, and clear `suspended_at` on successful payment.

## 6. UI

New file `src/routes/_authenticated/dashboard.billing.tsx` (Billing page above).
New tile in the dashboard menu linking to it.
`src/routes/_authenticated/admin.tsx` — extend `SubscriptionsSection`: plan `kind` selector in `NewPlanDialog`, per-practitioner drawer with Custom price / Add-ons / Trial extension / Comp / Suspend / Discount / Refund / Open in Stripe, and a new `DiscountCodesCard`.
`src/routes/_authenticated/dashboard.tsx` (layout) — call `practitioner_has_platform_access` in loader; if false, render `<SubscriptionRequiredScreen />` instead of children.
`src/routes/m.$slug.tsx` — hide booking surface when access is false.

## 7. Out of scope for this pass

- Usage-based fees on patient bookings (kept flat + add-ons per your answer).
- Yearly plans with annual-discount logic (Stripe interval switch already supported at plan level).
- Team-seat management UI beyond a numeric add-on count.

Ready to implement — I'll ship this as one migration plus the server functions and UI in follow-up turns.
